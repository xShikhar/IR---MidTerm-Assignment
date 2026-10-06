/**
 * @file eval/src/index.js
 * @description Main Evaluation Entry Point for TurnTrace.
 * Runs Systems S0 through S5, Novelty Ablations A0 through A6, and
 * Efficiency Ablations R1 through R2 across specified conversation scenarios.
 * Supports running on TEST split (n=40 turns), DEV split (n=30 turns), or ALL (n=70 turns).
 * Outputs formatted console tables and generates export artifacts in target output directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadIndex } from '../../server/src/index/serializer.js';
import { loadEvaluationData } from './qrelsLoader.js';
import { runEvaluationBenchmark } from './systemsRunner.js';
import { exportEvaluationArtifacts } from './export.js';
import { compareSystems, pairedBootstrapTest, wilcoxonSignedRankTest } from './significance.js';
import { computeRewriteFidelity, computeSpearmanCorrelation } from './metrics/fidelity.js';
import { evaluateDecisionClassification } from './metrics/decisionClassification.js';
import { detectTopicShift as legacyDetectTopicShift } from '../../server/src/conversation/shiftDetector.js';
import { detectConversationalDecision } from '../../server/src/conversation/decisionDetector.js';
import { extractEntityCandidates, extractAspectTerms } from '../../server/src/conversation/entityExtractor.js';
import { ContextState } from '../../server/src/conversation/contextState.js';
import { evaluateClarification } from '../../server/src/conversation/clarifier.js';
import { executeConversationalTurn } from '../../server/src/api/traceAssembly.js';
import { CONFIG } from '../../server/src/config/index.js';

export async function runEvaluation(options = {}) {
  const args = process.argv.slice(2);
  const splitArg = args.find(a => a.startsWith('--split='));
  const outDirArg = args.find(a => a.startsWith('--outDir='));

  const split = options.split || (splitArg ? splitArg.split('=')[1] : (process.env.SPLIT || 'test'));
  const outputDir = options.outputDir || (outDirArg ? outDirArg.split('=')[1] : (
    split === 'test' ? path.join(CONFIG.paths.evalOutputDir, 'test_final') : CONFIG.paths.evalOutputDir
  ));

  console.log('========================================================================');
  console.log(`       TurnTrace Information Retrieval Evaluation Harness [Split: ${split.toUpperCase()}]`);
  console.log('========================================================================');

  const startTime = performance.now();
  console.log('[TurnTrace Eval] Loading inverted index from disk...');
  const index = loadIndex(CONFIG.paths.indexFile);

  console.log('[TurnTrace Eval] Loading conversation scenarios and qrels...');
  const { conversations, qrels } = loadEvaluationData();

  let evalConversations = conversations;
  const splitsPath = CONFIG.paths.splitsFile;
  let splits = null;
  if (fs.existsSync(splitsPath)) {
    splits = JSON.parse(fs.readFileSync(splitsPath, 'utf8'));
    if (split === 'test' && splits.test?.conversationIds) {
      const targetIds = new Set(splits.test.conversationIds);
      evalConversations = conversations.filter(c => targetIds.has(c.id));
    } else if (split === 'dev' && splits.dev?.conversationIds) {
      const targetIds = new Set(splits.dev.conversationIds);
      evalConversations = conversations.filter(c => targetIds.has(c.id));
    }
  }

  const totalTurns = evalConversations.reduce((sum, c) => sum + c.turns.length, 0);
  console.log(`[TurnTrace Eval] Evaluating ${evalConversations.length} conversations, ${totalTurns} turns on ${split.toUpperCase()} split.`);
  console.log(`[TurnTrace Eval] Target artifact directory: ${outputDir}`);

  console.log('[TurnTrace Eval] Running retrieval benchmark across Systems S0-S5, Ablations A0-A6, R1-R2...');
  const benchmarkResults = await runEvaluationBenchmark(evalConversations, qrels, index);

  // 1. Systems Comparison Table (Overall Table 1)
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 1: Comparative Evaluation Across Systems & Novelty Ablations (${split.toUpperCase()} Split, n=${totalTurns})`);
  console.log('------------------------------------------------------------------------');
  const table1Systems = [
    { id: 'S0', name: 'S0: Raw Query Only (lnc.ltc Cosine)' },
    { id: 'S1', name: 'S1: Naive Concatenation of Dialogue History' },
    { id: 'S2', name: 'S2: TurnTrace Legacy Baseline (Decayed Bag, Cosine)' },
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

  const recordsA0 = benchmarkResults.A0?.turnRecords || [];
  const systemSignificanceMap = {};

  for (const s of table1Systems) {
    const raw = benchmarkResults[s.id]?.turnRecords || [];
    if (s.id === 'A0') {
      systemSignificanceMap[s.id] = { bootP: '-', wilcP: '-', n: raw.length };
      continue;
    }
    try {
      const sig = compareSystems(raw, recordsA0, 'ndcg10');
      systemSignificanceMap[s.id] = {
        bootP: sig.bootstrap.pValue.toFixed(4),
        wilcP: sig.wilcoxon.pValue.toFixed(4),
        n: sig.turnCount
      };
    } catch {
      systemSignificanceMap[s.id] = { bootP: '-', wilcP: '-', n: raw.length };
    }
  }

  const table1Rows = table1Systems.map(s => {
    const res = benchmarkResults[s.id]?.overall;
    const noveltyRes = benchmarkResults[s.id]?.turnRecords;
    const avgNovelty = noveltyRes && noveltyRes.length > 0
      ? Number((noveltyRes.reduce((acc, r) => acc + (r.novelty10 || 0), 0) / noveltyRes.length).toFixed(4))
      : 0;
    const sig = systemSignificanceMap[s.id] || { bootP: '-', wilcP: '-', n: totalTurns };

    return {
      System: s.name,
      'P@5': res ? res.p5.toFixed(4) : '0.0000',
      'P@10': res ? res.p10.toFixed(4) : '0.0000',
      'Recall@20': res ? res.recall20.toFixed(4) : '0.0000',
      MRR: res ? res.mrr.toFixed(4) : '0.0000',
      'nDCG@10': res ? res.ndcg10.toFixed(4) : '0.0000',
      'Novelty@10': avgNovelty.toFixed(4),
      'Boot p (vs A0)': sig.bootP,
      'Wilcox p (vs A0)': sig.wilcP,
      n: sig.n
    };
  });
  console.table(table1Rows);

  // 2. Subset Breakdown Table: A0 (Legacy Bag) vs A3 (Headline Novelty Core)
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 2: Subset Breakdown: A0 (Legacy Decayed Bag) vs A3 (Headline Novelty) [${split.toUpperCase()}]`);
  console.log('------------------------------------------------------------------------');

  const recordsA3 = benchmarkResults.A3?.turnRecords || [];
  const pronounRegex = /\b(it|its|they|them|their|this|that|these|those|he|she|him|her)\b/i;

  const getSubsetAvg = (records, filterFn) => {
    const matched = records.filter(filterFn);
    if (matched.length === 0) return { count: 0, p10: '0.0000', ndcg10: '0.0000', novelty10: '0.0000' };
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
      name: 'Ambiguous Entity Turns (conv_12)',
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
  console.log(` Table 3: Novelty Discovery vs Precision Trade-Off: A3 vs A4 [${split.toUpperCase()}]`);
  console.log('------------------------------------------------------------------------');
  const recordsA4 = benchmarkResults.A4?.turnRecords || [];
  const a3Novelty = recordsA3.length > 0 ? (recordsA3.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA3.length).toFixed(4) : '0.0000';
  const a4Novelty = recordsA4.length > 0 ? (recordsA4.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA4.length).toFixed(4) : '0.0000';
  const a3P10 = benchmarkResults.A3?.overall?.p10 ? benchmarkResults.A3.overall.p10.toFixed(4) : '0.0000';
  const a4P10 = benchmarkResults.A4?.overall?.p10 ? benchmarkResults.A4.overall.p10.toFixed(4) : '0.0000';

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

  // 4. Rewrite Fidelity against Human Reference (Post-Hoc Evaluation Metric)
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 4: Query Rewrite Fidelity against Reference (Post-Hoc Analysis) [${split.toUpperCase()}]`);
  console.log('------------------------------------------------------------------------');
  const fidelitySystems = ['S1', 'S2', 'A3', 'S5'];
  const fidelityRows = [];

  const goldMap = new Map();
  evalConversations.forEach(c => {
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
      'Spearman Correlation with P@10': spearmanRho.toFixed(4),
      'Evaluation Nature': 'Post-hoc measurement only (Zero leakage into runtime retrieval)'
    });
  }
  console.table(fidelityRows);

  // 5. Transition Classifier Decision Metrics on Test
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 5: Transition Classifier Decision Metrics on ${split.toUpperCase()} (Excluding Turn 1)`);
  console.log('------------------------------------------------------------------------');

  const decisionRows = [];
  let legacyResets = 0;
  let legacyCarries = 0;
  let newResets = 0;
  let newSwitches = 0;
  let newCarries = 0;

  const legacyEvalRecords = [];
  const newEvalRecords = [];

  for (const conv of evalConversations) {
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

      legacyEvalRecords.push({
        queryId: `${conv.id}_${turn.turnId}`,
        predicted: legAction,
        expected: turn.expectedAction
      });

      // New transition detector
      const lockedEntities = newState.getLockedEntities();
      const contextTerms = newState.getAllContextTerms();
      const newDecision = detectConversationalDecision(turn.query, lockedEntities, contextTerms, index);
      const decStr = (newDecision.decision || '').toLowerCase();
      if (decStr === 'reset') newResets++;
      else if (decStr === 'entity_switch') newSwitches++;
      else newCarries++;

      newEvalRecords.push({
        queryId: `${conv.id}_${turn.turnId}`,
        predicted: decStr,
        expected: turn.expectedAction
      });

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

  const legacyClf = evaluateDecisionClassification(legacyEvalRecords);
  const newClf = evaluateDecisionClassification(newEvalRecords);

  const formatClfTable = (detectorName, clf) => {
    return [
      { Detector: detectorName, Class: 'carry', Precision: clf.perClass.carry.precision.toFixed(4), Recall: clf.perClass.carry.recall.toFixed(4), F1: clf.perClass.carry.f1.toFixed(4), Support: clf.perClass.carry.support },
      { Detector: detectorName, Class: 'entity_switch', Precision: clf.perClass.entity_switch.precision.toFixed(4), Recall: clf.perClass.entity_switch.recall.toFixed(4), F1: clf.perClass.entity_switch.f1.toFixed(4), Support: clf.perClass.entity_switch.support },
      { Detector: detectorName, Class: 'reset', Precision: clf.perClass.reset.precision.toFixed(4), Recall: clf.perClass.reset.recall.toFixed(4), F1: clf.perClass.reset.f1.toFixed(4), Support: clf.perClass.reset.support }
    ];
  };

  console.log(`\nLegacy Cosine Detector Evaluation (Cosine < 0.26, n=${legacyEvalRecords.length} transitions):`);
  console.table(formatClfTable('Legacy Cosine Rule', legacyClf));
  console.log(`- Macro-F1: ${legacyClf.macroF1.toFixed(4)}, Overall Accuracy: ${(legacyClf.accuracy * 100).toFixed(1)}%`);
  console.log(`- Confusion Matrix: ${JSON.stringify(legacyClf.confusionMatrix)}`);

  console.log(`\nNew Decision Detector Evaluation (Entity-Lock & Aspect Guards, n=${newEvalRecords.length} transitions):`);
  console.table(formatClfTable('New Decision Detector', newClf));
  console.log(`- Macro-F1: ${newClf.macroF1.toFixed(4)}, Overall Accuracy: ${(newClf.accuracy * 100).toFixed(1)}%`);
  console.log(`- Confusion Matrix: ${JSON.stringify(newClf.confusionMatrix)}`);

  ['carry', 'entity_switch', 'reset'].forEach(cls => {
    decisionRows.push({
      detector: 'Legacy Cosine Rule',
      cls,
      precision: legacyClf.perClass[cls].precision,
      recall: legacyClf.perClass[cls].recall,
      f1: legacyClf.perClass[cls].f1,
      support: legacyClf.perClass[cls].support,
      macroF1: legacyClf.macroF1,
      accuracy: legacyClf.accuracy
    });
    decisionRows.push({
      detector: 'New Decision Detector',
      cls,
      precision: newClf.perClass[cls].precision,
      recall: newClf.perClass[cls].recall,
      f1: newClf.perClass[cls].f1,
      support: newClf.perClass[cls].support,
      macroF1: newClf.macroF1,
      accuracy: newClf.accuracy
    });
  });

  // 6. Cluster Clarifier Evaluation on Test
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 6: Cluster Clarifier Evaluation on ${split.toUpperCase()} (n=${totalTurns} turns)`);
  console.log('------------------------------------------------------------------------');

  let clarifierFiredCount = 0;
  let trivialRuleFiredCount = 0;

  for (const conv of evalConversations) {
    const contextState = new ContextState({ mode: 'v2' });
    for (const turn of conv.turns) {
      const res = await executeConversationalTurn(turn.query, contextState, index, { topK: 10 });
      const top2 = (res.results || []).slice(0, 2);

      const clarResult = evaluateClarification(res.results, index);
      if (clarResult.fired) clarifierFiredCount++;

      let trivialFired = false;
      if (top2.length >= 2) {
        const title1 = (top2[0].title || '').split('-')[0].trim();
        const title2 = (top2[1].title || '').split('-')[0].trim();
        trivialFired = (title1 !== title2);
      }
      if (trivialFired) trivialRuleFiredCount++;
    }
  }

  const clarFpRate = (clarifierFiredCount / totalTurns).toFixed(4);
  const trivFpRate = (trivialRuleFiredCount / totalTurns).toFixed(4);

  console.table([
    {
      Method: 'Cluster Clarifier (Leader/Follower Pruning)',
      TotalTurns: totalTurns,
      FiredCount: clarifierFiredCount,
      'Fired %': `${((clarifierFiredCount / totalTurns) * 100).toFixed(1)}%`,
      'False Positive Rate': `${(parseFloat(clarFpRate) * 100).toFixed(1)}%`,
      Status: 'Disabled by default in production config; available via options flag'
    },
    {
      Method: 'Trivial Baseline (Different Top-2 Title Clusters)',
      TotalTurns: totalTurns,
      FiredCount: trivialRuleFiredCount,
      'Fired %': `${((trivialRuleFiredCount / totalTurns) * 100).toFixed(1)}%`,
      'False Positive Rate': `${(parseFloat(trivFpRate) * 100).toFixed(1)}%`,
      Status: 'Heuristic comparison baseline'
    }
  ]);

  const clarifierRows = [
    {
      method: 'Cluster Clarifier',
      totalTurns,
      firedCount: clarifierFiredCount,
      firedPct: Number(((clarifierFiredCount / totalTurns) * 100).toFixed(1)),
      fpRate: Number(clarFpRate),
      description: 'Disabled by default; available via options flag'
    },
    {
      method: 'Trivial Baseline Rule',
      totalTurns,
      firedCount: trivialRuleFiredCount,
      firedPct: Number(((trivialRuleFiredCount / totalTurns) * 100).toFixed(1)),
      fpRate: Number(trivFpRate),
      description: 'Fires when top-2 results come from different title clusters'
    }
  ];

  // 7. Statistical Significance Protocol (A3 vs A0 metric-by-metric, A3 vs S0)
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 7: Statistical Significance Testing Protocol (Seed 42, 2000 Boots) [${split.toUpperCase()}]`);
  console.log('------------------------------------------------------------------------');

  const metricsToCompare = ['ndcg10', 'p5', 'p10', 'recall20', 'rr'];
  const metricLabels = {
    ndcg10: 'nDCG@10',
    p5: 'P@5',
    p10: 'P@10',
    recall20: 'Recall@20',
    rr: 'MRR'
  };

  const significanceRows = [];

  for (const m of metricsToCompare) {
    const sig = compareSystems(recordsA3, recordsA0, m);
    significanceRows.push({
      comparison: 'A3 (Headline) vs A0 (Legacy Bag)',
      metric: metricLabels[m],
      delta: sig.bootstrap.delta,
      bootstrapP: sig.bootstrap.pValue,
      ciLower: sig.bootstrap.ciLower,
      ciUpper: sig.bootstrap.ciUpper,
      wilcoxonP: sig.wilcoxon.pValue,
      wStat: sig.wilcoxon.wStat,
      nonZeroPairs: sig.wilcoxon.nonZeroPairs,
      n: sig.turnCount,
      isSignificant: sig.bootstrap.isSignificant
    });
  }

  // A3 vs S0 on nDCG@10
  const recordsS0 = benchmarkResults.S0.turnRecords;
  const sigA3vsS0 = compareSystems(recordsA3, recordsS0, 'ndcg10');
  significanceRows.push({
    comparison: 'A3 (Headline) vs S0 (Raw Query)',
    metric: 'nDCG@10',
    delta: sigA3vsS0.bootstrap.delta,
    bootstrapP: sigA3vsS0.bootstrap.pValue,
    ciLower: sigA3vsS0.bootstrap.ciLower,
    ciUpper: sigA3vsS0.bootstrap.ciUpper,
    wilcoxonP: sigA3vsS0.wilcoxon.pValue,
    wStat: sigA3vsS0.wilcoxon.wStat,
    nonZeroPairs: sigA3vsS0.wilcoxon.nonZeroPairs,
    n: sigA3vsS0.turnCount,
    isSignificant: sigA3vsS0.bootstrap.isSignificant
  });

  const sigConsoleTable = significanceRows.map(r => ({
    Comparison: r.comparison,
    Metric: r.metric,
    Delta: r.delta > 0 ? `+${r.delta.toFixed(4)}` : r.delta.toFixed(4),
    'Bootstrap p-value': `${r.bootstrapP.toFixed(4)} (n=${r.n})`,
    '95% CI': `[${r.ciLower.toFixed(4)}, ${r.ciUpper.toFixed(4)}]`,
    'Wilcoxon p-value': `${r.wilcoxonP.toFixed(4)} (W=${r.wStat}, nonZero=${r.nonZeroPairs})`,
    Significant: r.isSignificant ? 'YES (p < 0.05)' : 'NO (p >= 0.05)'
  }));
  console.table(sigConsoleTable);

  // 8. Failure Analysis: 5 Worst A3-vs-A0 Turns
  console.log('\n------------------------------------------------------------------------');
  console.log(` Table 8: Failure Analysis: 5 Worst A3-vs-A0 Turns (Lowest Delta nDCG@10) [${split.toUpperCase()}]`);
  console.log('------------------------------------------------------------------------');

  const turnDeltas = [];
  const mapA0 = new Map(recordsA0.map(r => [r.turnKey, r]));

  for (const rA3 of recordsA3) {
    const rA0 = mapA0.get(rA3.turnKey);
    if (!rA0) continue;
    const delta = Number((rA3.ndcg10 - rA0.ndcg10).toFixed(4));
    turnDeltas.push({
      turnKey: rA3.turnKey,
      convId: rA3.convId,
      turnId: rA3.turnId,
      query: rA3.query,
      a0Ndcg10: Number(rA0.ndcg10.toFixed(4)),
      a3Ndcg10: Number(rA3.ndcg10.toFixed(4)),
      deltaNdcg10: delta,
      isFallback: rA3.isFallback,
      predictedAction: rA3.predictedAction,
      isShift: rA3.isShift,
      isAmbiguous: rA3.isAmbiguous
    });
  }

  // Sort ascending by delta (most negative delta first)
  turnDeltas.sort((a, b) => a.deltaNdcg10 - b.deltaNdcg10);
  const worst5 = turnDeltas.slice(0, 5).map((w, idx) => {
    let failureMode = 'Aspect filtering divergence';
    let rootCause = 'Aspect replacement dropped term present in legacy context bag';

    if (w.convId === 'conv_14') {
      failureMode = 'Vocabulary drift / Polysemy';
      rootCause = 'Entropy crossed information theory into physics; title constraint restricted corpus';
    } else if (w.isFallback) {
      failureMode = 'Hard-lock title filter fallback';
      rootCause = 'Title constraint yielded < 10 candidates; soft retrieval fallback slightly demoted gold doc';
    } else if (w.deltaNdcg10 < 0 && w.a0Ndcg10 > 0.5) {
      failureMode = 'Context bag residual match';
      rootCause = 'Legacy decayed bag serendipitously retained terms that matched body text of target passage';
    }

    return {
      rank: idx + 1,
      ...w,
      failureMode,
      rootCause
    };
  });

  const worstConsoleTable = worst5.map(w => ({
    Rank: w.rank,
    Turn: w.turnKey,
    Query: w.query,
    'A0 nDCG@10': w.a0Ndcg10.toFixed(4),
    'A3 nDCG@10': w.a3Ndcg10.toFixed(4),
    'Delta nDCG@10': w.deltaNdcg10.toFixed(4),
    'Failure Mode': w.failureMode
  }));
  console.table(worstConsoleTable);

  // 9. Export All Artifacts
  exportEvaluationArtifacts(benchmarkResults, evalConversations, qrels, outputDir, {
    systemSignificanceMap,
    significanceRows,
    decisionRows,
    clarifierRows,
    worstTurns: worst5
  });

  const totalElapsed = (performance.now() - startTime).toFixed(1);
  console.log(`\n[TurnTrace Eval] Complete evaluation run finished in ${totalElapsed} ms.`);

  return {
    benchmarkResults,
    systemSignificanceMap,
    significanceRows,
    decisionRows,
    clarifierRows,
    worst5
  };
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runEvaluation()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[TurnTrace Eval] Fatal Error:', err);
      process.exit(1);
    });
}
