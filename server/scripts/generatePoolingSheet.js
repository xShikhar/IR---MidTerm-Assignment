/**
 * @file server/scripts/generatePoolingSheet.js
 * @description Generates blind pooling sheets for human relevance judgments.
 *
 * Features:
 * 1. Rich context columns: conversationId, turnIndex, previousTurns, goldRewrite, judgeAssignment.
 * 2. 4 Judge Split (round-robin by conversation) with fixed-seed 15% overlap for inter-annotator agreement.
 * 3. Incremental Mode: skips passages already judged in data/qrels.json or judged_qrels.csv.
 * 4. System-blind pooling: candidates deduplicated and sorted by docId.
 *
 * Ground Rule: Leaves all relevance grades blank for human judging. Does not generate labels.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadIndex } from '../src/index/serializer.js';
import { executeRetrieval } from '../src/retrieval/engine.js';
import { ContextState } from '../src/conversation/contextState.js';
import { detectTopicShift } from '../src/conversation/shiftDetector.js';
import { rewriteQuery } from '../src/conversation/rewriter.js';
import { CONFIG } from '../src/config/index.js';
import { loadEvaluationData } from '../../eval/src/qrelsLoader.js';

/**
 * Deterministic pseudo-random number generator (Mulberry32) for reproducible sampling.
 */
function createPrng(seed = 42) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates pooling sheets across all 70 turns.
 *
 * @param {Object} [options]
 * @param {boolean} [options.incremental=false] - Only export candidates not yet judged
 * @param {number} [options.overlapRate=0.15] - Fraction of turns duplicated for agreement
 * @param {number} [options.seed=42] - PRNG seed for overlap selection
 */
export function generatePoolingSheet(options = {}) {
  const incremental = options.incremental ?? process.argv.includes('--incremental');
  const overlapRate = options.overlapRate ?? 0.15;
  const seed = options.seed ?? 42;

  console.log(`[TurnTrace Pooling Generator] Initializing pooling sheet generation (incremental=${incremental})...`);
  const index = loadIndex(CONFIG.paths.indexFile);
  const conversations = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf-8'));

  // Load existing qrels if incremental mode is active
  let existingQrels = {};
  if (incremental) {
    try {
      const evalData = loadEvaluationData();
      existingQrels = evalData.qrels || {};
      const existingCount = Object.values(existingQrels).reduce((s, m) => s + Object.keys(m).length, 0);
      console.log(`[TurnTrace Pooling Generator] Incremental mode: found ${existingCount} already-judged entries.`);
    } catch {
      existingQrels = {};
    }
  }

  const evalOutputDir = CONFIG.paths.evalOutputDir;
  const poolingDir = path.join(evalOutputDir, 'pooling');
  if (!fs.existsSync(poolingDir)) {
    fs.mkdirSync(poolingDir, { recursive: true });
  }

  // Round-robin conversation assignments across 4 judges:
  // Judge 1: conv_01, conv_05, conv_09, conv_13
  // Judge 2: conv_02, conv_06, conv_10, conv_14
  // Judge 3: conv_03, conv_07, conv_11
  // Judge 4: conv_04, conv_08, conv_12
  const convJudgeMap = {};
  conversations.forEach((conv, idx) => {
    const judgeNum = (idx % 4) + 1;
    convJudgeMap[conv.id] = `judge_${judgeNum}`;
  });

  // Collect all turn keys for deterministic 15% overlap sampling
  const allTurnKeys = [];
  for (const conv of conversations) {
    for (const turn of conv.turns) {
      allTurnKeys.push(`${conv.id}_${turn.turnId}`);
    }
  }

  const prng = createPrng(seed);
  const overlapCount = Math.round(allTurnKeys.length * overlapRate); // 70 * 0.15 = 11 turns
  const shuffledKeys = [...allTurnKeys].sort(() => prng() - 0.5);
  const overlapTurnsSet = new Set(shuffledKeys.slice(0, overlapCount));

  console.log(`[TurnTrace Pooling Generator] Sampled ${overlapTurnsSet.size} turns (15%) for inter-annotator agreement checking.`);

  // Map each judge to the next judge for overlap assignments
  const nextJudgeMap = {
    judge_1: 'judge_2',
    judge_2: 'judge_3',
    judge_3: 'judge_4',
    judge_4: 'judge_1'
  };

  const masterRecords = [];
  const judgeRecords = {
    judge_1: [],
    judge_2: [],
    judge_3: [],
    judge_4: []
  };

  let totalPooledCandidates = 0;
  let skippedAlreadyJudged = 0;
  const uniqueDocsInPool = new Set();

  for (const conv of conversations) {
    const primaryJudge = convJudgeMap[conv.id];
    const historyQueries = [];
    const contextState = new ContextState();

    for (let t = 0; t < conv.turns.length; t++) {
      const turn = conv.turns[t];
      const queryId = `${conv.id}_${turn.turnId}`;
      const isOverlapTurn = overlapTurnsSet.has(queryId);
      const secondaryJudge = isOverlapTurn ? nextJudgeMap[primaryJudge] : null;

      // Build previousTurns context string
      const previousTurnsStr = historyQueries.length > 0
        ? historyQueries.map((q, i) => `[T${i + 1}] ${q}`).join(' | ')
        : 'None (Initial turn)';

      // Retrieve top-10 across candidate systems
      const candidateDocIds = new Set();

      // 1. S0 (Raw Query lnc.ltc)
      const s0Res = executeRetrieval(turn.query, index, { topK: 10, model: 'cosine' });
      s0Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 2. BM25 (Raw Query Okapi BM25)
      const bm25Res = executeRetrieval(turn.query, index, { topK: 10, model: 'bm25' });
      bm25Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 3. S1 (History Concatenation)
      const concatenated = [...historyQueries, turn.query].join(' ');
      const s1Res = executeRetrieval(concatenated, index, { topK: 10, model: 'cosine' });
      s1Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 4. S2 (TurnTrace Rewriter)
      const shiftDecision = detectTopicShift(turn.query, contextState.getVector(), index);
      const rewriteRes = rewriteQuery(turn.query, contextState, shiftDecision.decision);
      const s2Res = executeRetrieval(rewriteRes.rewrittenQuery, index, { topK: 10, model: 'cosine' });
      s2Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 5. Oracle Gold Rewrite (Upper Bound candidate pool)
      const oracleRes = executeRetrieval(turn.goldRewrite, index, { topK: 10, model: 'cosine' });
      oracleRes.results.forEach(r => candidateDocIds.add(r.docId));

      // Update state for subsequent turns
      historyQueries.push(turn.query);
      contextState.update(turn.query, s2Res.results.slice(0, 1), index);

      // System-blind pooling: sort candidate docs strictly by docId
      const sortedDocIds = Array.from(candidateDocIds).sort();

      for (const docId of sortedDocIds) {
        // In incremental mode: skip if already judged
        if (incremental && existingQrels[queryId]?.[docId] !== undefined) {
          skippedAlreadyJudged++;
          continue;
        }

        const docEntry = index.docs[docId];
        uniqueDocsInPool.add(docId);
        totalPooledCandidates++;

        const snippet = (docEntry?.body || '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/"/g, '""')
          .slice(0, 300);

        const baseRecord = {
          conversationId: conv.id,
          convTopic: conv.topic,
          turnIndex: t + 1,
          queryId,
          previousTurns: previousTurnsStr,
          turnQuery: turn.query,
          goldRewrite: turn.goldRewrite,
          docId,
          docTitle: docEntry?.title || 'Unknown Title',
          domain: docEntry?.domain || 'unknown',
          bodySnippet: snippet,
          relevanceGrade: '', // MUST BE LEFT BLANK FOR HUMAN JUDGES (0, 1, or 2)
          annotatorNotes: ''  // Optional notes for judges
        };

        // Master sheet entry
        masterRecords.push({
          ...baseRecord,
          judgeAssignment: isOverlapTurn ? `${primaryJudge}, ${secondaryJudge} (overlap)` : primaryJudge
        });

        // Primary judge sheet
        judgeRecords[primaryJudge].push({
          ...baseRecord,
          judgeAssignment: primaryJudge
        });

        // Overlap judge sheet (if selected for 15% agreement checking)
        if (isOverlapTurn && secondaryJudge) {
          judgeRecords[secondaryJudge].push({
            ...baseRecord,
            judgeAssignment: `${secondaryJudge} (overlap verification for ${primaryJudge})`
          });
        }
      }
    }
  }

  // CSV formatting helper
  const csvHeaders = [
    'conversationId',
    'turnIndex',
    'queryId',
    'convTopic',
    'previousTurns',
    'turnQuery',
    'goldRewrite',
    'judgeAssignment',
    'docId',
    'docTitle',
    'domain',
    'bodySnippet',
    'relevanceGrade',
    'annotatorNotes'
  ];

  function toCsv(records) {
    const rows = [
      csvHeaders.join(','),
      ...records.map(r => [
        `"${r.conversationId}"`,
        r.turnIndex,
        `"${r.queryId}"`,
        `"${r.convTopic.replace(/"/g, '""')}"`,
        `"${r.previousTurns.replace(/"/g, '""')}"`,
        `"${r.turnQuery.replace(/"/g, '""')}"`,
        `"${r.goldRewrite.replace(/"/g, '""')}"`,
        `"${r.judgeAssignment}"`,
        `"${r.docId}"`,
        `"${r.docTitle.replace(/"/g, '""')}"`,
        `"${r.domain}"`,
        `"${r.bodySnippet}"`,
        `"${r.relevanceGrade}"`,
        `"${r.annotatorNotes}"`
      ].join(','))
    ];
    return rows.join('\n');
  }

  // 1. Export Master sheets
  const masterCsvPath = path.join(evalOutputDir, 'pooling_sheet.csv');
  const masterJsonPath = path.join(evalOutputDir, 'pooling_sheet.json');
  fs.writeFileSync(masterCsvPath, toCsv(masterRecords), 'utf-8');
  fs.writeFileSync(masterJsonPath, JSON.stringify(masterRecords, null, 2), 'utf-8');

  // 2. Export 4 Individual Judge sheets
  const judgeFilePaths = {};
  for (let j = 1; j <= 4; j++) {
    const jKey = `judge_${j}`;
    const jPath = path.join(poolingDir, `${jKey}_pool.csv`);
    fs.writeFileSync(jPath, toCsv(judgeRecords[jKey]), 'utf-8');
    judgeFilePaths[jKey] = {
      path: jPath,
      rows: judgeRecords[jKey].length
    };
  }

  console.log('========================================================================');
  console.log('                 TurnTrace Human Judging Pooling Sheets                 ');
  console.log('========================================================================');
  console.log(`Evaluated Turns:               70`);
  console.log(`Total Master Pooled Entries:   ${masterRecords.length}`);
  if (incremental) {
    console.log(`Skipped Already-Judged:        ${skippedAlreadyJudged}`);
  }
  console.log(`Unique Documents in Pool:      ${uniqueDocsInPool.size}`);
  console.log(`Overlap Agreement Turns:       ${overlapTurnsSet.size} turns (15%)`);
  console.log('------------------------------------------------------------------------');
  console.log(`Master Sheet (CSV):            ${masterCsvPath}`);
  console.log(`Master Sheet (JSON):           ${masterJsonPath}`);
  console.log('Individual Judge Sheets (eval/output/pooling/):');
  for (const [k, v] of Object.entries(judgeFilePaths)) {
    console.log(`  - ${k}: ${v.rows} items -> ${v.path}`);
  }
  console.log('========================================================================\n');

  return {
    masterCount: masterRecords.length,
    judgeFilePaths,
    masterCsvPath,
    masterJsonPath
  };
}

if (process.argv[1] && process.argv[1].endsWith('generatePoolingSheet.js')) {
  generatePoolingSheet();
}
