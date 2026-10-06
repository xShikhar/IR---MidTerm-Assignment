/**
 * @file eval/src/wilcoxon.js
 * @description Wilcoxon Signed-Rank Non-Parametric Significance Test for Paired Retrieval Metrics.
 * Implements tie-adjusted rank sums and continuity-corrected normal approximation.
 * Reference: Wilcoxon, F. (1945), "Individual comparisons by ranking methods", Biometrics Bulletin.
 */

/**
 * Standard error function approximation (Abramowitz & Stegun formula 7.1.26).
 * Maximum absolute error < 1.5e-7.
 * @param {number} x
 * @returns {number}
 */
export function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Cumulative distribution function of standard normal distribution N(0, 1).
 * @param {number} z
 * @returns {number}
 */
export function normalCdf(z) {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Runs a two-sided Wilcoxon Signed-Rank test on paired score vectors.
 *
 * @param {number[]} scoresA - Query scores for System A
 * @param {number[]} scoresB - Query scores for System B
 * @param {Object} [options]
 * @param {number} [options.alpha=0.05] - Significance threshold
 * @returns {{
 *   wPlus: number,
 *   wMinus: number,
 *   wStat: number,
 *   zScore: number,
 *   pValue: number,
 *   isSignificant: boolean,
 *   nPairs: number,
 *   nonZeroPairs: number
 * }}
 */
export function wilcoxonSignedRankTest(scoresA, scoresB, options = {}) {
  if (!Array.isArray(scoresA) || !Array.isArray(scoresB)) {
    throw new TypeError('Both score vectors must be arrays.');
  }
  if (scoresA.length !== scoresB.length) {
    throw new Error(`Score vectors must have identical length: got ${scoresA.length} and ${scoresB.length}.`);
  }

  const alpha = options.alpha ?? 0.05;
  const n = scoresA.length;

  // 1. Calculate non-zero differences
  const diffEntries = [];
  for (let i = 0; i < n; i++) {
    const diff = scoresA[i] - scoresB[i];
    if (Math.abs(diff) > 1e-9) {
      diffEntries.push({ diff, absDiff: Math.abs(diff) });
    }
  }

  const Nr = diffEntries.length;
  if (Nr === 0) {
    return {
      wPlus: 0,
      wMinus: 0,
      wStat: 0,
      zScore: 0,
      pValue: 1.0,
      isSignificant: false,
      nPairs: n,
      nonZeroPairs: 0
    };
  }

  // 2. Sort by absolute difference
  diffEntries.sort((a, b) => a.absDiff - b.absDiff);

  // 3. Assign ranks with tie averaging
  let i = 0;
  let tieCorrection = 0;

  while (i < Nr) {
    let j = i;
    while (j < Nr - 1 && Math.abs(diffEntries[j + 1].absDiff - diffEntries[i].absDiff) < 1e-9) {
      j++;
    }
    const tieCount = j - i + 1;
    // Average rank for tied group: sum of ranks from (i+1) to (j+1) divided by tieCount
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      diffEntries[k].rank = avgRank;
    }
    if (tieCount > 1) {
      tieCorrection += (Math.pow(tieCount, 3) - tieCount) / 2;
    }
    i = j + 1;
  }

  // 4. Sum positive and negative ranks
  let wPlus = 0;
  let wMinus = 0;
  for (const entry of diffEntries) {
    if (entry.diff > 0) {
      wPlus += entry.rank;
    } else {
      wMinus += entry.rank;
    }
  }

  const wStat = Math.min(wPlus, wMinus);

  // 5. Normal approximation with continuity correction and tie adjustment
  const meanW = (Nr * (Nr + 1)) / 4;
  const varW = (Nr * (Nr + 1) * (2 * Nr + 1) - tieCorrection) / 24;
  const stdW = Math.sqrt(Math.max(varW, 1e-9));

  // Continuity correction towards mean
  const diffFromMean = wPlus - meanW;
  const continuityCorrection = diffFromMean > 0 ? 0.5 : (diffFromMean < 0 ? -0.5 : 0);
  const zScore = (diffFromMean - continuityCorrection) / stdW;

  // Two-sided p-value
  const pValue = 2 * (1.0 - normalCdf(Math.abs(zScore)));

  return {
    wPlus: Number(wPlus.toFixed(2)),
    wMinus: Number(wMinus.toFixed(2)),
    wStat: Number(wStat.toFixed(2)),
    zScore: Number(zScore.toFixed(4)),
    pValue: Number(Math.min(1.0, Math.max(0.0, pValue)).toFixed(4)),
    isSignificant: pValue < alpha,
    nPairs: n,
    nonZeroPairs: Nr,
    formattedPValue: `${Number(Math.min(1.0, Math.max(0.0, pValue)).toFixed(4))} (n=${Nr})`
  };
}
