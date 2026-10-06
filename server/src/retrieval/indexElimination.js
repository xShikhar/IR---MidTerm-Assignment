/**
 * @file server/src/retrieval/indexElimination.js
 * @description Index Elimination / Query Pruning (Manning et al., §7.1.2).
 * Skips query terms with low collection-wide IDF to eliminate terms that
 * provide negligible discriminative ranking power, while guaranteeing at least
 * minKeep (default: 2) terms per query are preserved.
 */

import { CONFIG } from '../config/index.js';

/**
 * Filters query terms based on Inverse Document Frequency (IDF) threshold.
 *
 * @param {string[]} terms - Normalized query terms
 * @param {Record<string, { df: number, idf: number }>} dictionary - Index dictionary
 * @param {number} [minIdf=CONFIG.retrieval.indexElimination.minIdf] - Minimum IDF threshold
 * @param {number} [minKeep=2] - Minimum number of terms to retain per query
 * @returns {{ retainedTerms: string[], eliminatedTerms: string[] }}
 */
export function eliminateLowIdfTerms(
  terms,
  dictionary,
  minIdf = CONFIG.retrieval.indexElimination.minIdf,
  minKeep = 1
) {
  const validTerms = terms.filter(t => Boolean(dictionary[t]));
  if (validTerms.length <= minKeep) {
    return {
      retainedTerms: validTerms,
      eliminatedTerms: []
    };
  }

  const retained = [];
  const eliminated = [];

  for (const term of validTerms) {
    const entry = dictionary[term];
    if (entry.idf >= minIdf) {
      retained.push(term);
    } else {
      eliminated.push(term);
    }
  }

  // Ensure at least minKeep terms are retained by rescuing highest-IDF terms
  if (retained.length < minKeep) {
    const sortedByDescIdf = [...validTerms].sort((a, b) => dictionary[b].idf - dictionary[a].idf);
    const guaranteedRetained = sortedByDescIdf.slice(0, minKeep);
    const guaranteedEliminated = sortedByDescIdf.slice(minKeep).filter(t => dictionary[t].idf < minIdf);
    return {
      retainedTerms: guaranteedRetained,
      eliminatedTerms: guaranteedEliminated
    };
  }

  return { retainedTerms: retained, eliminatedTerms: eliminated };
}
