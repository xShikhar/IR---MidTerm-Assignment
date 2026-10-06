/**
 * @file eval/src/systemsRunner.js
 * @description Experimental Systems Runner for TurnTrace.
 * Executes Systems S0 through S5 and 4 Ablation configurations across 70 judged turns.
 * Computes official metrics (P@5, P@10, Recall@20, MRR, nDCG@10, Clarification Precision).
 */

import { ContextState } from '../../server/src/conversation/contextState.js';
import { executeRetrieval } from '../../server/src/retrieval/engine.js';
import { executeConversationalTurn } from '../../server/src/api/traceAssembly.js';
import { computePrecisionAtK, computeRecallAtK, computeReciprocalRank, computeNdcgAtK } from './metrics.js';
import { rewriteWithLLM } from '../../server/src/conversation/llmAdapter.js';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Runs a single conversation session for a specific system configuration.
 *
 * @param {Object} conv - Conversation definition
 * @param {Record<string, Record<string, number>>} qrels - Relevance judgments
 * @param {Object} index - Inverted index
 * @param {string} systemId - Target system (S0, S1, S2, S3, S4, S5, A1, A2, A3, A4)
 * @returns {Promise<Array<Object>>} Per-turn evaluation records
 */
async function evaluateSession(conv, qrels, index, systemId) {
  const turnRecords = [];
  const historyQueries = [];
  const contextState = new ContextState({
    lambda: systemId === 'A3' ? 1.0 : CONFIG.conversation.context.decayLambda // Ablation A3: Decay OFF
  });

  for (let i = 0; i < conv.turns.length; i++) {
    const turn = conv.turns[i];
    const turnKey = `${conv.id}_${turn.turnId}`;
    const turnQrels = qrels[turnKey] || {};

    let rankedList = [];
    let clarifyingFired = false;

    if (systemId === 'S0') {
      // S0: Raw query only (no context)
      const res = executeRetrieval(turn.query, index, { topK: 20 });
      rankedList = res.results;
    } else if (systemId === 'S1') {
      // S1: Naive concatenation of all past user queries + current query
      const concatenated = [...historyQueries, turn.query].join(' ');
      const res = executeRetrieval(concatenated, index, { topK: 20 });
      rankedList = res.results;
    } else if (systemId === 'S2') {
      // S2: TurnTrace rewriter (decayed context terms, cosine scoring)
      const res = executeRetrieval(turn.query, index, { topK: 20 });
      // Run through conversational rewriter pipeline without decomposition
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, {
        topK: 20,
        disableDecomposition: true
      });
      rankedList = convRes.results;
      clarifyingFired = convRes.trace.clarification?.fired || false;
    } else if (systemId === 'S3') {
      // S3: Complete TurnTrace (rewriter + decomposition + RRF fusion)
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, { topK: 20 });
      rankedList = convRes.results;
      clarifyingFired = convRes.trace.clarification?.fired || false;
    } else if (systemId === 'S4') {
      // S4: Declared LLM Adapter (external LLM rewriter or pure IR fallback; never touches goldRewrite)
      const historyTurns = historyQueries.map(q => ({ role: 'user', content: q }));
      const llmResult = await rewriteWithLLM(turn.query, historyTurns, { forceEnabled: true });
      const res = executeRetrieval(llmResult.rewrittenQuery, index, { topK: 20 });
      rankedList = res.results;
    } else if (systemId === 'S5') {
      // S5: Oracle Gold Rewrite (ONLY system permitted to read goldRewrite)
      const res = executeRetrieval(turn.goldRewrite, index, { topK: 20 });
      rankedList = res.results;
    } else if (systemId === 'A1') {
      // Ablation A1: S2 with Okapi BM25 instead of lnc.ltc
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, {
        topK: 20,
        model: 'bm25',
        disableDecomposition: true
      });
      rankedList = convRes.results;
    } else if (systemId === 'A2') {
      // Ablation A2: Topic-Shift Detector OFF (forced carry)
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, {
        topK: 20,
        disableShiftDetector: true
      });
      rankedList = convRes.results;
    } else if (systemId === 'A3') {
      // Ablation A3: Exponential Decay OFF (lambda = 1.0)
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, { topK: 20 });
      rankedList = convRes.results;
    } else if (systemId === 'A4') {
      // Ablation A4: Decomposition Fusion OFF (single query only)
      const convRes = executeConversationalTurnSync(turn.query, contextState, index, {
        topK: 20,
        disableFusion: true
      });
      rankedList = convRes.results;
    }

    historyQueries.push(turn.query);

    // Compute Metrics for this turn
    const p5 = computePrecisionAtK(rankedList, turnQrels, 5);
    const p10 = computePrecisionAtK(rankedList, turnQrels, 10);
    const recall20 = computeRecallAtK(rankedList, turnQrels, 20);
    const rr = computeReciprocalRank(rankedList, turnQrels);
    const ndcg10 = computeNdcgAtK(rankedList, turnQrels, 10);

    turnRecords.push({
      convId: conv.id,
      turnId: turn.turnId,
      turnIndex: i + 1,
      isShift: turn.isShift,
      isAmbiguous: turn.isAmbiguous,
      isDecomposable: turn.isDecomposable,
      clarifyingFired,
      p5,
      p10,
      recall20,
      rr,
      ndcg10
    });
  }

  return turnRecords;
}

/**
 * Synchronous execution helper for conversational turns within benchmark loop.
 */
function executeConversationalTurnSync(query, contextState, index, options = {}) {
  const disableShift = options.disableShiftDetector || false;
  const disableDecomp = options.disableDecomposition || false;
  const disableFusion = options.disableFusion || false;
  const topK = options.topK || 20;

  // 1. Shift check
  const contextVec = contextState.getVector();
  let shiftDecision;
  if (disableShift) {
    shiftDecision = { decision: 'CARRY' };
  } else {
    // Dynamic import logic inline
    const { detectTopicShift } = requireShiftModule();
    shiftDecision = detectTopicShift(query, contextVec, index);
  }

  // 2. Rewrite
  const { rewriteQuery } = requireRewriteModule();
  const rewriteRes = rewriteQuery(query, contextState, shiftDecision.decision);

  // 3. Retrieval
  let results = [];
  let clarifRes = { fired: false };

  if (disableDecomp) {
    const ret = executeRetrieval(rewriteRes.rewrittenQuery, index, { topK, model: options.model || 'cosine' });
    results = ret.results;
  } else {
    const { decomposeAndRetrieve } = requireDecompModule();
    const decompRes = decomposeAndRetrieve(rewriteRes.rewrittenQuery, index, { topK });
    results = disableFusion ? decompRes.fusedResultsScoreSum : decompRes.fusedResultsRrf;
  }

  const { evaluateClarification } = requireClarifModule();
  clarifRes = evaluateClarification(results, index);

  // 4. Update state
  contextState.update(query, results.slice(0, 1), index);

  return {
    results,
    trace: {
      clarification: clarifRes
    }
  };
}

// Lazy loaded helper references
import { detectTopicShift as _detectShift } from '../../server/src/conversation/shiftDetector.js';
import { rewriteQuery as _rewrite } from '../../server/src/conversation/rewriter.js';
import { decomposeAndRetrieve as _decompose } from '../../server/src/conversation/decomposer.js';
import { evaluateClarification as _clarify } from '../../server/src/conversation/clarifier.js';

function requireShiftModule() { return { detectTopicShift: _detectShift }; }
function requireRewriteModule() { return { rewriteQuery: _rewrite }; }
function requireDecompModule() { return { decomposeAndRetrieve: _decompose }; }
function requireClarifModule() { return { evaluateClarification: _clarify }; }

/**
 * Aggregates turn-level records into summary evaluation metrics.
 */
function aggregateMetrics(records) {
  if (!records || records.length === 0) {
    return { count: 0, p5: 0, p10: 0, recall20: 0, mrr: 0, ndcg10: 0 };
  }

  const count = records.length;
  const p5 = records.reduce((s, r) => s + r.p5, 0) / count;
  const p10 = records.reduce((s, r) => s + r.p10, 0) / count;
  const recall20 = records.reduce((s, r) => s + r.recall20, 0) / count;
  const mrr = records.reduce((s, r) => s + r.rr, 0) / count;
  const ndcg10 = records.reduce((s, r) => s + r.ndcg10, 0) / count;

  return {
    count,
    p5: Number(p5.toFixed(4)),
    p10: Number(p10.toFixed(4)),
    recall20: Number(recall20.toFixed(4)),
    mrr: Number(mrr.toFixed(4)),
    ndcg10: Number(ndcg10.toFixed(4))
  };
}

/**
 * Executes evaluation benchmark across all systems and ablations.
 *
 * @param {Array<Object>} conversations
 * @param {Record<string, Record<string, number>>} qrels
 * @param {Object} index
 * @returns {Object} Full evaluation results
 */
export async function runEvaluationBenchmark(conversations, qrels, index) {
  const systems = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'A1', 'A2', 'A3', 'A4'];
  const resultsBySystem = {};

  for (const sysId of systems) {
    let allRecords = [];
    for (const conv of conversations) {
      const records = await evaluateSession(conv, qrels, index, sysId);
      allRecords = allRecords.concat(records);
    }

    // Clarification metrics (calculated for S2/S3)
    let clarificationPrecision = 0;
    let clarificationRecall = 0;
    const firedRecords = allRecords.filter(r => r.clarifyingFired);
    const ambiguousRecords = allRecords.filter(r => r.isAmbiguous);

    if (firedRecords.length > 0) {
      clarificationPrecision = firedRecords.filter(r => r.isAmbiguous).length / firedRecords.length;
    }
    if (ambiguousRecords.length > 0) {
      clarificationRecall = ambiguousRecords.filter(r => r.clarifyingFired).length / ambiguousRecords.length;
    }

    // Cohort breakdowns
    const overall = aggregateMetrics(allRecords);
    const turn1Only = aggregateMetrics(allRecords.filter(r => r.turnIndex === 1));
    const laterTurns = aggregateMetrics(allRecords.filter(r => r.turnIndex > 1));
    const topicShiftTurns = aggregateMetrics(allRecords.filter(r => r.isShift));

    resultsBySystem[sysId] = {
      systemId: sysId,
      overall,
      turn1Only,
      laterTurns,
      topicShiftTurns,
      clarification: {
        firedCount: firedRecords.length,
        ambiguousCount: ambiguousRecords.length,
        precision: Number(clarificationPrecision.toFixed(4)),
        recall: Number(clarificationRecall.toFixed(4))
      },
      rawRecords: allRecords
    };
  }

  return resultsBySystem;
}
