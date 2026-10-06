/**
 * @file server/src/retrieval/engine.js
 * @description Unified Retrieval Engine.
 * Serves as the primary query execution boundary supporting SMART lnc.ltc,
 * Okapi BM25, Boolean queries, Phrase search, and Index Elimination.
 */

import { analyze } from '../index/normalizer.js';
import { scoreCosineLncLtc } from './cosine.js';
import { scoreBM25 } from './bm25.js';
import { eliminateLowIdfTerms } from './indexElimination.js';
import { evaluatePhraseQuery } from './phrase.js';
import { evaluateEntityConstraints } from './boolean.js';
import { reciprocalRankFusion } from './fusion.js';
import { CONFIG } from '../config/index.js';

/**
 * Executes a standalone retrieval request over the inverted index.
 *
 * @param {string} rawQuery - Unprocessed query string
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {'cosine' | 'bm25'} [options.model='cosine'] - Ranking model
 * @param {boolean} [options.applyIndexElimination=true] - Whether to prune low-idf terms
 * @param {boolean} [options.useChampionLists=false] - Whether to use champion lists
 * @param {number} [options.topK=CONFIG.retrieval.topK] - Ranking depth
 * @returns {{ results: Array<Object>, trace: Object }}
 */
export function executeRetrieval(rawQuery, index, options = {}) {
  const model = options.model || 'cosine';
  const applyElimination = options.applyIndexElimination ?? true;
  const topK = options.topK || CONFIG.retrieval.topK;
  const useChampionLists = options.useChampionLists || false;

  // 1. Analyze query terms
  const rawTerms = analyze(rawQuery, true);

  // 2. Index Elimination
  let effectiveTerms = rawTerms;
  let eliminatedTerms = [];

  if (applyElimination) {
    const eliminationResult = eliminateLowIdfTerms(rawTerms, index.dictionary);
    effectiveTerms = eliminationResult.retainedTerms;
    eliminatedTerms = eliminationResult.eliminatedTerms;
  }

  // 3. Postings statistics for trace
  const postingsUsed = effectiveTerms.map(term => {
    const entry = index.dictionary[term];
    return {
      term,
      df: entry ? entry.df : 0,
      idf: entry ? Number(entry.idf.toFixed(4)) : 0,
      bm25Idf: entry ? Number(entry.bm25Idf.toFixed(4)) : 0
    };
  });

  // 4. Score execution
  let results = [];
  if (model === 'bm25') {
    results = scoreBM25(effectiveTerms, index, { topK });
  } else {
    results = scoreCosineLncLtc(effectiveTerms, index, { topK, useChampionLists });
  }

  return {
    results,
    trace: {
      rawQuery,
      tokens: rawTerms,
      effectiveTerms,
      eliminatedTerms,
      model,
      postingsUsed,
      returnedCount: results.length
    }
  };
}
