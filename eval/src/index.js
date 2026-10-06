/**
 * @file eval/src/index.js
 * @description Main Evaluation Entry Point for TurnTrace.
 * Runs Systems S0 through S5, Novelty Ablations A0 through A6, and
 * Efficiency Ablations R1 through R2 across all conversation scenarios.
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
import { computeRewriteFidelity, computeSpearmanCorrelation } from './metrics/fidelity.js';
import { evaluateDecisionClassification } from './metrics/decisionClassification.js';
import { detectTopicShift as legacyDetectTopicShift } from '../../server/src/conversation/shiftDetector.js';
import { detectConversationalDecision } from '../../server/src/conversation/decisionDetector.js';
import { extractEntityCandidates, extractAspectTerms } from '../../server/src/conversation/entityExtractor.js';
import { ContextState } from '../../server/src/conversation/contextState.js';
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
  const totalJudgedTurns = Object.keys(qrels).length;
  console.log(`[TurnTrace Eval] Loaded ${conversations.length} conversations, ${totalJudgedTurns} judged turns in qrels.`);

  console.log('[TurnTrace Eval] Running retrieval benchmark across Systems S0-S5, Ablations A0-A6, R1-R2...');
  const benchmarkResults = await runEvaluationBenchmark(conversations, qrels, index);

  // 1. Systems Comparison Table (Overall Table 1)
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 1: Comparative Evaluation Across Systems & Novelty Ablations');
  console.log('------------------------------------------------------------------------');
  const table1Systems = [
    { id: 'S0', name: 'S0: Raw Query Only (lnc.ltc Cosine)' },
    { id: 'S1', name: 'S1: Naive Concatenation of Dialogue History' },
    { id: 'S2', name: 'S2: TurnTrace Legacy Baseline (Decayed Bag, Cosine)' },
    { id: 'S3', name: 'S3: TurnTrace Full Headline (Lock + Aspect + Penalty)' },
    { id: 'S5', name: 'S5: Oracle Gold Rewrite (Upper Bound)' },
    { id: 'A0', name: 'A0: Legacy Decayed Context Bag (S2 Equivalent)' },
    { id: 'A1', name: 'A1: Entity Soft Boost + Aspect Replacement' },
    { id: 'A2', name: 'A2: Hard Lock + Aspect Accumulation' },
    { id: 'A3', name: 'A3: Hard Lock + Aspect Replacement (Headline Core)' },
    { id: 'A4', name: 'A4: A3 + Seen-Passage Penalty (beta=0.30)' },
    { id: 'A5', name: 'A5: A3 with Forced CARRY (Decision Isolation)' },
    { id: 'A6', name: 'A6: A3 with Forced RESET (Decision Isolation)' },
    { id: 'R1', name: 'R1: Retrieval Efficiency - Champion Lists ON (r=50)' },
    { id: 'R2', name: 'R2: Retrieval Efficiency - Index Elimination ON (IDF>=2.50)' }
  ];

  const table1Rows = table1Systems.map(s => {
    const res = benchmarkResults[s.id]?.overall;
    const noveltyRes = benchmarkResults[s.id]?.turnRecords;
    const avgNovelty = noveltyRes && noveltyRes.length > 0
      ? Number((noveltyRes.reduce((acc, r) => acc + (r.novelty10 || 0), 0) / noveltyRes.length).toFixed(4))
      : 0;

    return {
      System: s.name,
      'P@5': res ? res.p5 : '0.000',
      'P@10': res ? res.p10 : '0.000',
      'Recall@20': res ? res.recall20 : '0.000',
      MRR: res ? res.mrr : '0.000',
      'nDCG@10': res ? res.ndcg10 : '0.000',
      'Novelty@10': avgNovelty.toFixed(4)
    };
  });
  console.table(table1Rows);

  if (totalJudgedTurns === 0) {
    console.log(' [Notice] Relevance metrics pending human judging via pooling sheets (0/70 turns in data/qrels.json).');
    console.log('          Novelty@10 is computed dynamically from passage exposure history.');
  }

  // 2. Subset Breakdown Table: A0 (Legacy Bag) vs A3 (Headline Novelty Core)
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 2: Subset Breakdown: A0 (Legacy Decayed Bag) vs A3 (Headline Novelty)');
  console.log('------------------------------------------------------------------------');

  const recordsA0 = benchmarkResults.A0?.turnRecords || [];
  const recordsA3 = benchmarkResults.A3?.turnRecords || [];

  const pronounRegex = /\b(it|its|they|them|their|this|that|these|those|he|she|him|her)\b/i;

  const getSubsetAvg = (records, filterFn) => {
    const matched = records.filter(filterFn);
    if (matched.length === 0) return { count: 0, p10: '0.000', ndcg10: '0.000', novelty10: '0.000' };
    const p10 = (matched.reduce((acc, r) => acc + (r.p10 || 0), 0) / matched.length).toFixed(4);
    const ndcg10 = (matched.reduce((acc, r) => acc + (r.ndcg10 || 0), 0) / matched.length).toFixed(4);
    const novelty10 = (matched.reduce((acc, r) => acc + (r.novelty10 || 0), 0) / matched.length).toFixed(4);
    return { count: matched.length, p10, ndcg10, novelty10 };
  };

  const subsets = [
    {
      name: 'Turns with >=2 Aspect Changes',
      filter: r => (r.aspectChangesSoFar || 0) >= 2
    },
    {
      name: 'Entity Switch Turns (disjoint entity)',
      filter: r => r.predictedAction === 'entity_switch'
    },
    {
      name: 'Ambiguous Entity Turns',
      filter: r => Boolean(r.isAmbiguous)
    },
    {
      name: 'Pronoun / Anaphora Follow-Ups',
      filter: r => pronounRegex.test(r.query)
    }
  ];

  const subsetRows = subsets.map(sub => {
    const a0Stats = getSubsetAvg(recordsA0, sub.filter);
    const a3Stats = getSubsetAvg(recordsA3, sub.filter);
    return {
      Subset: sub.name,
      Turns: a3Stats.count,
      'A0 P@10': a0Stats.p10,
      'A3 P@10': a3Stats.p10,
      'A0 nDCG@10': a0Stats.ndcg10,
      'A3 nDCG@10': a3Stats.ndcg10,
      'A0 Novelty@10': a0Stats.novelty10,
      'A3 Novelty@10': a3Stats.novelty10
    };
  });
  console.table(subsetRows);

  const fallbackCountA3 = recordsA3.filter(r => r.isFallback).length;
  const fallbackRateA3 = recordsA3.length > 0
    ? ((fallbackCountA3 / recordsA3.length) * 100).toFixed(1)
    : '0.0';
  console.log(` Hard-lock Boolean Title Filter Fallback Rate (candidates < 10): ${fallbackRateA3}% (${fallbackCountA3}/${recordsA3.length} turns).`);

  // 3. Novelty@10 vs P@10 Trade-Off: A3 (No Penalty) vs A4 (Seen Penalty beta=0.30)
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 3: Novelty Discovery vs Precision Trade-Off: A3 vs A4');
  console.log('------------------------------------------------------------------------');
  const recordsA4 = benchmarkResults.A4?.turnRecords || [];
  const a3Novelty = recordsA3.length > 0 ? (recordsA3.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA3.length).toFixed(4) : '0.000';
  const a4Novelty = recordsA4.length > 0 ? (recordsA4.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA4.length).toFixed(4) : '0.000';
  const a3P10 = benchmarkResults.A3?.overall?.p10 ?? '0.000';
  const a4P10 = benchmarkResults.A4?.overall?.p10 ?? '0.000';

  console.table([
    {
      Configuration: 'A3: Headline Novelty (Penalty OFF)',
      'Novelty@10': a3Novelty,
      'P@10': a3P10,
      'Trade-off Behavior': 'Maximizes immediate relevance; repeats passages across turns'
    },
    {
      Configuration: 'A4: Headline Novelty + Seen Penalty (beta=0.30)',
      'Novelty@10': a4Novelty,
      'P@10': a4P10,
      'Trade-off Behavior': 'Demotes seen docs by 30%; discovers fresh evidence; slight P@10 risk if doc re-needed'
    }
  ]);
  console.log(' Note: Seen-passage penalty demotes already-shown document scores by (1 - beta) = 0.70.');
  console.log('       This encourages exploration of new passages while retaining access if top-ranked.');

  // 4. Rewrite Fidelity against Human Reference (Post-Hoc Evaluation Metric)
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 4: Query Rewrite Fidelity against Reference (Post-Hoc Analysis)');
  console.log('------------------------------------------------------------------------');
  const fidelitySystems = ['S1', 'S2', 'A3', 'S3', 'S5'];
  const fidelityRows = [];

  // Build map of gold rewrites by turnKey
  const goldMap = new Map();
  conversations.forEach(c => {
    c.turns.forEach(t => {
      goldMap.set(`${c.id}_${t.turnId}`, t.goldRewrite);
    });
  });

  for (const sysId of fidelitySystems) {
    const raw = benchmarkResults[sysId]?.turnRecords || [];
    if (raw.length === 0) continue;

    const fids = raw.map(r => computeRewriteFidelity(r.rewrittenQuery, goldMap.get(r.turnKey)));
    const avgFid = (fids.reduce((a, b) => a + b, 0) / fids.length).toFixed(4);
    const p10Vals = raw.map(r => r.p10 || 0);
    const spearmanRho = computeSpearmanCorrelation(fids, p10Vals);

    fidelityRows.push({
      System: sysId,
      'Mean Jaccard Fidelity': avgFid,
      'Spearman Correlation with P@10': totalJudgedTurns > 0 ? spearmanRho.toFixed(4) : '[Pending qrels]',
      'Evaluation Nature': 'Post-hoc measurement only (Zero leakage into runtime retrieval)'
    });
  }
  console.table(fidelityRows);

  // 5. Transition Classifier Evaluation & Legacy vs New Rule Comparison on Dev
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 5: Transition Classifier Evaluation & Legacy vs New Comparison');
  console.log('------------------------------------------------------------------------');

  // Check labeled turns in conversations
  const labeledEvalRecords = [];
  conversations.forEach(c => {
    c.turns.forEach(t => {
      if (t.expectedAction) {
        // Find predicted action in A3
        const rec = recordsA3.find(r => r.convId === c.id && r.turnId === t.turnId);
        labeledEvalRecords.push({
          queryId: `${c.id}_${t.turnId}`,
          predicted: rec?.predictedAction || 'carry',
          expected: t.expectedAction
        });
      }
    });
  });

  console.log(` Human Transition Annotations: ${labeledEvalRecords.length}/70 turns labeled in data/conversations.json.`);
  if (labeledEvalRecords.length > 0) {
    const clfMetrics = evaluateDecisionClassification(labeledEvalRecords);
    console.table([
      { Class: 'carry', Precision: clfMetrics.perClass.carry.precision, Recall: clfMetrics.perClass.carry.recall, F1: clfMetrics.perClass.carry.f1, Support: clfMetrics.perClass.carry.support },
      { Class: 'entity_switch', Precision: clfMetrics.perClass.entity_switch.precision, Recall: clfMetrics.perClass.entity_switch.recall, F1: clfMetrics.perClass.entity_switch.f1, Support: clfMetrics.perClass.entity_switch.support },
      { Class: 'reset', Precision: clfMetrics.perClass.reset.precision, Recall: clfMetrics.perClass.reset.recall, F1: clfMetrics.perClass.reset.f1, Support: clfMetrics.perClass.reset.support }
    ]);
    console.log(` Macro-F1: ${clfMetrics.macroF1.toFixed(4)}, Overall Accuracy: ${(clfMetrics.accuracy * 100).toFixed(1)}%`);
  } else {
    console.log(' [Notice] Annotations in progress in eval/output/shift_labeling_sheet.csv.');
    console.log('          Classifier Precision, Recall, and Confusion Matrix will evaluate upon annotation commit.');
  }

  // Diagnostic comparison on Dev Split (6 conversations, 30 turns)
  console.log('\n Diagnostic Comparison on Dev Split (6 Conversations, 30 Turns):');
  const splitsPath = CONFIG.paths.splitsFile;
  let devConvIds = new Set();
  if (fs.existsSync(splitsPath)) {
    const splits = JSON.parse(fs.readFileSync(splitsPath, 'utf8'));
    devConvIds = new Set(splits.dev.conversationIds);
  }

  const devConversations = conversations.filter(c => devConvIds.has(c.id));
  let legacyResets = 0;
  let legacyCarries = 0;
  let newResets = 0;
  let newSwitches = 0;
  let newCarries = 0;
  let rescuedFollowUps = 0;

  for (const conv of devConversations) {
    const legacyState = new ContextState({ mode: 'v1' });
    const newState = new ContextState({ mode: 'v2' });

    for (let i = 0; i < conv.turns.length; i++) {
      const turn = conv.turns[i];
      if (i === 0) {
        legacyState.update(turn.query, [], index);
        const entityCands = extractEntityCandidates(turn.query, index);
        const aspectCands = extractAspectTerms(turn.query, entityCands, index);
        newState.updateV2({
          decision: 'CARRY',
          rawQuery: turn.query,
          entityCandidates: entityCands,
          aspectCandidates: aspectCands
        });
        continue;
      }

      // Legacy detector
      const legacyDecision = legacyDetectTopicShift(turn.query, legacyState.getVector(), index);
      const legAction = (legacyDecision.decision || '').toLowerCase();
      if (legAction === 'reset') {
        legacyResets++;
        legacyState.reset();
      } else {
        legacyCarries++;
      }
      legacyState.update(turn.query, [], index);

      // New transition detector
      const lockedEntities = newState.getLockedEntities();
      const contextTerms = newState.getAllContextTerms();
      const newDecision = detectConversationalDecision(turn.query, lockedEntities, contextTerms, index);
      const decStr = (newDecision.decision || '').toLowerCase();
      if (decStr === 'reset') newResets++;
      else if (decStr === 'entity_switch') newSwitches++;
      else newCarries++;

      // Check if turn was a false reset under legacy rescued by new rule
      if (legAction === 'reset' && decStr === 'carry' && !turn.isShift) {
        rescuedFollowUps++;
      }

      const entityCands = extractEntityCandidates(turn.query, index);
      const aspectCands = extractAspectTerms(turn.query, entityCands, index);
      newState.updateV2({
        decision: newDecision.decision,
        rawQuery: turn.query,
        entityCandidates: entityCands,
        aspectCandidates: aspectCands
      });
    }
  }

  console.table([
    {
      Detector: 'Legacy Cosine Shift Detector (Cosine < 0.26)',
      CARRY: legacyCarries,
      RESET: legacyResets,
      ENTITY_SWITCH: 0,
      'Follow-Ups Rescued from Reset': '-'
    },
    {
      Detector: 'New Decision Detector (Entity-Lock & Aspect Guards)',
      CARRY: newCarries,
      RESET: newResets,
      ENTITY_SWITCH: newSwitches,
      'Follow-Ups Rescued from Reset': `${rescuedFollowUps} turns`
    }
  ]);
  console.log(` [Key Audit Finding]: Legacy cosine threshold erroneously reset ${rescuedFollowUps} topical follow-ups on dev.`);
  console.log('                      New decision detector preserves entity continuity via pronoun & entity guards.');

  // 6. Documented Limitation & Failure Case Analysis
  console.log('\n------------------------------------------------------------------------');
  console.log(' Table 6: Documented Failure Case & Boundary Condition Analysis');
  console.log('------------------------------------------------------------------------');
  console.table([
    {
      Case: 'Limitation Case (Vocabulary Drift)',
      Conversation: 'Conv 14 (Thermodynamics & Information Theory)',
      Turn: 'Turn 4: "Is entropy always conserved in physical processes?"',
      FailureMode: 'Carried "shannon" and "bits" from previous turn into thermodynamic query',
      RootCause: 'Aspect replacement requires distinct lexical cue; polysemous "entropy" crossed domains'
    },
    {
      Case: 'Boundary Case (Candidate Scarcity)',
      Conversation: 'Rare / High-Specificity Queries',
      Turn: 'Any turn where title Boolean AND yields < 10 matches',
      FailureMode: 'Hard-lock title filter gracefully falls back to soft retrieval',
      RootCause: 'Guarantees top-10 candidate pool is never starved while preserving soft entity boost'
    }
  ]);

  // 7. Statistical Significance Setup & Execution (F-06)
  if (fs.existsSync(splitsPath)) {
    const splits = JSON.parse(fs.readFileSync(splitsPath, 'utf8'));
    console.log('\n------------------------------------------------------------------------');
    console.log(' Table 7: Statistical Significance Testing Protocol (Seed 42, 2000 Boots)');
    console.log('------------------------------------------------------------------------');

    if (totalJudgedTurns > 0) {
      const testConvSet = new Set(splits.test.conversationIds);
      const testRecordsA3 = recordsA3.filter(r => testConvSet.has(r.convId));
      const testRecordsA0 = recordsA0.filter(r => testConvSet.has(r.convId));
      const testRecordsS0 = benchmarkResults.S0.turnRecords.filter(r => testConvSet.has(r.convId));

      const sigA3vsA0 = compareSystems(testRecordsA3, testRecordsA0, 'ndcg10');
      const sigA3vsS0 = compareSystems(testRecordsA3, testRecordsS0, 'ndcg10');

      console.table([
        {
          Comparison: 'A3 (Headline) vs A0 (Legacy Bag)',
          Metric: 'nDCG@10',
          Delta: sigA3vsA0.bootstrap.delta,
          'Bootstrap p-value': `${sigA3vsA0.bootstrap.pValue} (n=${sigA3vsA0.bootstrap.sampleCount})`,
          '95% CI': `[${sigA3vsA0.bootstrap.ciLower}, ${sigA3vsA0.bootstrap.ciUpper}]`,
          'Wilcoxon p-value': `${sigA3vsA0.wilcoxon.pValue}`,
          Significant: sigA3vsA0.bootstrap.isSignificant
        },
        {
          Comparison: 'A3 (Headline) vs S0 (Raw Query)',
          Metric: 'nDCG@10',
          Delta: sigA3vsS0.bootstrap.delta,
          'Bootstrap p-value': `${sigA3vsS0.bootstrap.pValue} (n=${sigA3vsS0.bootstrap.sampleCount})`,
          '95% CI': `[${sigA3vsS0.bootstrap.ciLower}, ${sigA3vsS0.bootstrap.ciUpper}]`,
          'Wilcoxon p-value': `${sigA3vsS0.wilcoxon.pValue}`,
          Significant: sigA3vsS0.bootstrap.isSignificant
        }
      ]);
    } else {
      console.log(' [Notice] Significance testing ready to execute automatically once human judgments are populated.');
      console.log('          Evaluates paired bootstrap and Wilcoxon signed-rank tests across test split (40 turns).');
    }
  }

  // 8. Export artifacts to disk
  exportEvaluationArtifacts(benchmarkResults, conversations, qrels);

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
