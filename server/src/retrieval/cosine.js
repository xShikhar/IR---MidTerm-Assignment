/**
 * @file server/src/retrieval/cosine.js
 * @description SMART lnc.ltc Vector Space Model with Cosine Normalization.
 * Reference: Salton & Buckley (1988), Term-weighting approaches in automatic text retrieval.
 *
 * Weighting Scheme:
 *   Document (lnc):
 *     - l: Logarithmic TF = 1 + ln(tf(t, d))
 *     - n: No document IDF
 *     - c: Cosine length normalization by document Euclidean norm
 *
 *   Query (ltc):
 *     - l: Logarithmic TF = 1 + ln(tf(t, q))
 *     - t: Standard natural log IDF = ln(N / df(t))
 *     - c: Cosine length normalization by query Euclidean norm
 */

import { TopKHeap } from './heap.js';
import { CONFIG } from '../config/index.js';

/**
 * Executes SMART lnc.ltc vector space retrieval.
 *
 * @param {string[]} queryTerms - Normalized query terms
 * @param {Object} index - Deserialized inverted index
 * @param {Object} [options]
 * @param {number} [options.topK=CONFIG.retrieval.topK] - Ranking depth
 * @param {boolean} [options.useChampionLists=false] - Whether to restrict candidates to champion lists
 * @param {number} [options.titleZoneWeight=CONFIG.retrieval.zones.titleWeight] - Zone weight for title
 * @param {number} [options.bodyZoneWeight=CONFIG.retrieval.zones.bodyWeight] - Zone weight for body
 * @returns {Array<{ docId: string, score: number, title: string, body: string, domain: string, breakdown: Object }>}
 */
export function scoreCosineLncLtc(queryTerms, index, options = {}) {
  const topK = options.topK || CONFIG.retrieval.topK;
  const useChampionLists = options.useChampionLists || false;
  const titleWeight = options.titleZoneWeight ?? CONFIG.retrieval.zones.titleWeight;
  const bodyWeight = options.bodyZoneWeight ?? CONFIG.retrieval.zones.bodyWeight;

  if (!queryTerms || queryTerms.length === 0) {
    return [];
  }

  // 1. Calculate Query Term Frequencies
  const qTfMap = new Map();
  for (const term of queryTerms) {
    qTfMap.set(term, (qTfMap.get(term) || 0) + 1);
  }

  // 2. Compute Query Term Weights (ltc) and Query Euclidean Norm
  const queryWeights = new Map(); // term -> unnormalized weight
  let querySumSquares = 0;

  for (const [term, tf] of qTfMap.entries()) {
    const entry = index.dictionary[term];
    if (entry) {
      const logTf = 1 + Math.log(tf);
      const idf = entry.idf;
      const unnormWeight = logTf * idf;
      queryWeights.set(term, { logTf, idf, unnormWeight });
      querySumSquares += unnormWeight * unnormWeight;
    }
  }

  const queryNorm = Math.sqrt(querySumSquares) || 1.0;
  const normalizedQueryWeights = new Map();
  for (const [term, data] of queryWeights.entries()) {
    normalizedQueryWeights.set(term, {
      ...data,
      normWeight: data.unnormWeight / queryNorm
    });
  }

  // 3. Accumulate Document Scores
  // Map: docId -> { score, termContributions: Map<term, number>, titleTfTotal, bodyTfTotal }
  const docAccumulator = new Map();

  for (const [term, qData] of normalizedQueryWeights.entries()) {
    const entry = index.dictionary[term];
    if (!entry) continue;

    const postingsToScan = useChampionLists && index.championLists[term]
      ? index.championLists[term]
      : entry.postings;

    for (const posting of postingsToScan) {
      const docId = posting.docId;
      const docMeta = index.docs[docId];
      if (!docMeta) continue;

      // Weighted TF across title and body zones
      // Zone-weighted raw TF: effectiveTf = (titleWeight * titleTf + bodyWeight * bodyTf) * 2
      const effectiveTf = (titleWeight * (posting.titleTf || 0) + bodyWeight * (posting.bodyTf || 0)) * 1.5 || posting.tf;
      const docLogTf = 1 + Math.log(effectiveTf > 0 ? effectiveTf : 1);
      const docNormWeight = docLogTf / (docMeta.euclideanNorm || 1.0);

      const contribution = qData.normWeight * docNormWeight;

      if (!docAccumulator.has(docId)) {
        docAccumulator.set(docId, {
          totalScore: 0,
          termContributions: [],
          titleTfSum: 0,
          bodyTfSum: 0
        });
      }

      const acc = docAccumulator.get(docId);
      acc.totalScore += contribution;
      acc.titleTfSum += posting.titleTf || 0;
      acc.bodyTfSum += posting.bodyTf || 0;
      acc.termContributions.push({
        term,
        queryWeight: Number(qData.normWeight.toFixed(4)),
        docWeight: Number(docNormWeight.toFixed(4)),
        product: Number(contribution.toFixed(4))
      });
    }
  }

  // Fallback: If champion lists yielded too few results, re-run with full postings
  if (useChampionLists && docAccumulator.size < topK) {
    return scoreCosineLncLtc(queryTerms, index, { ...options, useChampionLists: false });
  }

  // 4. Select Top-K using Binary Min-Heap
  const heap = new TopKHeap(topK);

  for (const [docId, acc] of docAccumulator.entries()) {
    const docMeta = index.docs[docId];
    heap.insert({
      docId,
      score: acc.totalScore,
      breakdown: {
        scoringModel: 'SMART lnc.ltc Cosine',
        rawScore: Number(acc.totalScore.toFixed(4)),
        titleTfTotal: acc.titleTfSum,
        bodyTfTotal: acc.bodyTfSum,
        termContributions: acc.termContributions,
        docLength: docMeta.docLength,
        euclideanNorm: Number(docMeta.euclideanNorm.toFixed(4))
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
