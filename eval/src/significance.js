/**
 * @file eval/src/significance.js
 * @description Statistical Significance Analysis Hub for IR Evaluation.
 * Combines Paired Bootstrap (fixed seed) and Wilcoxon Signed-Rank tests
 * to establish statistical rigor across system comparisons.
 */

import { pairedBootstrapTest } from './bootstrap.js';
import { wilcoxonSignedRankTest } from './wilcoxon.js';

export { pairedBootstrapTest } from './bootstrap.js';
export { wilcoxonSignedRankTest } from './wilcoxon.js';

/**
 * Compares two systems across paired per-turn evaluation records.
 *
 * @param {Array<Object>} recordsA - Raw turn records for System A
 * @param {Array<Object>} recordsB - Raw turn records for System B
 * @param {string} [metric='ndcg10'] - Metric key (e.g., 'ndcg10', 'rr', 'p5', 'p10', 'recall20')
 * @param {Object} [options]
 * @param {number} [options.seed=42]
 * @param {number} [options.samples=2000]
 * @param {number} [options.alpha=0.05]
 * @returns {{
 *   metric: string,
 *   turnCount: number,
 *   bootstrap: Object,
 *   wilcoxon: Object
 * }}
 */
export function compareSystems(recordsA, recordsB, metric = 'ndcg10', options = {}) {
  if (!Array.isArray(recordsA) || !Array.isArray(recordsB)) {
    throw new TypeError('Records must be arrays of turn-level metrics.');
  }

  // Align records by convId and turnId
  const mapB = new Map();
  for (const r of recordsB) {
    const key = `${r.convId}_${r.turnId}`;
    mapB.set(key, r);
  }

  const scoresA = [];
  const scoresB = [];

  for (const rA of recordsA) {
    const key = `${rA.convId}_${rA.turnId}`;
    const rB = mapB.get(key);
    if (rB !== undefined && typeof rA[metric] === 'number' && typeof rB[metric] === 'number') {
      scoresA.push(rA[metric]);
      scoresB.push(rB[metric]);
    }
  }

  if (scoresA.length === 0) {
    throw new Error(`No matching aligned records found for metric "${metric}".`);
  }

  const bootstrap = pairedBootstrapTest(scoresA, scoresB, options);
  const wilcoxon = wilcoxonSignedRankTest(scoresA, scoresB, options);

  return {
    metric,
    turnCount: scoresA.length,
    bootstrap,
    wilcoxon
  };
}
