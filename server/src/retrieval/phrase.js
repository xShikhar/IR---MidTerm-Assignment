/**
 * @file server/src/retrieval/phrase.js
 * @description Positional Phrase Query Processor.
 * Finds documents where an exact sequence of words appears in strictly consecutive positions.
 * Reference: Manning, Raghavan, & Schütze (2008), §2.4.
 */

import { positionalIntersect } from '../index/postings.js';
import { analyze } from '../index/normalizer.js';

/**
 * Searches the index for an exact phrase sequence using positional postings intersection.
 *
 * @param {string | string[]} phrase - Raw phrase string or pre-normalized terms
 * @param {Object} index - Inverted index
 * @returns {Array<{ docId: string, tf: number, positions: number[] }>}
 */
export function evaluatePhraseQuery(phrase, index) {
  const terms = Array.isArray(phrase)
    ? phrase
    : analyze(phrase, false); // Keep stop words in phrases for exact phrase semantics

  if (!terms || terms.length === 0) return [];
  if (terms.length === 1) {
    const entry = index.dictionary[terms[0]];
    return entry ? entry.postings : [];
  }

  // Verify all terms exist in dictionary
  for (const t of terms) {
    if (!index.dictionary[t]) {
      return []; // Phrase cannot exist if any constituent word is absent
    }
  }

  // Iteratively intersect adjacent positional postings
  let currentPostings = index.dictionary[terms[0]].postings;

  for (let i = 1; i < terms.length; i++) {
    if (currentPostings.length === 0) break;
    const nextPostings = index.dictionary[terms[i]].postings;
    currentPostings = positionalIntersect(currentPostings, nextPostings, 1);
  }

  return currentPostings;
}
