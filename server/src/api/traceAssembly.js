/**
 * @file server/src/api/traceAssembly.js
 * @description Central Trace Assembly Engine.
 * Executes the complete conversational retrieval lifecycle and packages the
 * unredacted, inspectable TurnTrace JSON response.
 *
 * Supports:
 * - V2 Headline Architecture: Entity Lock, Aspect-Aware Context, Title Filtering with Fallback,
 *   and Per-Session Seen Passage Penalty.
 * - V1 Legacy Mode: Preserved for baseline comparisons (A0 / S2).
 */

import { performance } from 'node:perf_hooks';
import { analyze } from '../index/normalizer.js';
import { tokenizeWithPositions } from '../index/tokenizer.js';
import { evaluatePhraseQuery } from '../retrieval/phrase.js';
import { detectTopicShift } from '../conversation/shiftDetector.js';
import { detectConversationalDecision } from '../conversation/decisionDetector.js';
import { extractEntityCandidates, extractAspectTerms } from '../conversation/entityExtractor.js';
import { rewriteQuery } from '../conversation/rewriter.js';
import { decomposeAndRetrieve } from '../conversation/decomposer.js';
import { evaluateClarification } from '../conversation/clarifier.js';
import { computeTitleFilteredCandidates } from '../retrieval/titleFilter.js';
import { SeenPassageTracker } from '../retrieval/seenPenalty.js';
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
 * @param {'hard' | 'soft'} [options.lockMode] - Lock mode for V2
 * @param {boolean} [options.applySeenPenalty=false] - Whether to penalize passages shown earlier
 * @param {string} [options.forcedDecision] - For A5 (always-carry) or A6 (always-reset) ablations
 * @param {boolean} [options.disableShiftDetector=false]
 * @param {boolean} [options.disableFusion=false]
 * @returns {Object} Complete TurnTrace response
 */
export async function executeConversationalTurn(rawQuery, contextState, index, options = {}) {
  const t0 = performance.now();
  const topK = options.topK || CONFIG.retrieval.topK;
  const isLegacyV1 = contextState.mode === 'v1' || options.architecture === 'legacy';

  // 1. Lexical Analysis & Positional Phrase check
  const tLexStart = performance.now();
  const rawPositional = tokenizeWithPositions(rawQuery);
  const normalizedStems = analyze(rawQuery, true);

  // Check for quoted phrase matching (e.g. "vector space model")
  const phraseMatches = [];
  const phraseRegex = /"([^"]+)"/g;
  let pMatch;
  while ((pMatch = phraseRegex.exec(rawQuery)) !== null) {
    const phraseText = pMatch[1].trim();
    if (phraseText) {
      const phrasePostings = evaluatePhraseQuery(phraseText, index);
      phraseMatches.push({
        phrase: phraseText,
        matchingDocCount: phrasePostings.length,
        docIds: phrasePostings.slice(0, 10).map(p => p.docId)
      });
    }
  }
  const lexMs = performance.now() - tLexStart;

  // =========================================================================
  // V1 PATH (Legacy Decayed Context Bag — A0 / S2)
  // =========================================================================
  if (isLegacyV1) {
    const tShiftStart = performance.now();
    let shiftDecision;
    if (options.disableShiftDetector) {
      shiftDecision = {
        decision: 'CARRY',
        cosineSimilarity: 1.0,
        threshold: CONFIG.conversation.shift.cosineThreshold,
        signals: { hasPronoun: false, isShortQuery: false, hasEllipsis: false, matchedPronouns: [] },
        reason: 'Ablation: topic shift detector manually disabled (forced CARRY).'
      };
    } else {
      shiftDecision = detectTopicShift(rawQuery, contextState.getVector(), index);
    }
    const shiftMs = performance.now() - tShiftStart;

    const tRewriteStart = performance.now();
    const rewriteResult = rewriteQuery(rawQuery, contextState, shiftDecision.decision);
    const rewriteMs = performance.now() - tRewriteStart;

    const tRetStart = performance.now();
    const decomposerResult = decomposeAndRetrieve(rewriteResult.rewrittenQuery, index, {
      topK,
      useChampionLists: options.useChampionLists,
      applyIndexElimination: options.applyIndexElimination,
      model: options.model
    });
    const retMs = performance.now() - tRetStart;

    const activeResults = options.disableFusion
      ? decomposerResult.subQueries[0]?.resultsCount ? decomposerResult.fusedResultsRrf : []
      : decomposerResult.fusedResultsRrf;

    const tClarifyStart = performance.now();
    const clarificationResult = evaluateClarification(activeResults, index);
    const clarifyMs = performance.now() - tClarifyStart;

    contextState.update(rawQuery, activeResults.slice(0, 1), index);

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
        architecture: 'v1_decayed_bag',
        normalizedTokens: normalizedStems,
        positionalTokens: rawPositional,
        phraseMatches,
        retrievalExecution: {
          model: options.model || 'cosine',
          championLists: Boolean(options.useChampionLists),
          indexElimination: Boolean(options.applyIndexElimination)
        },
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

  // =========================================================================
  // V2 HEADLINE PATH (Entity Lock + Aspect-Aware Context Tracking)
  // =========================================================================

  // 2. Decision Detection
  const tDecisionStart = performance.now();
  let decisionResult;

  if (options.forcedDecision) {
    decisionResult = {
      decision: options.forcedDecision,
      entityCandidates: extractEntityCandidates(rawQuery, index),
      guardsTriggered: ['forced_ablation'],
      reason: `Ablation forced decision: ${options.forcedDecision}`
    };
  } else {
    decisionResult = detectConversationalDecision(
      rawQuery,
      contextState.getLockedEntities(),
      contextState.getAllContextTerms(),
      index,
      options
    );
  }
  const decisionMs = performance.now() - tDecisionStart;

  // 3. Extract Entity & Aspect terms for State Update
  let entityCandidates = decisionResult.entityCandidates || [];
  if (entityCandidates.length === 0 && (contextState.entityTerms.size === 0 || decisionResult.decision !== 'CARRY')) {
    entityCandidates = extractEntityCandidates(rawQuery, index, options);
  }
  const aspectCandidates = extractAspectTerms(rawQuery, entityCandidates, index, options);

  // 4. Update ContextState v2
  contextState.updateV2({
    decision: decisionResult.decision,
    rawQuery,
    entityCandidates,
    aspectCandidates
  });

  // 5. Query Rewriting with Provenance
  const tRewriteStart = performance.now();
  const lockMode = options.lockMode || CONFIG.novelty.lock.mode;
  const rewriteResult = rewriteQuery(rawQuery, contextState, decisionResult.decision, {
    ...options,
    lockMode
  });
  const rewriteMs = performance.now() - tRewriteStart;

  // 6. Title Filter (Hard Lock Mode) with Fallback
  const lockedEntities = contextState.getLockedEntities();
  const titleFilterResult = computeTitleFilteredCandidates(lockedEntities, index, {
    lockMode,
    minCandidates: options.minCandidates ?? CONFIG.novelty.lock.minCandidates
  });

  // 7. Multi-Part Query Decomposition & Retrieval
  const tRetStart = performance.now();
  const decomposerResult = decomposeAndRetrieve(rewriteResult.rewrittenQuery, index, {
    topK: topK * 2,
    useChampionLists: options.useChampionLists,
    applyIndexElimination: options.applyIndexElimination,
    minIdf: options.minIdf ?? CONFIG.retrieval.indexElimination.minIdf,
    model: options.model,
    allowedDocIds: titleFilterResult.filteredDocIds
  });
  const retMs = performance.now() - tRetStart;

  let activeResults = options.disableFusion
    ? decomposerResult.subQueries[0]?.resultsCount ? decomposerResult.fusedResultsRrf : []
    : decomposerResult.fusedResultsRrf;

  // 8. Seen-Passage Penalty (Per-session isolation)
  const applySeenPenalty = Boolean(options.applySeenPenalty);
  let demotedPassages = [];

  if (applySeenPenalty) {
    if (!contextState.seenTracker) {
      contextState.seenTracker = new SeenPassageTracker(options.seenPenalty ?? CONFIG.novelty.seen.penalty);
    }
    const penaltyOut = contextState.seenTracker.applyPenalty(activeResults);
    activeResults = penaltyOut.penalizedResults;
    demotedPassages = penaltyOut.demotedPassages;
    contextState.seenTracker.recordShown(activeResults.slice(0, topK));
  }

  // 9. Cluster-Pruned Clarification (Phase 5 DEV Tuning: disabled by default)
  const tClarifyStart = performance.now();
  const clarifierEnabled = options.enableClarifier ?? CONFIG.conversation.clarifier.enabled;
  const clarificationResult = clarifierEnabled
    ? evaluateClarification(activeResults, index, options)
    : {
        fired: false,
        margin: activeResults.length >= 2 ? Number((activeResults[0].score - activeResults[1].score).toFixed(4)) : 1.0,
        clustersCount: 0,
        clarifyingQuestion: null,
        distinguishingTerms: [],
        reason: 'Cluster clarifier disabled by default (failed to outperform trivial baseline on DEV).'
      };
  const clarifyMs = performance.now() - tClarifyStart;

  // 10. Postings Statistics Used
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
      architecture: 'v2_entity_lock',
      normalizedTokens: normalizedStems,
      positionalTokens: rawPositional,
      phraseMatches,
      retrievalExecution: {
        model: options.model || 'cosine',
        championLists: Boolean(options.useChampionLists),
        indexElimination: Boolean(options.applyIndexElimination),
        minIdf: options.minIdf ?? CONFIG.retrieval.indexElimination.minIdf,
        eliminatedTerms: decomposerResult.eliminatedTerms || []
      },
      entityLock: {
        decision: decisionResult.decision,
        decisionReason: decisionResult.reason,
        guardsTriggered: decisionResult.guardsTriggered || [],
        lockedEntities,
        aspectTerms: contextState.getAspectTerms(),
        lockMode: titleFilterResult.lockMode,
        fallback: titleFilterResult.fallback,
        candidateCounts: {
          survivingTitleCandidates: titleFilterResult.candidateCount,
          finalRetrievedCount: activeResults.length
        }
      },
      seenPassagePenalty: {
        enabled: applySeenPenalty,
        penalty: options.seenPenalty ?? CONFIG.novelty.seen.penalty,
        demotedPassages
      },
      shiftDecision: {
        decision: decisionResult.decision === 'reset' ? 'RESET' : 'CARRY',
        v2Decision: decisionResult.decision,
        reason: decisionResult.reason
      },
      rewriter: {
        mode: rewriteResult.mode,
        rewrittenQuery: rewriteResult.rewrittenQuery,
        addedTerms: rewriteResult.addedTerms,
        provenance: rewriteResult.provenance
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
        decisionMs: Number(decisionMs.toFixed(2)),
        rewritingMs: Number(rewriteMs.toFixed(2)),
        retrievalAndFusionMs: Number(retMs.toFixed(2)),
        clarificationMs: Number(clarifyMs.toFixed(2)),
        totalLatencyMs: Number(totalMs.toFixed(2))
      }
    }
  };
}
