/**
 * @file server/src/retrieval/indexElimination.js
 * @description Index Elimination / Query Pruning (Manning et al., §7.1.2).
 * Skips query terms with low collection-wide IDF to eliminate terms that
 * provide negligible discriminative ranking power.
 */

import { CONFIG } from '../config/index.js';

/**
 * Filters query terms based on Inverse Document Frequency (IDF) threshold.
 *
 * @param {string[]} terms - Normalized query terms
 * @param {Record<string, { df: number, idf: number }>} dictionary - Index dictionary
 * @param {number} [minIdf=CONFIG.retrieval.indexElimination.minIdf] - Minimum IDF threshold
 * @returns {{ retainedTerms: string[], eliminatedTerms: string[] }}
 */
export function eliminateLowIdfTerms(terms, dictionary, minIdf = CONFIG.retrieval.indexElimination.minIdf) {
  const retainedTerms = [];
  const eliminatedTerms = [];

  for (const term of terms) {
    const entry = dictionary[term];
    if (!entry) {
      continue;
    }
    if (entry.idf >= minIdf) {
      retainedTerms.push(term);
    } else {
      eliminatedTerms.push(term);
    }
  }

  // Safety fallback: if all terms were pruned, retain all valid dictionary terms
  if (retainedTerms.length === 0) {
    const fallbackTerms = terms.filter(t => Boolean(dictionary[t]));
    return {
      retainedTerms: fallbackTerms,
      eliminatedTerms: []
    };
  }

  return { retainedTerms, eliminatedTerms };
}
