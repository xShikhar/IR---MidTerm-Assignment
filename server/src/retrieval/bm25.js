/**
 * @file server/src/retrieval/bm25.js
 * @description Okapi BM25 Probabilistic Ranking Function.
 * Reference: Robertson, Jones, Walker, & Hancock-Beaulieu (1994), Okapi at TREC-3.
 *
 * Formula:
 *   Score(D, Q) = sum_{t in Q} IDF(t) * (tf(t, D) * (k1 + 1)) / (tf(t, D) + k1 * (1 - b + b * (|D| / avgdl)))
 */

import { TopKHeap } from './heap.js';
import { CONFIG } from '../config/index.js';

/**
 * Executes Okapi BM25 retrieval.
 *
 * @param {string[]} queryTerms - Normalized query terms
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.topK=CONFIG.retrieval.topK] - Ranking depth
 * @param {boolean} [options.useChampionLists=false] - Whether to restrict candidates to champion lists
 * @param {number} [options.k1=CONFIG.retrieval.bm25.k1] - TF saturation parameter
 * @param {number} [options.b=CONFIG.retrieval.bm25.b] - Document length normalization penalty
 * @param {number} [options.titleZoneWeight=CONFIG.retrieval.zones.titleWeight]
 * @param {number} [options.bodyZoneWeight=CONFIG.retrieval.zones.bodyWeight]
 * @returns {Array<{ docId: string, score: number, title: string, body: string, domain: string, breakdown: Object }>}
 */
export function scoreBM25(queryTerms, index, options = {}) {
  const topK = options.topK || CONFIG.retrieval.topK;
  const useChampionLists = options.useChampionLists || false;
  const k1 = options.k1 ?? CONFIG.retrieval.bm25.k1;
  const b = options.b ?? CONFIG.retrieval.bm25.b;
  const titleWeight = options.titleZoneWeight ?? CONFIG.retrieval.zones.titleWeight;
  const bodyWeight = options.bodyZoneWeight ?? CONFIG.retrieval.zones.bodyWeight;

  if (!queryTerms || queryTerms.length === 0) {
    return [];
  }

  const avgdl = index.metadata.avgDocLength || 1.0;
  const docAccumulator = new Map();

  // Deduplicate terms for BM25 summation
  const uniqueTerms = Array.from(new Set(queryTerms));

  for (const term of uniqueTerms) {
    const entry = index.dictionary[term];
    if (!entry) continue;

    const bm25Idf = entry.bm25Idf;
    let postingsToScan = entry.postings;
    if (useChampionLists) {
      const topR = options.topR || CONFIG.retrieval.championLists.topR;
      if (topR === 50 && index.championLists && index.championLists[term]) {
        postingsToScan = index.championLists[term];
      } else {
        if (!entry._championCache) entry._championCache = {};
        if (!entry._championCache[topR]) {
          const sorted = [...entry.postings].sort((a, b) => (b.tf || 0) - (a.tf || 0));
          entry._championCache[topR] = sorted.slice(0, topR);
        }
        postingsToScan = entry._championCache[topR];
      }
    }

    for (const posting of postingsToScan) {
      const docId = posting.docId;
      if (options.allowedDocIds && !options.allowedDocIds.has(docId)) continue;
      const docMeta = index.docs[docId];
      if (!docMeta) continue;

      // Effective zone-weighted TF
      const rawTf = (titleWeight * (posting.titleTf || 0) + bodyWeight * (posting.bodyTf || 0)) * 1.5 || posting.tf;
      const lenNorm = 1 - b + b * (docMeta.docLength / avgdl);
      const tfComponent = (rawTf * (k1 + 1)) / (rawTf + k1 * lenNorm);
      const termScore = bm25Idf * tfComponent;

      if (!docAccumulator.has(docId)) {
        docAccumulator.set(docId, {
          totalScore: 0,
          termContributions: []
        });
      }

      const acc = docAccumulator.get(docId);
      acc.totalScore += termScore;
      acc.termContributions.push({
        term,
        bm25Idf: Number(bm25Idf.toFixed(4)),
        rawTf: Number(rawTf.toFixed(2)),
        lenNorm: Number(lenNorm.toFixed(4)),
        termScore: Number(termScore.toFixed(4))
      });
    }
  }

  // Fallback: If champion lists yielded too few results, re-run with full postings
  if (useChampionLists && docAccumulator.size < topK) {
    return scoreBM25(queryTerms, index, { ...options, useChampionLists: false });
  }

  // Top-K selection via binary min-heap
  const heap = new TopKHeap(topK);
  for (const [docId, acc] of docAccumulator.entries()) {
    const docMeta = index.docs[docId];
    heap.insert({
      docId,
      score: acc.totalScore,
      breakdown: {
        scoringModel: 'Okapi BM25',
        rawScore: Number(acc.totalScore.toFixed(4)),
        docLength: docMeta.docLength,
        avgdl: Number(avgdl.toFixed(2)),
        termContributions: acc.termContributions
      }
    });
  }

  const topDocs = heap.toSortedArray();

  return topDocs.map(item => {
    const docMeta = index.docs[item.docId];
    return {
      docId: item.docId,
      score: Number(item.score.toFixed(4)),
      title: docMeta.title,
      body: docMeta.body,
      domain: docMeta.domain,
      breakdown: item.breakdown
    };
  });
}
