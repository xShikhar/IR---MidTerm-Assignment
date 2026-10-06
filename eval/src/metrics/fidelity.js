/**
 * @file eval/src/metrics/fidelity.js
 * @description Rewrite Fidelity Metric and Correlation Engine.
 * Evaluates the token-level Jaccard similarity between the system-rewritten query
 * and the human-curated gold rewrite (stemmed, stopword-free token sets).
 * Computes Spearman rank correlation between rewrite fidelity and Precision@10.
 *
 * NOTE: Strictly restricted to evaluation harness. Never called in runtime retrieval.
 */

import { analyze } from '../../../server/src/index/normalizer.js';

/**
 * Computes Jaccard similarity between two queries' stemmed, stopword-free token sets.
 *
 * @param {string} systemQuery - System rewritten query
 * @param {string} goldQuery - Human reference gold rewrite
 * @returns {number} Jaccard coefficient in [0, 1]
 */
export function computeRewriteFidelity(systemQuery, goldQuery) {
  if (!systemQuery && !goldQuery) return 1.0;
  if (!systemQuery || !goldQuery) return 0.0;

  const setA = new Set(analyze(systemQuery, true));
  const setB = new Set(analyze(goldQuery, true));

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection++;
    }
  }

  const unionSize = setA.size + setB.size - intersection;
  return unionSize > 0 ? Number((intersection / unionSize).toFixed(4)) : 0.0;
}

/**
 * Assigns fractional ranks handling ties.
 *
 * @param {number[]} values
 * @returns {number[]}
 */
function computeRanks(values) {
  const n = values.length;
  const indexed = values.map((val, idx) => ({ val, idx }));
  indexed.sort((a, b) => a.val - b.val);

  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].val === indexed[j].val) {
      j++;
    }
    const avgRank = 1 + (i + j) / 2.0;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Computes Spearman rank correlation coefficient between two arrays of numbers.
 *
 * @param {number[]} x - e.g. Rewrite fidelity scores
 * @param {number[]} y - e.g. Precision@10 scores
 * @returns {number} Spearman rho in [-1, 1]
 */
export function computeSpearmanCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return 0.0;
  }

  const n = x.length;
  const rankX = computeRanks(x);
  const rankY = computeRanks(y);

  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < n; i++) {
    meanX += rankX[i];
    meanY += rankY[i];
  }
  meanX /= n;
  meanY /= n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = rankX[i] - meanX;
    const diffY = rankY[i] - meanY;
    num += diffX * diffY;
    denX += diffX * diffX;
    denY += diffY * diffY;
  }

  const den = Math.sqrt(denX) * Math.sqrt(denY);
  return den > 0 ? Number((num / den).toFixed(4)) : 0.0;
}
