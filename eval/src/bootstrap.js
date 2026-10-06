/**
 * @file eval/src/bootstrap.js
 * @description Paired Bootstrap Statistical Significance Test for Information Retrieval.
 * Implements deterministic paired bootstrap resampling with fixed pseudo-random seed.
 * Reference: Smucker, Allan, & Carterette (2007), "A Comparison of Statistical Significance
 * Tests for Information Retrieval Evaluation", CIKM 2007.
 * Efron & Tibshirani (1993), "An Introduction to the Bootstrap".
 */

/**
 * Creates a deterministic 32-bit PRNG (Mulberry32) for reproducible bootstrapping.
 * @param {number} seed
 * @returns {() => number} Returns floating-point numbers in [0, 1).
 */
export function createPrng(seed = 42) {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calculates arithmetic mean of a numeric array.
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (!values || values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/**
 * Computes a given percentile (0 to 100) from an array of numbers.
 * @param {number[]} sortedValues - Must be pre-sorted in ascending order
 * @param {number} p - Percentile between 0 and 100
 * @returns {number}
 */
export function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Runs a two-sided paired bootstrap hypothesis test between two system score vectors.
 *
 * @param {number[]} scoresA - Query metric scores for System A (e.g. nDCG@10 for TurnTrace)
 * @param {number[]} scoresB - Query metric scores for System B (e.g. nDCG@10 for Baseline)
 * @param {Object} [options]
 * @param {number} [options.samples=2000] - Number of bootstrap replications B
 * @param {number} [options.seed=42] - Deterministic PRNG seed
 * @param {number} [options.alpha=0.05] - Significance threshold
 * @returns {{
 *   meanA: number,
 *   meanB: number,
 *   delta: number,
 *   pValue: number,
 *   isSignificant: boolean,
 *   ciLower: number,
 *   ciUpper: number,
 *   sampleCount: number,
 *   replications: number
 * }}
 */
export function pairedBootstrapTest(scoresA, scoresB, options = {}) {
  if (!Array.isArray(scoresA) || !Array.isArray(scoresB)) {
    throw new TypeError('Both score vectors must be arrays.');
  }
  if (scoresA.length !== scoresB.length) {
    throw new Error(`Score vectors must have identical length: got ${scoresA.length} and ${scoresB.length}.`);
  }
  const n = scoresA.length;
  if (n === 0) {
    return {
      meanA: 0,
      meanB: 0,
      delta: 0,
      pValue: 1.0,
      isSignificant: false,
      ciLower: 0,
      ciUpper: 0,
      sampleCount: 0,
      replications: 0
    };
  }

  const B = options.samples || 2000;
  const seed = options.seed ?? 42;
  const alpha = options.alpha ?? 0.05;
  const rng = createPrng(seed);

  const meanA = mean(scoresA);
  const meanB = mean(scoresB);
  const observedDelta = meanA - meanB;

  // Differences per query
  const diffs = new Array(n);
  for (let i = 0; i < n; i++) {
    diffs[i] = scoresA[i] - scoresB[i];
  }

  // Pre-allocate bootstrap differences array
  const bootstrapDeltas = new Float64Array(B);
  let countExtreme = 0;

  for (let b = 0; b < B; b++) {
    let bSum = 0;
    for (let i = 0; i < n; i++) {
      const randIdx = Math.floor(rng() * n);
      bSum += diffs[randIdx];
    }
    const bMean = bSum / n;
    bootstrapDeltas[b] = bMean;

    // Centered difference under null hypothesis H0 (E[delta] = 0)
    const centeredDelta = bMean - observedDelta;
    if (Math.abs(centeredDelta) >= Math.abs(observedDelta)) {
      countExtreme++;
    }
  }

  // Two-sided empirical p-value
  const pValue = countExtreme / B;

  // 95% Bootstrap Confidence Interval
  const sortedDeltas = Array.from(bootstrapDeltas).sort((a, b) => a - b);
  const ciLower = percentile(sortedDeltas, (alpha / 2) * 100);
  const ciUpper = percentile(sortedDeltas, (1 - alpha / 2) * 100);

  return {
    meanA: Number(meanA.toFixed(4)),
    meanB: Number(meanB.toFixed(4)),
    delta: Number(observedDelta.toFixed(4)),
    pValue: Number(pValue.toFixed(4)),
    isSignificant: pValue < alpha,
    ciLower: Number(ciLower.toFixed(4)),
    ciUpper: Number(ciUpper.toFixed(4)),
    sampleCount: n,
    replications: B,
    formattedPValue: `${Number(pValue.toFixed(4))} (n=${n})`
  };
}
