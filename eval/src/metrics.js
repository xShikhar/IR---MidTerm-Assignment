/**
 * @file eval/src/metrics.js
 * @description Standard Information Retrieval Evaluation Metrics Engine.
 * Implements Precision@k, Recall@k, Mean Reciprocal Rank (MRR),
 * Normalized Discounted Cumulative Gain (nDCG@10), and Clarification Precision.
 */

/**
 * Computes Precision at rank k.
 *
 * @param {Array<{ docId: string }>} rankedList - Retrieved documents in ranked order
 * @param {Record<string, number>} qrels - Relevant docIds mapping to relevance grade (>= 1 is relevant)
 * @param {number} k - Cutoff rank
 * @returns {number} Precision@k
 */
export function computePrecisionAtK(rankedList, qrels, k) {
  if (!rankedList || rankedList.length === 0 || k <= 0) return 0;
  const topK = rankedList.slice(0, k);
  let relevantCount = 0;

  for (const item of topK) {
    if (qrels[item.docId] && qrels[item.docId] >= 1) {
      relevantCount++;
    }
  }

  return relevantCount / k;
}

/**
 * Computes Recall at rank k.
 *
 * @param {Array<{ docId: string }>} rankedList
 * @param {Record<string, number>} qrels
 * @param {number} k
 * @returns {number} Recall@k
 */
export function computeRecallAtK(rankedList, qrels, k) {
  const totalRelevant = Object.values(qrels).filter(grade => grade >= 1).length;
  if (totalRelevant === 0) return 1.0;
  if (!rankedList || rankedList.length === 0) return 0;

  const topK = rankedList.slice(0, k);
  let relevantCount = 0;

  for (const item of topK) {
    if (qrels[item.docId] && qrels[item.docId] >= 1) {
      relevantCount++;
    }
  }

  return relevantCount / totalRelevant;
}

/**
 * Computes Reciprocal Rank (RR) for a single query.
 *
 * @param {Array<{ docId: string }>} rankedList
 * @param {Record<string, number>} qrels
 * @returns {number} 1 / rank of first relevant doc, or 0 if none
 */
export function computeReciprocalRank(rankedList, qrels) {
  if (!rankedList || rankedList.length === 0) return 0;

  for (let i = 0; i < rankedList.length; i++) {
    const docId = rankedList[i].docId;
    if (qrels[docId] && qrels[docId] >= 1) {
      return 1.0 / (i + 1);
    }
  }

  return 0;
}

/**
 * Computes Normalized Discounted Cumulative Gain at rank k (nDCG@k).
 * Uses exponential gain formulation: Gain = 2^rel - 1, Discount = log2(i + 1).
 *
 * @param {Array<{ docId: string }>} rankedList
 * @param {Record<string, number>} qrels
 * @param {number} k
 * @returns {number} nDCG@k in [0, 1]
 */
export function computeNdcgAtK(rankedList, qrels, k = 10) {
  const topK = (rankedList || []).slice(0, k);
  let dcg = 0;

  for (let i = 0; i < topK.length; i++) {
    const docId = topK[i].docId;
    const rel = qrels[docId] || 0;
    if (rel > 0) {
      const gain = Math.pow(2, rel) - 1;
      const discount = Math.log2(i + 2); // rank 1 is index 0 -> log2(2) = 1
      dcg += gain / discount;
    }
  }

  // Ideal DCG (IDCG): sort all available qrels grades descending
  const idealGrades = Object.values(qrels)
    .filter(g => g > 0)
    .sort((a, b) => b - a)
    .slice(0, k);

  if (idealGrades.length === 0) return 0;

  let idcg = 0;
  for (let i = 0; i < idealGrades.length; i++) {
    const gain = Math.pow(2, idealGrades[i]) - 1;
    const discount = Math.log2(i + 2);
    idcg += gain / discount;
  }

  return idcg > 0 ? dcg / idcg : 0;
}
