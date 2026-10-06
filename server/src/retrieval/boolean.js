/**
 * @file server/src/retrieval/boolean.js
 * @description Classical Boolean Retrieval Model with Document Frequency (DF) Ordering.
 * Reference: Manning, Raghavan, & Schütze (2008), §1.3.
 *
 * Implements:
 *   - Term order optimization: intersects postings in order of increasing DF
 *   - AND / OR / NOT operators
 *   - Fallback from strict AND to ranked OR if result is empty
 */

import { intersectPostings, unionPostings, negatePostings } from '../index/postings.js';
import { normalizeToken } from '../index/normalizer.js';

/**
 * Evaluates an AND conjunction across multiple terms, sorting operands by increasing DF.
 * If any requested term does not exist in the index, the intersection is strictly empty.
 *
 * @param {string[]} terms - Terms to intersect
 * @param {Object} index - Inverted index
 * @returns {Array<{ docId: string, tf: number }>}
 */
export function evaluateBooleanAnd(terms, index) {
  if (!terms || terms.length === 0) return [];

  // Normalize terms to morphological stems
  const normalizedTerms = terms.map(t => normalizeToken(t)).filter(Boolean);
  if (normalizedTerms.length === 0) return [];

  // In Boolean AND: if any term does not exist in dictionary, intersection is empty!
  for (const t of normalizedTerms) {
    if (!index.dictionary[t] || index.dictionary[t].postings.length === 0) {
      return [];
    }
  }

  // Sort terms in increasing order of document frequency (df)
  // This minimizes intermediate postings list lengths (Manning et al., §1.3)
  normalizedTerms.sort((a, b) => index.dictionary[a].df - index.dictionary[b].df);

  // Seed with smallest postings list
  let currentPostings = index.dictionary[normalizedTerms[0]].postings;

  for (let i = 1; i < normalizedTerms.length; i++) {
    if (currentPostings.length === 0) break;
    const nextPostings = index.dictionary[normalizedTerms[i]].postings;
    currentPostings = intersectPostings(currentPostings, nextPostings);
  }

  return currentPostings;
}

/**
 * Evaluates a Boolean OR disjunction across multiple terms.
 *
 * @param {string[]} terms - Terms to union
 * @param {Object} index - Inverted index
 * @returns {Array<{ docId: string, tf: number }>}
 */
export function evaluateBooleanOr(terms, index) {
  if (!terms || terms.length === 0) return [];

  const normalizedTerms = terms.map(t => normalizeToken(t)).filter(Boolean);
  const validTerms = normalizedTerms.filter(t => Boolean(index.dictionary[t]));
  if (validTerms.length === 0) return [];

  let currentPostings = index.dictionary[validTerms[0]].postings;
  for (let i = 1; i < validTerms.length; i++) {
    const nextPostings = index.dictionary[validTerms[i]].postings;
    currentPostings = unionPostings(currentPostings, nextPostings);
  }

  return currentPostings;
}

/**
 * Evaluates an entity constraint query: tries strict AND first, falls back to OR if empty.
 *
 * @param {string[]} mustHaveTerms - Must-have entity terms
 * @param {Object} index - Inverted index
 * @returns {{ postings: Array<{ docId: string, tf: number }>, mode: 'AND' | 'OR_FALLBACK' }}
 */
export function evaluateEntityConstraints(mustHaveTerms, index) {
  if (!mustHaveTerms || mustHaveTerms.length === 0) {
    return { postings: [], mode: 'AND' };
  }

  const andResult = evaluateBooleanAnd(mustHaveTerms, index);
  if (andResult.length > 0) {
    return { postings: andResult, mode: 'AND' };
  }

  const orResult = evaluateBooleanOr(mustHaveTerms, index);
  return { postings: orResult, mode: 'OR_FALLBACK' };
}

