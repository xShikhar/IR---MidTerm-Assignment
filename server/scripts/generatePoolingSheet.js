/**
 * @file server/scripts/generatePoolingSheet.js
 * @description Generates blind pooling sheets for human relevance judgments.
 * Executes multiple candidate retrieval systems (S0 Raw, S1 History, S2 TurnTrace,
 * BM25, and Oracle Gold Rewrite) on all 70 turns, extracts top-10 candidates per system,
 * pools and de-duplicates them, and outputs blank judging sheets in CSV and JSON formats.
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

export function generatePoolingSheet() {
  console.log('[TurnTrace Pooling Generator] Loading inverted index...');
  const index = loadIndex(CONFIG.paths.indexFile);

  console.log('[TurnTrace Pooling Generator] Loading conversations...');
  const conversations = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf-8'));

  const poolingRecords = [];
  const poolStats = {
    totalTurns: 0,
    totalPooledItems: 0,
    uniqueDocsInPool: new Set()
  };

  const evalOutputDir = CONFIG.paths.evalOutputDir;
  if (!fs.existsSync(evalOutputDir)) {
    fs.mkdirSync(evalOutputDir, { recursive: true });
  }

  for (const conv of conversations) {
    const historyQueries = [];
    const contextState = new ContextState();

    for (let t = 0; t < conv.turns.length; t++) {
      const turn = conv.turns[t];
      const queryId = `${conv.id}_${turn.turnId}`;
      poolStats.totalTurns++;

      // Candidate retrieval across systems (depth = 10 per system)
      const candidateDocIds = new Set();

      // 1. S0 (Raw Query lnc.ltc)
      const s0Res = executeRetrieval(turn.query, index, { topK: 10, model: 'cosine' });
      s0Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 2. BM25 (Raw Query Okapi BM25)
      const bm25Res = executeRetrieval(turn.query, index, { topK: 10, model: 'bm25' });
      bm25Res.results.forEach(r => candidateDocIds.add(r.docId));

      // 3. S1 (Naive Concatenation)
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

      // Create pooled entries (blind: sorted by docId so system origin is unidentifiable)
      const sortedDocIds = Array.from(candidateDocIds).sort();
      for (const docId of sortedDocIds) {
        const docEntry = index.docs[docId];
        poolStats.uniqueDocsInPool.add(docId);
        poolStats.totalPooledItems++;

        const snippet = (docEntry?.body || '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/"/g, '""')
          .slice(0, 250);

        poolingRecords.push({
          queryId,
          convId: conv.id,
          convTopic: conv.topic,
          turnIndex: t + 1,
          turnQuery: turn.query,
          goldRewriteRef: turn.goldRewrite,
          docId,
          docTitle: docEntry?.title || 'Unknown Title',
          domain: docEntry?.domain || 'unknown',
          bodySnippet: snippet,
          relevanceGrade: '', // MUST BE LEFT BLANK FOR HUMAN JUDGING (0, 1, or 2)
          annotatorNotes: ''  // Optional notes for annotator
        });
      }
    }
  }

  // 1. Export CSV Pooling Sheet
  const csvPath = path.join(evalOutputDir, 'pooling_sheet.csv');
  const csvHeaders = [
    'queryId',
    'convId',
    'convTopic',
    'turnIndex',
    'turnQuery',
    'docId',
    'docTitle',
    'domain',
    'bodySnippet',
    'relevanceGrade',
    'annotatorNotes'
  ];

  const csvRows = [
    csvHeaders.join(','),
    ...poolingRecords.map(r => [
      `"${r.queryId}"`,
      `"${r.convId}"`,
      `"${r.convTopic}"`,
      r.turnIndex,
      `"${r.turnQuery.replace(/"/g, '""')}"`,
      `"${r.docId}"`,
      `"${r.docTitle.replace(/"/g, '""')}"`,
      `"${r.domain}"`,
      `"${r.bodySnippet}"`,
      `"${r.relevanceGrade}"`,
      `"${r.annotatorNotes}"`
    ].join(','))
  ];

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');

  // 2. Export JSON Pooling Sheet
  const jsonPath = path.join(evalOutputDir, 'pooling_sheet.json');
  fs.writeFileSync(jsonPath, JSON.stringify(poolingRecords, null, 2), 'utf-8');

  console.log('========================================================================');
  console.log('                 TurnTrace Human Judging Pooling Sheets                 ');
  console.log('========================================================================');
  console.log(`Evaluated Turns:            ${poolStats.totalTurns}`);
  console.log(`Total Pooled Passages:      ${poolStats.totalPooledItems}`);
  console.log(`Avg Candidates per Turn:    ${(poolStats.totalPooledItems / poolStats.totalTurns).toFixed(1)}`);
  console.log(`Unique Documents in Pool:   ${poolStats.uniqueDocsInPool.size}`);
  console.log(`CSV Judging Sheet:          ${csvPath}`);
  console.log(`JSON Judging Sheet:         ${jsonPath}`);
  console.log('========================================================================');
  console.log('Instructions for Team Annotators:');
  console.log('1. Open eval/output/pooling_sheet.csv in Excel, Google Sheets, or VS Code.');
  console.log('2. Review the passage snippet against turnQuery.');
  console.log('3. Assign relevanceGrade:');
  console.log('     2 = Highly Relevant (Directly answers the query)');
  console.log('     1 = Relevant (Contains closely related factual information)');
  console.log('     0 = Irrelevant (Off-topic or unhelpful)');
  console.log('4. Save the judged file as eval/output/judged_qrels.csv or update data/qrels.json.');
  console.log('========================================================================\n');

  return {
    totalTurns: poolStats.totalTurns,
    totalPooledItems: poolStats.totalPooledItems,
    csvPath,
    jsonPath
  };
}

if (process.argv[1] && process.argv[1].endsWith('generatePoolingSheet.js')) {
  generatePoolingSheet();
}
