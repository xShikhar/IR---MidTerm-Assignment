/**
 * @file server/src/conversation/rewriter.js
 * @description Query Rewriter supporting Entity-Lock + Aspect-Aware context assembly (v2)
 * and legacy decayed bag expansion (v1 for A0/S2 baseline).
 *
 * Rewriting Architecture (v2):
 * - Rewritten Query: current query terms + locked entity terms + active aspect terms (weighted).
 * - Full provenance tracked per term: sourceTurn, idf, role ('query' | 'entity' | 'aspect'), status.
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * Rewrites the conversational query using accumulated context terms.
 *
 * @param {string} rawQuery - Current turn query
 * @param {import('./contextState.js').ContextState} contextState - Active context state
 * @param {'CARRY' | 'entity_switch' | 'reset' | 'RESET'} decision - Transition decision
 * @param {Object} [options]
 * @param {'hard' | 'soft'} [options.lockMode=CONFIG.novelty.lock.mode] - Lock mode
 * @param {number} [options.entityBoost=CONFIG.novelty.lock.entityBoost] - Soft mode entity multiplier
 * @returns {{
 *   rewrittenQuery: string,
 *   addedTerms: Array<Object>,
 *   provenance: Array<Object>,
 *   mode: string
 * }}
 */
export function rewriteQuery(rawQuery, contextState, decision, options = {}) {
  // Legacy V1 bag expansion for A0 / S2 baseline (or direct context.terms usage)
  if (contextState.mode === 'v1' || (contextState.terms?.size > 0 && contextState.entityTerms?.size === 0)) {
    const topM = options.topM ?? CONFIG.conversation.rewriter.topMExpansionTerms;
    const minWeight = options.minWeight ?? CONFIG.conversation.rewriter.minTermWeight;

    if (decision === 'RESET' || decision === 'reset') {
      contextState.reset();
      return {
        rewrittenQuery: rawQuery,
        addedTerms: [],
        provenance: [],
        mode: 'STANDALONE'
      };
    }

    const currentStems = new Set(analyze(rawQuery, true));
    const provenanceList = contextState.getProvenanceList();
    const addedTerms = [];

    for (const item of provenanceList) {
      if (addedTerms.length >= topM) break;
      if (!currentStems.has(item.term) && item.currentWeight >= minWeight) {
        addedTerms.push({
          term: item.term,
          sourceTurn: item.sourceTurn,
          sourceType: item.sourceType,
          rawWeight: item.rawWeight,
          decayFactor: item.decayFactor,
          currentWeight: item.currentWeight,
          idf: item.idf,
          role: 'decayed_context'
        });
      }
    }

    const rewrittenQuery = addedTerms.length > 0
      ? `${rawQuery} ${addedTerms.map(t => t.term).join(' ')}`
      : rawQuery;

    return {
      rewrittenQuery,
      addedTerms,
      provenance: addedTerms,
      mode: addedTerms.length > 0 ? 'EXPANDED' : 'STANDALONE'
    };
  }

  // =========================================================================
  // V2 Architecture: Entity Lock + Aspect-Aware Context Assembly
  // =========================================================================
  const queryStems = new Set(analyze(rawQuery, true));
  const lockedEntities = contextState.getLockedEntities();
  const aspectTerms = contextState.getAspectTerms();

  const provenance = [];
  const addedTerms = [];

  // 1. Provenance for direct query terms
  for (const stem of queryStems) {
    provenance.push({
      term: stem,
      role: 'query',
      sourceTurn: contextState.turnCounter || 1,
      weight: 1.0,
      status: 'direct_query'
    });
  }

  // 2. Incorporate locked entity terms
  for (const entity of lockedEntities) {
    const isNewToQuery = !queryStems.has(entity.term);
    const weight = options.lockMode === 'soft'
      ? (options.entityBoost ?? CONFIG.novelty.lock.entityBoost)
      : 1.0;

    const termMeta = {
      term: entity.term,
      role: 'entity',
      sourceTurn: entity.sourceTurn,
      idf: entity.idf,
      titleHitCount: entity.titleHitCount,
      weight,
      status: isNewToQuery ? 'added_entity' : 'query_entity'
    };

    provenance.push(termMeta);
    if (isNewToQuery) {
      addedTerms.push(termMeta);
    }
  }

  // 3. Incorporate active aspect terms
  for (const aspect of aspectTerms) {
    const isNewToQuery = !queryStems.has(aspect.term) && !lockedEntities.some(e => e.term === aspect.term);
    const termMeta = {
      term: aspect.term,
      role: 'aspect',
      sourceTurn: aspect.sourceTurn,
      idf: aspect.idf,
      weight: aspect.weight,
      status: isNewToQuery ? 'added_aspect' : 'query_aspect'
    };

    provenance.push(termMeta);
    if (isNewToQuery) {
      addedTerms.push(termMeta);
    }
  }

  // 4. Construct rewritten query string
  const extraTokens = addedTerms.map(t => t.term);
  const rewrittenQuery = extraTokens.length > 0
    ? `${rawQuery} ${extraTokens.join(' ')}`
    : rawQuery;

  return {
    rewrittenQuery,
    addedTerms,
    provenance,
    mode: extraTokens.length > 0 ? 'ENTITY_ASPECT_REWRITE' : 'STANDALONE'
  };
}
