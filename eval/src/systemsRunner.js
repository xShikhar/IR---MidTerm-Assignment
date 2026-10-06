/**
 * @file eval/src/systemsRunner.js
 * @description Benchmark Harness for TurnTrace.
 * Executes Systems S0-S5, Retrieval Efficiency Ablations R1-R2, and
 * Novelty Ablations A0-A6 over conversation scenarios.
 *
 * System Taxonomy:
 * - S0: Raw query only (lnc.ltc Cosine)
 * - S1: Naive concatenation of user query history
 * - S2 / A0: Legacy Decayed Context Bag (baseline)
 * - S3: Full TurnTrace with Clarification & Decomposition
 * - S5: Oracle Gold Rewrite (Upper Bound; ONLY system permitted to read oracle queries)
 * - R1: Champion Lists ON (r=50)
 * - R2: Index Elimination ON (low-IDF pruning)
 * - A1: Entity soft boost + aspect replacement
 * - A2: Hard lock + aspect accumulation
 * - A3: Hard lock + aspect replacement (HEADLINE)
 * - A4: A3 + Seen-passage penalty
 * - A5: A3 with always-carry (decision isolation)
 * - A6: A3 with always-reset (decision isolation)
 */

import { executeRetrieval } from '../../server/src/retrieval/engine.js';
import { executeConversationalTurn } from '../../server/src/api/traceAssembly.js';
import { ContextState } from '../../server/src/conversation/contextState.js';
import { SeenPassageTracker } from '../../server/src/retrieval/seenPenalty.js';
import { computePrecisionAtK, computeRecallAtK, computeReciprocalRank, computeNdcgAtK } from './metrics.js';
import { computeNoveltyAtK } from './metrics/noveltyAtK.js';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Runs a single conversation session for a given system configuration.
 */
async function evaluateSession(conv, qrels, index, systemId) {
  const historyQueries = [];
  const turnRecords = [];
  const seenDocIds = new Set();

  // Instantiate isolated ContextState per session
  let contextMode = 'v2';
  let accumulateAspects = false;

  if (systemId === 'S2' || systemId === 'A0') {
    contextMode = 'v1';
  } else if (systemId === 'A2') {
    accumulateAspects = true;
  }

  const contextState = new ContextState({
    mode: contextMode,
    accumulateAspects
  });

  const seenTracker = new SeenPassageTracker(CONFIG.novelty.seen.penalty);
  let aspectChangeCounter = 0;
  let previousAspects = [];

  for (let i = 0; i < conv.turns.length; i++) {
    const turn = conv.turns[i];
    const turnKey = `${conv.id}_${turn.turnId}`;
    const turnQrels = qrels[turnKey] || {};

    let rankedList = [];
    let trace = null;
    let clarifyingFired = false;

    if (systemId === 'S0') {
      // S0: Raw query only
      const res = executeRetrieval(turn.query, index, { topK: 20 });
      rankedList = res.results;
      trace = res.trace;
    } else if (systemId === 'S1') {
      // S1: Naive concatenation of user queries
      const concatenated = [...historyQueries, turn.query].join(' ');
      const res = executeRetrieval(concatenated, index, { topK: 20 });
      rankedList = res.results;
      trace = res.trace;
    } else if (systemId === 'S5') {
      // S5: Oracle Gold Rewrite (ONLY system permitted to read goldRewrite)
      const res = executeRetrieval(turn.goldRewrite, index, { topK: 20 });
      rankedList = res.results;
      trace = res.trace;
    } else {
      // Conversational systems executing through central executeConversationalTurn
      let turnOptions = { topK: 20 };

      if (systemId === 'S2' || systemId === 'A0') {
        // A0 / S2: Legacy Decayed Context Bag Baseline
        turnOptions = {
          ...turnOptions,
          architecture: 'legacy',
          disableDecomposition: true
        };
      } else if (systemId === 'S3') {
        // S3: Full Headline System with seen penalty and clarification
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard',
          applySeenPenalty: true,
          seenTracker
        };
      } else if (systemId === 'A1') {
        // Ablation A1: Entity soft boost + aspect replacement
        turnOptions = {
          ...turnOptions,
          lockMode: 'soft',
          entityBoost: 2.0
        };
      } else if (systemId === 'A2') {
        // Ablation A2: Hard lock + aspect accumulation
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard'
        };
      } else if (systemId === 'A3') {
        // Ablation A3: Hard lock + aspect replacement (Headline without seen penalty)
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard'
        };
      } else if (systemId === 'A4') {
        // Ablation A4: A3 + Seen-passage penalty
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard',
          applySeenPenalty: true,
          seenTracker
        };
      } else if (systemId === 'A5') {
        // Ablation A5: A3 with always-carry (decision isolation)
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard',
          forcedDecision: 'CARRY'
        };
      } else if (systemId === 'A6') {
        // Ablation A6: A3 with always-reset (decision isolation)
        turnOptions = {
          ...turnOptions,
          lockMode: 'hard',
          forcedDecision: 'reset'
        };
      } else if (systemId === 'R1') {
        // Retrieval Ablation R1: Champion lists ON
        turnOptions = {
          ...turnOptions,
          useChampionLists: true
        };
      } else if (systemId === 'R2') {
        // Retrieval Ablation R2: Index elimination ON
        turnOptions = {
          ...turnOptions,
          applyIndexElimination: true
        };
      }

      const convRes = await executeConversationalTurn(turn.query, contextState, index, turnOptions);
      rankedList = convRes.results;
      trace = convRes.trace;
      clarifyingFired = trace.clarification?.fired || false;
    }

    historyQueries.push(turn.query);

    // Track aspect changes across turns
    const currentAspects = trace?.entityLock?.aspectTerms?.map(a => a.term) || [];
    if (i > 0 && currentAspects.length > 0 && previousAspects.length > 0) {
      const isChanged = currentAspects.some(a => !previousAspects.includes(a));
      if (isChanged) aspectChangeCounter++;
    }
    previousAspects = currentAspects;

    // Metrics for this turn
    const p5 = computePrecisionAtK(rankedList, turnQrels, 5);
    const p10 = computePrecisionAtK(rankedList, turnQrels, 10);
    const recall20 = computeRecallAtK(rankedList, turnQrels, 20);
    const rr = computeReciprocalRank(rankedList, turnQrels);
    const ndcg10 = computeNdcgAtK(rankedList, turnQrels, 10);

    // Novelty@10
    const noveltyRes = computeNoveltyAtK(rankedList, seenDocIds, 10);
    rankedList.slice(0, 10).forEach(r => seenDocIds.add(r.docId));

    const rewrittenQuery = trace?.rewriter?.rewrittenQuery || turn.query;

    // Decision label
    const predictedAction = trace?.entityLock?.decision || trace?.shiftDecision?.decision || 'CARRY';
    const isFallback = Boolean(trace?.entityLock?.fallback);

    turnRecords.push({
      convId: conv.id,
      turnId: turn.turnId,
      turnKey,
      turnIndex: i + 1,
      isShift: turn.isShift,
      isAmbiguous: turn.isAmbiguous,
      isDecomposable: turn.isDecomposable,
      query: turn.query,
      rewrittenQuery,
      clarifyingFired,
      p5,
      p10,
      recall20,
      rr,
      ndcg10,
      novelty10: noveltyRes.noveltyAtK,
      predictedAction,
      isFallback,
      aspectChangesSoFar: aspectChangeCounter,
      trace
    });
  }

  return turnRecords;
}

/**
 * Aggregates metric records across a list of turns.
 */
function aggregateMetrics(records) {
  if (!records || records.length === 0) {
    return {
      turnsCount: 0,
      p5: 0,
      p10: 0,
      recall20: 0,
      mrr: 0,
      ndcg10: 0,
      novelty10: 0,
      fidelity: 0,
      clarificationRate: 0
    };
  }

  const n = records.length;
  const sum = (field) => records.reduce((acc, r) => acc + (r[field] || 0), 0);

  return {
    turnsCount: n,
    p5: Number((sum('p5') / n).toFixed(4)),
    p10: Number((sum('p10') / n).toFixed(4)),
    recall20: Number((sum('recall20') / n).toFixed(4)),
    mrr: Number((sum('rr') / n).toFixed(4)),
    ndcg10: Number((sum('ndcg10') / n).toFixed(4)),
    novelty10: Number((sum('novelty10') / n).toFixed(4)),
    fidelity: Number((sum('fidelity') / n).toFixed(4)),
    clarificationRate: Number(((records.filter(r => r.clarifyingFired).length / n) * 100).toFixed(1))
  };
}

/**
 * Runs complete benchmark evaluation across all systems.
 *
 * @param {Array<Object>} conversations
 * @param {Record<string, Record<string, number>>} qrels
 * @param {Object} index
 * @returns {Promise<Object>} Full evaluation results
 */
export async function runEvaluationBenchmark(conversations, qrels, index) {
  const systems = ['S0', 'S1', 'S2', 'S3', 'S5', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'R1', 'R2'];
  const resultsBySystem = {};

  for (const sysId of systems) {
    let allRecords = [];
    for (const conv of conversations) {
      const records = await evaluateSession(conv, qrels, index, sysId);
      allRecords = allRecords.concat(records);
    }

    resultsBySystem[sysId] = {
      overall: aggregateMetrics(allRecords),
      turnRecords: allRecords
    };
  }

  return resultsBySystem;
}
