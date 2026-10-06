/**
 * @file server/src/api/traceAssembly.js
 * @description Central Trace Assembly Engine.
 * Executes the complete conversational retrieval lifecycle and packages the
 * unredacted, inspectable TurnTrace JSON response.
 */

import { performance } from 'node:perf_hooks';
import { analyze, normalizeTokensWithPositions } from '../index/normalizer.js';
import { tokenizeWithPositions } from '../index/tokenizer.js';
import { detectTopicShift } from '../conversation/shiftDetector.js';
import { rewriteQuery } from '../conversation/rewriter.js';
import { decomposeAndRetrieve } from '../conversation/decomposer.js';
import { evaluateClarification } from '../conversation/clarifier.js';
import { CONFIG } from '../config/index.js';

/**
 * Executes a full conversational search turn and returns ranked passages with
 * exhaustive inspection trace.
 *
 * @param {string} rawQuery - User query
 * @param {import('../conversation/contextState.js').ContextState} contextState - Conversational context
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.topK=CONFIG.retrieval.topK]
 * @param {boolean} [options.disableShiftDetector=false]
 * @param {boolean} [options.disableFusion=false]
 * @returns {Object} Complete TurnTrace response
 */
export async function executeConversationalTurn(rawQuery, contextState, index, options = {}) {
  const t0 = performance.now();
  const topK = options.topK || CONFIG.retrieval.topK;
  const disableShift = options.disableShiftDetector || false;

  // 1. Lexical Analysis
  const tLexStart = performance.now();
  const rawPositional = tokenizeWithPositions(rawQuery);
  const normalizedStems = analyze(rawQuery, true);
  const lexMs = performance.now() - tLexStart;

  // 2. Topic Shift Detection
  const tShiftStart = performance.now();
  const contextVector = contextState.getVector();
  let shiftDecision;

  if (disableShift) {
    shiftDecision = {
      decision: 'CARRY',
      cosineSimilarity: 1.0,
      threshold: CONFIG.conversation.shift.cosineThreshold,
      signals: { hasPronoun: false, isShortQuery: false, hasEllipsis: false, matchedPronouns: [] },
      reason: 'Ablation: topic shift detector manually disabled (forced CARRY).'
    };
  } else {
    shiftDecision = detectTopicShift(rawQuery, contextVector, index);
  }
  const shiftMs = performance.now() - tShiftStart;

  // 3. Query Rewriting
  const tRewriteStart = performance.now();
  const rewriteResult = rewriteQuery(rawQuery, contextState, shiftDecision.decision);
  const rewriteMs = performance.now() - tRewriteStart;

  // 4. Multi-Part Query Decomposition & Retrieval
  const tRetStart = performance.now();
  const decomposerResult = decomposeAndRetrieve(rewriteResult.rewrittenQuery, index, { topK });
  const retMs = performance.now() - tRetStart;

  const activeResults = options.disableFusion
    ? decomposerResult.subQueries[0]?.resultsCount ? decomposerResult.fusedResultsRrf : []
    : decomposerResult.fusedResultsRrf;

  // 5. Cluster-Pruned Clarification
  const tClarifyStart = performance.now();
  const clarificationResult = evaluateClarification(activeResults, index);
  const clarifyMs = performance.now() - tClarifyStart;

  // 6. Update Context State with Current Turn & Top Passage
  contextState.update(rawQuery, activeResults.slice(0, 1), index);

  // 7. Extract Postings Statistics for all active terms
  const allQueriedTerms = Array.from(new Set([
    ...normalizedStems,
    ...rewriteResult.addedTerms.map(t => t.term)
  ]));

  const postingsUsed = allQueriedTerms.map(term => {
    const entry = index.dictionary[term];
    return {
      term,
      df: entry ? entry.df : 0,
      idf: entry ? Number(entry.idf.toFixed(4)) : 0,
      bm25Idf: entry ? Number(entry.bm25Idf.toFixed(4)) : 0
    };
  });

  const totalMs = performance.now() - t0;

  return {
    results: activeResults.slice(0, topK),
    trace: {
      turn: contextState.turnCounter,
      rawQuery,
      normalizedTokens: normalizedStems,
      shiftDecision: {
        decision: shiftDecision.decision,
        cosineSimilarity: shiftDecision.cosineSimilarity,
        threshold: shiftDecision.threshold,
        signals: shiftDecision.signals,
        reason: shiftDecision.reason
      },
      contextTerms: contextState.getProvenanceList(),
      rewriter: {
        mode: rewriteResult.mode,
        rewrittenQuery: rewriteResult.rewrittenQuery,
        addedTerms: rewriteResult.addedTerms
      },
      decomposition: {
        isDecomposed: decomposerResult.isDecomposed,
        subQueries: decomposerResult.subQueries
      },
      fusionComparison: {
        rrfRankingsCount: decomposerResult.fusedResultsRrf.length,
        scoreSumRankingsCount: decomposerResult.fusedResultsScoreSum.length
      },
      postingsUsed,
      clarification: clarificationResult,
      timings: {
        lexicalAnalysisMs: Number(lexMs.toFixed(2)),
        topicShiftMs: Number(shiftMs.toFixed(2)),
        rewritingMs: Number(rewriteMs.toFixed(2)),
        retrievalAndFusionMs: Number(retMs.toFixed(2)),
        clarificationMs: Number(clarifyMs.toFixed(2)),
        totalLatencyMs: Number(totalMs.toFixed(2))
      }
    }
  };
}
