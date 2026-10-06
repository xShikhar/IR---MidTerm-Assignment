/**
 * @file server/src/conversation/rewriter.js
 * @description Index-Driven Query Rewriter.
 * On CARRY: expands conversational query with top-m high-weight context terms,
 * preserving complete provenance metadata for inspection.
 * On RESET: clears context and preserves standalone query semantics.
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * Rewrites the conversational query using accumulated context terms.
 *
 * @param {string} rawQuery - Current query
 * @param {import('./contextState.js').ContextState} contextState - Active conversational context
 * @param {'CARRY' | 'RESET'} shiftDecision - Topic shift detector decision
 * @param {Object} [options]
 * @param {number} [options.topM=CONFIG.conversation.rewriter.topMExpansionTerms]
 * @param {number} [options.minWeight=CONFIG.conversation.rewriter.minTermWeight]
 * @returns {{ rewrittenQuery: string, addedTerms: Array<Object>, mode: 'EXPANDED' | 'STANDALONE' }}
 */
export function rewriteQuery(rawQuery, contextState, shiftDecision, options = {}) {
  const topM = options.topM ?? CONFIG.conversation.rewriter.topMExpansionTerms;
  const minWeight = options.minWeight ?? CONFIG.conversation.rewriter.minTermWeight;

  if (shiftDecision === 'RESET') {
    contextState.reset();
    return {
      rewrittenQuery: rawQuery,
      addedTerms: [],
      mode: 'STANDALONE'
    };
  }

  // Get current query stems to avoid duplicating existing terms
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
        idf: item.idf
      });
    }
  }

  if (addedTerms.length === 0) {
    return {
      rewrittenQuery: rawQuery,
      addedTerms: [],
      mode: 'STANDALONE'
    };
  }

  const expansionSuffix = addedTerms.map(t => t.term).join(' ');
  const rewrittenQuery = `${rawQuery} ${expansionSuffix}`;

  return {
    rewrittenQuery,
    addedTerms,
    mode: 'EXPANDED'
  };
}
