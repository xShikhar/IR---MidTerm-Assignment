/**
 * @file server/src/conversation/shiftDetector.js
 * @description Topic-Shift Detector.
 * Compares the current query vector against the accumulated conversational context vector
 * using Cosine Similarity, combined with linguistic signals for anaphora and ellipsis.
 * Output: CARRY (continuation) or RESET (topic shift).
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * Computes cosine similarity between two sparse term weight vectors.
 *
 * @param {Map<string, number>} vecA
 * @param {Map<string, number>} vecB
 * @returns {number} Cosine similarity in [0, 1]
 */
function vectorCosine(vecA, vecB) {
  if (vecA.size === 0 || vecB.size === 0) return 0;

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (const [, val] of vecA.entries()) {
    normASq += val * val;
  }
  for (const [, val] of vecB.entries()) {
    normBSq += val * val;
  }

  for (const [term, valA] of vecA.entries()) {
    if (vecB.has(term)) {
      dotProduct += valA * vecB.get(term);
    }
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Detects whether the current turn continues the existing conversational thread or shifts topic.
 *
 * @param {string} rawQuery - Current query string
 * @param {Map<string, number>} contextVector - Decayed context term weights
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.cosineThreshold=CONFIG.conversation.shift.cosineThreshold]
 * @returns {{ decision: 'CARRY' | 'RESET', cosineSimilarity: number, threshold: number, signals: Object, reason: string }}
 */
export function detectTopicShift(rawQuery, contextVector, index, options = {}) {
  const threshold = options.cosineThreshold ?? CONFIG.conversation.shift.cosineThreshold;

  // If no prior context exists, this is turn 1
  if (!contextVector || contextVector.size === 0) {
    return {
      decision: 'CARRY',
      cosineSimilarity: 1.0,
      threshold,
      signals: {
        hasPronoun: false,
        isShortQuery: false,
        hasEllipsis: false,
        matchedPronouns: []
      },
      reason: 'Initial turn: no prior conversational context to compare.'
    };
  }

  // 1. Build sparse query vector
  const queryWords = rawQuery.toLowerCase().split(/\s+/);
  const queryStems = analyze(rawQuery, true);
  const queryVector = new Map();

  for (const stem of queryStems) {
    const entry = index.dictionary[stem];
    const weight = entry ? 1.0 * entry.idf : 1.0;
    queryVector.set(stem, weight);
  }

  // 2. Compute Cosine Similarity with Context Vector
  const cosine = Number(vectorCosine(queryVector, contextVector).toFixed(4));

  // 3. Extract Linguistic Signals
  const matchedPronouns = CONFIG.conversation.shift.pronouns.filter(p =>
    queryWords.includes(p)
  );
  const hasPronoun = matchedPronouns.length > 0;
  const isShortQuery = queryWords.length <= CONFIG.conversation.shift.shortQueryLength;
  const hasEllipsis = CONFIG.conversation.shift.ellipsisMarkers.some(marker =>
    rawQuery.toLowerCase().startsWith(marker) || rawQuery.toLowerCase().includes(marker)
  );

  // 4. Decision Logic:
  // Strong continuation signals: pronoun presence, short ellipsis query, or cosine >= threshold
  const strongAnaphora = hasPronoun || (isShortQuery && (hasEllipsis || queryStems.length <= 2));

  let decision = 'CARRY';
  let reason = '';

  if (cosine >= threshold) {
    decision = 'CARRY';
    reason = `Sufficient topical alignment (cosine ${cosine} >= threshold ${threshold}).`;
  } else if (strongAnaphora) {
    decision = 'CARRY';
    reason = `Low cosine (${cosine} < ${threshold}) overridden by strong anaphora/ellipsis signal (${matchedPronouns.join(', ') || 'short elliptical query'}).`;
  } else {
    decision = 'RESET';
    reason = `Topic shift detected: cosine (${cosine} < ${threshold}) with no anaphoric binding.`;
  }

  return {
    decision,
    cosineSimilarity: cosine,
    threshold,
    signals: {
      hasPronoun,
      isShortQuery,
      hasEllipsis,
      matchedPronouns
    },
    reason
  };
}
