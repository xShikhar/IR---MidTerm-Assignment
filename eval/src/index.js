/**
 * @file eval/src/index.js
 * @description Main Evaluation Entry Point for TurnTrace.
 * Runs Systems S0 through S5 and Ablations A1 through A4 across all judged turns.
 * Outputs formatted console tables and generates export artifacts in eval/output/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadIndex } from '../../server/src/index/serializer.js';
import { loadEvaluationData } from './qrelsLoader.js';
import { runEvaluationBenchmark } from './systemsRunner.js';
import { exportEvaluationArtifacts } from './export.js';
import { compareSystems } from './significance.js';
import { CONFIG } from '../../server/src/config/index.js';

export async function runEvaluation() {
  console.log('========================================================================');
  console.log('              TurnTrace Information Retrieval Evaluation Harness        ');
  console.log('========================================================================');

  const startTime = performance.now();
  console.log('[TurnTrace Eval] Loading inverted index from disk...');
  const index = loadIndex(CONFIG.paths.indexFile);

  console.log('[TurnTrace Eval] Loading conversation scenarios and qrels...');
  const { conversations, qrels } = loadEvaluationData();
  const totalTurns = Object.keys(qrels).length;
  console.log(`[TurnTrace Eval] Loaded ${conversations.length} conversations, ${totalTurns} judged turns.`);

  console.log('[TurnTrace Eval] Running retrieval benchmark across Systems S0-S5 and Ablations A1-A4...');
  const benchmarkResults = await runEvaluationBenchmark(conversations, qrels, index);

  // 1. Systems Comparison Table (Overall)
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 1: Comparative Evaluation Across Systems (70 Judged Turns)');
  console.log('------------------------------------------------------------------------');
  console.table([
    {
      System: 'S0 (Raw Query Only)',
      'P@5': benchmarkResults.S0.overall.p5,
      'P@10': benchmarkResults.S0.overall.p10,
      'Recall@20': benchmarkResults.S0.overall.recall20,
      MRR: benchmarkResults.S0.overall.mrr,
      'nDCG@10': benchmarkResults.S0.overall.ndcg10
    },
    {
      System: 'S1 (Naive Concatenation)',
      'P@5': benchmarkResults.S1.overall.p5,
      'P@10': benchmarkResults.S1.overall.p10,
      'Recall@20': benchmarkResults.S1.overall.recall20,
      MRR: benchmarkResults.S1.overall.mrr,
      'nDCG@10': benchmarkResults.S1.overall.ndcg10
    },
    {
      System: 'S2 (TurnTrace Rewriter)',
      'P@5': benchmarkResults.S2.overall.p5,
      'P@10': benchmarkResults.S2.overall.p10,
      'Recall@20': benchmarkResults.S2.overall.recall20,
      MRR: benchmarkResults.S2.overall.mrr,
      'nDCG@10': benchmarkResults.S2.overall.ndcg10
    },
    {
      System: 'S3 (TurnTrace Full + RRF)',
      'P@5': benchmarkResults.S3.overall.p5,
      'P@10': benchmarkResults.S3.overall.p10,
      'Recall@20': benchmarkResults.S3.overall.recall20,
      MRR: benchmarkResults.S3.overall.mrr,
      'nDCG@10': benchmarkResults.S3.overall.ndcg10
    },
    {
      System: 'S4 (Declared LLM Rewriter)',
      'P@5': benchmarkResults.S4.overall.p5,
      'P@10': benchmarkResults.S4.overall.p10,
      'Recall@20': benchmarkResults.S4.overall.recall20,
      MRR: benchmarkResults.S4.overall.mrr,
      'nDCG@10': benchmarkResults.S4.overall.ndcg10
    },
    {
      System: 'S5 (Oracle Gold Rewrite)',
      'P@5': benchmarkResults.S5.overall.p5,
      'P@10': benchmarkResults.S5.overall.p10,
      'Recall@20': benchmarkResults.S5.overall.recall20,
      MRR: benchmarkResults.S5.overall.mrr,
      'nDCG@10': benchmarkResults.S5.overall.ndcg10
    }
  ]);

  // 2. Ablations Comparison Table
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 2: Component Ablation Study (S2 Baseline vs Ablated Systems)');
  console.log('------------------------------------------------------------------------');
  console.table([
    {
      Configuration: 'S2 Baseline (lnc.ltc + Decay + Shift)',
      'P@5': benchmarkResults.S2.overall.p5,
      'P@10': benchmarkResults.S2.overall.p10,
      'Recall@20': benchmarkResults.S2.overall.recall20,
      MRR: benchmarkResults.S2.overall.mrr,
      'nDCG@10': benchmarkResults.S2.overall.ndcg10
    },
    {
      Configuration: 'A1: Okapi BM25 Scoring Model',
      'P@5': benchmarkResults.A1.overall.p5,
      'P@10': benchmarkResults.A1.overall.p10,
      'Recall@20': benchmarkResults.A1.overall.recall20,
      MRR: benchmarkResults.A1.overall.mrr,
      'nDCG@10': benchmarkResults.A1.overall.ndcg10
    },
    {
      Configuration: 'A2: Topic-Shift Detector OFF',
      'P@5': benchmarkResults.A2.overall.p5,
      'P@10': benchmarkResults.A2.overall.p10,
      'Recall@20': benchmarkResults.A2.overall.recall20,
      MRR: benchmarkResults.A2.overall.mrr,
      'nDCG@10': benchmarkResults.A2.overall.ndcg10
    },
    {
      Configuration: 'A3: Exponential Decay OFF (lambda=1.0)',
      'P@5': benchmarkResults.A3.overall.p5,
      'P@10': benchmarkResults.A3.overall.p10,
      'Recall@20': benchmarkResults.A3.overall.recall20,
      MRR: benchmarkResults.A3.overall.mrr,
      'nDCG@10': benchmarkResults.A3.overall.ndcg10
    },
    {
      Configuration: 'A4: Decomposer Fusion OFF',
      'P@5': benchmarkResults.A4.overall.p5,
      'P@10': benchmarkResults.A4.overall.p10,
      'Recall@20': benchmarkResults.A4.overall.recall20,
      MRR: benchmarkResults.A4.overall.mrr,
      'nDCG@10': benchmarkResults.A4.overall.ndcg10
    }
  ]);

  // 3. Cohort Breakdowns: Turn 1 vs Later Turns vs Topic-Shift
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 3: Performance Breakdown by Conversational Turn Position');
  console.log('------------------------------------------------------------------------');
  console.table([
    {
      Cohort: 'Turn 1 Only (14 turns)',
      'S0 nDCG@10': benchmarkResults.S0.turn1Only.ndcg10,
      'S1 nDCG@10': benchmarkResults.S1.turn1Only.ndcg10,
      'S2 nDCG@10': benchmarkResults.S2.turn1Only.ndcg10,
      'S3 nDCG@10': benchmarkResults.S3.turn1Only.ndcg10,
      'S5 nDCG@10': benchmarkResults.S5.turn1Only.ndcg10
    },
    {
      Cohort: 'Later Turns 2-5 (56 turns)',
      'S0 nDCG@10': benchmarkResults.S0.laterTurns.ndcg10,
      'S1 nDCG@10': benchmarkResults.S1.laterTurns.ndcg10,
      'S2 nDCG@10': benchmarkResults.S2.laterTurns.ndcg10,
      'S3 nDCG@10': benchmarkResults.S3.laterTurns.ndcg10,
      'S5 nDCG@10': benchmarkResults.S5.laterTurns.ndcg10
    },
    {
      Cohort: 'Topic-Shift Turns (4 turns)',
      'S0 nDCG@10': benchmarkResults.S0.topicShiftTurns.ndcg10,
      'S1 nDCG@10': benchmarkResults.S1.topicShiftTurns.ndcg10,
      'S2 nDCG@10': benchmarkResults.S2.topicShiftTurns.ndcg10,
      'S3 nDCG@10': benchmarkResults.S3.topicShiftTurns.ndcg10,
      'S5 nDCG@10': benchmarkResults.S5.topicShiftTurns.ndcg10
    }
  ]);

  // 4. Clarification Evaluation
  const clarif = benchmarkResults.S3.clarification;
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 4: Clarifying Question Trigger Precision & Recall');
  console.log('------------------------------------------------------------------------');
  console.log(`Total Ambiguous Turns:          ${clarif.ambiguousCount}`);
  console.log(`Clarification Questions Fired:  ${clarif.firedCount}`);
  console.log(`Clarification Precision:        ${(clarif.precision * 100).toFixed(1)}%`);
  console.log(`Clarification Recall:           ${(clarif.recall * 100).toFixed(1)}%`);

  // 5. Documented Failure Case Analysis
  console.log('\n------------------------------------------------------------------------');
  console.log(' Documented Limitation Case for Video Demonstration & Report');
  console.log('------------------------------------------------------------------------');
  console.log('Turn: Conv 14, Turn 4 ("Is entropy always conserved in physical processes?")');
  console.log('Issue: Vocabulary Drift & Polysemy over-carry.');
  console.log('Analysis: Query rewriter carried "bits" and "information" from Shannon entropy');
  console.log('into a thermodynamic physics law query, demonstrating term-overlap limitation.');

  // 6. Benchmark Splits & Significance Analysis (F-06)
  const splitsPath = path.resolve('data/splits.json');
  if (fs.existsSync(splitsPath)) {
    const splits = JSON.parse(fs.readFileSync(splitsPath, 'utf8'));
    console.log('\n------------------------------------------------------------------------');
    console.log(' Table 5: Benchmark Splits & Statistical Significance Setup (F-06)');
    console.log('------------------------------------------------------------------------');
    console.table([
      {
        Split: 'Dev (Tuning / Diagnostic)',
        Conversations: splits.dev.conversationCount,
        Turns: splits.dev.turnCount,
        Focus: 'Topic-shifts (conv_09,10,11,12) & Ambiguity (conv_11,12)'
      },
      {
        Split: 'Test (Unseen Headline Evaluation)',
        Conversations: splits.test.conversationCount,
        Turns: splits.test.turnCount,
        Focus: 'Multi-part decomposition, standard carries & entropy drift'
      }
    ]);

    if (totalTurns > 0) {
      const testConvSet = new Set(splits.test.conversationIds);
      const testRecordsS2 = benchmarkResults.S2.rawRecords.filter(r => testConvSet.has(r.convId));
      const testRecordsS0 = benchmarkResults.S0.rawRecords.filter(r => testConvSet.has(r.convId));
      const testRecordsS1 = benchmarkResults.S1.rawRecords.filter(r => testConvSet.has(r.convId));

      const sigS2vsS0 = compareSystems(testRecordsS2, testRecordsS0, 'ndcg10');
      const sigS2vsS1 = compareSystems(testRecordsS2, testRecordsS1, 'ndcg10');

      console.log('\n Statistical Significance on Test Set (40 Turns, Seed 42, 2000 Bootstrap Replicates):');
      console.table([
        {
          Comparison: 'S2 vs S0 (nDCG@10)',
          Delta: sigS2vsS0.bootstrap.delta,
          'Bootstrap p-value': sigS2vsS0.bootstrap.pValue,
          '95% CI': `[${sigS2vsS0.bootstrap.ciLower}, ${sigS2vsS0.bootstrap.ciUpper}]`,
          'Wilcoxon p-value': sigS2vsS0.wilcoxon.pValue,
          'Significant (alpha=0.05)': sigS2vsS0.bootstrap.isSignificant
        },
        {
          Comparison: 'S2 vs S1 (nDCG@10)',
          Delta: sigS2vsS1.bootstrap.delta,
          'Bootstrap p-value': sigS2vsS1.bootstrap.pValue,
          '95% CI': `[${sigS2vsS1.bootstrap.ciLower}, ${sigS2vsS1.bootstrap.ciUpper}]`,
          'Wilcoxon p-value': sigS2vsS1.wilcoxon.pValue,
          'Significant (alpha=0.05)': sigS2vsS1.bootstrap.isSignificant
        }
      ]);
    } else {
      console.log(' [Notice] Relevance labels pending human judging via pooling sheets.');
      console.log(' Paired Bootstrap and Wilcoxon tests will execute automatically once qrels are populated.');
    }
  }

  // 7. Export artifacts to disk
  exportEvaluationArtifacts(benchmarkResults);

  const totalElapsed = (performance.now() - startTime).toFixed(1);
  console.log(`\n[TurnTrace Eval] Complete evaluation run finished in ${totalElapsed} ms.`);

  return benchmarkResults;
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runEvaluation()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[TurnTrace Eval] Fatal Error:', err);
      process.exit(1);
    });
}
