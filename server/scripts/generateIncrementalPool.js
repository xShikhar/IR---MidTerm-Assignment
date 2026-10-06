/**
 * @file server/scripts/generateIncrementalPool.js
 * @description Generates incremental blind pooling sheet for novel systems A1-A6.
 *
 * Requirements:
 * 1. Systems: A1, A2, A3, A4, A5, A6.
 * 2. Top-10 results per turn across all 70 benchmark turns.
 * 3. System-blind pooling: candidates deduplicated per turn and sorted strictly by docId.
 * 4. Deduplication against passages already present in the frozen master pool (eval/output/pooling_sheet.json).
 * 5. Writes to eval/output/pooling_incremental/.
 * 6. Never modifies eval/output/pooling/* or any frozen file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIndex } from '../src/index/serializer.js';
import { executeConversationalTurn } from '../src/api/traceAssembly.js';
import { ContextState } from '../src/conversation/contextState.js';
import { SeenPassageTracker } from '../src/retrieval/seenPenalty.js';
import { CONFIG } from '../src/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export async function runIncrementalPooling() {
  console.log('=== TurnTrace Phase 2: Incremental Pool Generation (A1-A6) ===');

  const index = loadIndex(CONFIG.paths.indexFile);
  const conversations = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf-8'));
  const masterSheetPath = path.join(rootDir, 'eval/output/pooling_sheet.json');
  const masterRecords = JSON.parse(fs.readFileSync(masterSheetPath, 'utf-8'));

  const masterKeys = new Set(masterRecords.map(r => `${r.queryId}:${r.docId}`));
  console.log(`Loaded frozen master pool: ${masterRecords.length} records (${masterKeys.size} unique turn-doc pairs).`);

  const outputDir = path.join(rootDir, 'eval/output/pooling_incremental');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const systems = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
  const systemTop10Total = {};
  const systemNewRows = {};
  const systemTop10Keys = {};

  systems.forEach(s => {
    systemTop10Total[s] = 0;
    systemNewRows[s] = 0;
    systemTop10Keys[s] = new Set();
  });

  // Map each turn to all new candidates surfaced by any of A1-A6
  const turnNewCandidatesMap = new Map();

  // Round-robin judge mapping consistent with master pool
  const convJudgeMap = {};
  conversations.forEach((conv, idx) => {
    const judgeNum = (idx % 4) + 1;
    convJudgeMap[conv.id] = `judge_${judgeNum}`;
  });

  // Turn metadata map for formatting
  const turnMetaMap = new Map();

  for (const systemId of systems) {
    console.log(`Evaluating candidate pool for system ${systemId}...`);

    for (const conv of conversations) {
      const historyQueries = [];
      let contextMode = 'v2';
      let accumulateAspects = (systemId === 'A2');

      const contextState = new ContextState({
        mode: contextMode,
        accumulateAspects
      });

      const seenTracker = new SeenPassageTracker(CONFIG.novelty.seen.penalty);

      for (let t = 0; t < conv.turns.length; t++) {
        const turn = conv.turns[t];
        const queryId = `${conv.id}_${turn.turnId}`;

        if (!turnMetaMap.has(queryId)) {
          const previousTurnsStr = historyQueries.length > 0
            ? historyQueries.map((q, i) => `[T${i + 1}] ${q}`).join(' | ')
            : 'None (Initial turn)';
          turnMetaMap.set(queryId, {
            conversationId: conv.id,
            convTopic: conv.topic,
            turnIndex: t + 1,
            queryId,
            previousTurns: previousTurnsStr,
            turnQuery: turn.query,
            goldRewrite: turn.goldRewrite,
            judgeAssignment: convJudgeMap[conv.id]
          });
        }

        let turnOptions = { topK: 10 };
        if (systemId === 'A1') {
          turnOptions = { ...turnOptions, lockMode: 'soft', entityBoost: 2.0 };
        } else if (systemId === 'A2') {
          turnOptions = { ...turnOptions, lockMode: 'hard' };
        } else if (systemId === 'A3') {
          turnOptions = { ...turnOptions, lockMode: 'hard' };
        } else if (systemId === 'A4') {
          turnOptions = { ...turnOptions, lockMode: 'hard', applySeenPenalty: true, seenTracker };
        } else if (systemId === 'A5') {
          turnOptions = { ...turnOptions, lockMode: 'hard', forcedDecision: 'CARRY' };
        } else if (systemId === 'A6') {
          turnOptions = { ...turnOptions, lockMode: 'hard', forcedDecision: 'reset' };
        }

        const convRes = await executeConversationalTurn(turn.query, contextState, index, turnOptions);
        const top10 = (convRes.results || []).slice(0, 10);

        top10.forEach(r => {
          systemTop10Total[systemId]++;
          const pairKey = `${queryId}:${r.docId}`;
          systemTop10Keys[systemId].add(pairKey);

          if (!masterKeys.has(pairKey)) {
            systemNewRows[systemId]++;
            if (!turnNewCandidatesMap.has(queryId)) {
              turnNewCandidatesMap.set(queryId, new Set());
            }
            turnNewCandidatesMap.get(queryId).add(r.docId);
          }
        });

        historyQueries.push(turn.query);
      }
    }
  }

  // System-blind incremental pool records:
  // For each turn, sort candidate docIds ascending and build records
  const incrementalRecords = [];
  const uniqueNewTurnDocPairs = new Set();

  for (const conv of conversations) {
    for (let t = 0; t < conv.turns.length; t++) {
      const turn = conv.turns[t];
      const queryId = `${conv.id}_${turn.turnId}`;
      const newDocs = turnNewCandidatesMap.get(queryId);
      if (!newDocs || newDocs.size === 0) continue;

      const sortedDocIds = Array.from(newDocs).sort();
      const meta = turnMetaMap.get(queryId);

      for (const docId of sortedDocIds) {
        const pairKey = `${queryId}:${docId}`;
        uniqueNewTurnDocPairs.add(pairKey);
        const docEntry = index.docs[docId];
        const snippet = (docEntry?.body || '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/"/g, '""')
          .slice(0, 300);

        incrementalRecords.push({
          conversationId: meta.conversationId,
          turnIndex: meta.turnIndex,
          queryId: meta.queryId,
          convTopic: meta.convTopic,
          previousTurns: meta.previousTurns,
          turnQuery: meta.turnQuery,
          goldRewrite: meta.goldRewrite,
          judgeAssignment: meta.judgeAssignment,
          docId,
          docTitle: docEntry?.title || 'Unknown Title',
          domain: docEntry?.domain || 'unknown',
          bodySnippet: snippet,
          relevanceGrade: '',
          annotatorNotes: ''
        });
      }
    }
  }

  // Write JSON
  const jsonOutPath = path.join(outputDir, 'incremental_pool.json');
  fs.writeFileSync(jsonOutPath, JSON.stringify(incrementalRecords, null, 2), 'utf-8');

  // Write CSV
  const csvHeaders = [
    'conversationId', 'turnIndex', 'queryId', 'convTopic',
    'previousTurns', 'turnQuery', 'goldRewrite', 'judgeAssignment',
    'docId', 'docTitle', 'domain', 'bodySnippet', 'relevanceGrade', 'annotatorNotes'
  ];

  function escapeCsv(val) {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const csvLines = [csvHeaders.join(',')];
  for (const r of incrementalRecords) {
    csvLines.push(csvHeaders.map(h => escapeCsv(r[h])).join(','));
  }
  const csvOutPath = path.join(outputDir, 'incremental_pool.csv');
  fs.writeFileSync(csvOutPath, csvLines.join('\n'), 'utf-8');

  // Compile coverage report
  const coverageReport = {
    generatedAt: new Date().toISOString(),
    masterPoolRecords: masterRecords.length,
    totalIncrementalRecords: incrementalRecords.length,
    systems: {}
  };

  console.log('\n=== INCREMENTAL POOL COVERAGE REPORT ===');
  console.log('| System | Top-10 Evaluations | New Rows Surfaced | Total Top-10 Rows | Unjudged Fraction |');
  console.log('|:---:|:---:|:---:|:---:|:---:|');

  for (const s of systems) {
    const totalTop10 = systemTop10Total[s];
    const newRows = systemNewRows[s];
    const unjudgedFraction = totalTop10 > 0 ? (newRows / totalTop10) : 0;
    coverageReport.systems[s] = {
      totalTop10,
      newRows,
      unjudgedFraction: Number(unjudgedFraction.toFixed(4)),
      unjudgedPercent: Number((unjudgedFraction * 100).toFixed(2))
    };
    console.log(`| ${s} | ${totalTop10} | ${newRows} | ${totalTop10} | ${(unjudgedFraction * 100).toFixed(2)}% (${newRows}/${totalTop10}) |`);
  }

  console.log(`\nTotal unique incremental pool rows (deduplicated across A1-A6): ${incrementalRecords.length}`);
  console.log(`Saved incremental pool to:`);
  console.log(`  - ${jsonOutPath}`);
  console.log(`  - ${csvOutPath}`);

  fs.writeFileSync(path.join(outputDir, 'coverage_report.json'), JSON.stringify(coverageReport, null, 2), 'utf-8');

  return coverageReport;
}

if (process.argv[1] && process.argv[1].endsWith('generateIncrementalPool.js')) {
  runIncrementalPooling().catch(err => {
    console.error('Incremental pooling failed:', err);
    process.exit(1);
  });
}
