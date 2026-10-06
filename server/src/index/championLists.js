/**
 * @file server/src/index/championLists.js
 * @description Precomputed champion lists (fancy lists) for rapid top-K candidate pooling.
 * Reference: Manning, Raghavan, & Schütze (2008), Introduction to Information Retrieval, §7.1.3.
 * For each term t, stores the r documents with the highest local document term weight:
 *   w(t, d) = 1 + ln(tf(t, d))
 */

import { CONFIG } from '../config/index.js';

/**
 * Computes champion lists for all terms in an inverted index dictionary.
 *
 * @param {Record<string, { df: number, postings: Array<{ docId: string, tf: number, titleTf: number, bodyTf: number, positions: number[] }> }>} dictionary
 * @param {number} [topR=CONFIG.retrieval.championLists.topR] - Size of champion list per term
 * @returns {Record<string, Array<{ docId: string, tf: number, weight: number }>>} Champion lists keyed by term
 */
export function buildChampionLists(dictionary, topR = CONFIG.retrieval.championLists.topR) {
  const championLists = {};

  for (const [term, entry] of Object.entries(dictionary)) {
    const scoredPostings = entry.postings.map(p => ({
      docId: p.docId,
      tf: p.tf,
      titleTf: p.titleTf,
      bodyTf: p.bodyTf,
      weight: 1 + Math.log(p.tf)
    }));

    // Sort descending by term weight w(t, d)
    scoredPostings.sort((a, b) => b.weight - a.weight);

    championLists[term] = scoredPostings.slice(0, topR);
  }

  return championLists;
}
