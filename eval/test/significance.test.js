/**
 * @file eval/test/significance.test.js
 * @description Unit tests for statistical significance modules:
 * deterministic paired bootstrap and Wilcoxon signed-rank tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPrng, pairedBootstrapTest } from '../src/bootstrap.js';
import { wilcoxonSignedRankTest } from '../src/wilcoxon.js';
import { compareSystems } from '../src/significance.js';

describe('Statistical Significance: Deterministic PRNG & Paired Bootstrap', () => {
  it('generates reproducible pseudo-random numbers with fixed seed', () => {
    const rng1 = createPrng(42);
    const rng2 = createPrng(42);
    const seq1 = [rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2()];
    assert.deepEqual(seq1, seq2);

    const rngDifferent = createPrng(999);
    assert.notEqual(seq1[0], rngDifferent());
  });

  it('reports non-significance when comparing identical score vectors', () => {
    const scoresA = [0.8, 0.7, 0.6, 0.9, 0.5, 0.4, 0.85, 0.75];
    const scoresB = [0.8, 0.7, 0.6, 0.9, 0.5, 0.4, 0.85, 0.75];

    const result = pairedBootstrapTest(scoresA, scoresB, { seed: 42, samples: 1000 });
    assert.equal(result.delta, 0);
    assert.equal(result.pValue, 1.0);
    assert.equal(result.isSignificant, false);
    assert.equal(result.sampleCount, 8);
  });

  it('detects strong statistical significance when System A clearly outperforms System B', () => {
    const scoresA = [0.95, 0.90, 0.88, 0.92, 0.89, 0.94, 0.91, 0.87, 0.93, 0.90];
    const scoresB = [0.20, 0.15, 0.25, 0.18, 0.22, 0.19, 0.24, 0.21, 0.17, 0.23];

    const result = pairedBootstrapTest(scoresA, scoresB, { seed: 42, samples: 1000 });
    assert.ok(result.delta > 0.6);
    assert.ok(result.pValue < 0.001);
    assert.equal(result.isSignificant, true);
    assert.ok(result.ciLower > 0.6);
    assert.ok(result.ciUpper > 0.6);
  });

  it('reproduces exact identical p-values across separate calls with fixed seed', () => {
    const a = [0.5, 0.6, 0.7, 0.4, 0.8];
    const b = [0.4, 0.5, 0.6, 0.3, 0.7];

    const res1 = pairedBootstrapTest(a, b, { seed: 42, samples: 500 });
    const res2 = pairedBootstrapTest(a, b, { seed: 42, samples: 500 });
    assert.equal(res1.pValue, res2.pValue);
    assert.equal(res1.delta, res2.delta);
    assert.equal(res1.ciLower, res2.ciLower);
    assert.equal(res1.ciUpper, res2.ciUpper);
  });
});

describe('Statistical Significance: Wilcoxon Signed-Rank Test', () => {
  it('returns pValue = 1.0 and zero statistic when all differences are zero', () => {
    const a = [0.5, 0.6, 0.7];
    const b = [0.5, 0.6, 0.7];

    const result = wilcoxonSignedRankTest(a, b);
    assert.equal(result.nonZeroPairs, 0);
    assert.equal(result.pValue, 1.0);
    assert.equal(result.isSignificant, false);
  });

  it('detects significant difference on shifted paired distributions', () => {
    const a = [0.85, 0.90, 0.82, 0.88, 0.91, 0.89, 0.86, 0.94, 0.87, 0.92, 0.85, 0.90];
    const b = [0.40, 0.35, 0.42, 0.38, 0.45, 0.41, 0.39, 0.44, 0.37, 0.43, 0.36, 0.40];

    const result = wilcoxonSignedRankTest(a, b);
    assert.equal(result.nonZeroPairs, 12);
    assert.ok(result.wMinus === 0);
    assert.ok(result.pValue < 0.01);
    assert.equal(result.isSignificant, true);
  });

  it('handles tied differences correctly without divergence', () => {
    const a = [0.8, 0.8, 0.8, 0.6, 0.7];
    const b = [0.5, 0.5, 0.5, 0.6, 0.4];

    const result = wilcoxonSignedRankTest(a, b);
    assert.ok(result.nonZeroPairs >= 3);
    assert.ok(result.pValue >= 0 && result.pValue <= 1);
  });
});

describe('Statistical Significance: End-to-End System Comparison Orchestration', () => {
  it('aligns records by conversation and turn, running both tests', () => {
    const recordsA = [
      { convId: 'c1', turnId: 't1', ndcg10: 0.9 },
      { convId: 'c1', turnId: 't2', ndcg10: 0.85 },
      { convId: 'c2', turnId: 't1', ndcg10: 0.8 }
    ];
    const recordsB = [
      { convId: 'c1', turnId: 't1', ndcg10: 0.4 },
      { convId: 'c1', turnId: 't2', ndcg10: 0.35 },
      { convId: 'c2', turnId: 't1', ndcg10: 0.3 }
    ];

    const comparison = compareSystems(recordsA, recordsB, 'ndcg10', { seed: 42, samples: 500 });
    assert.equal(comparison.turnCount, 3);
    assert.equal(comparison.metric, 'ndcg10');
    assert.ok(comparison.bootstrap);
    assert.ok(comparison.wilcoxon);
    assert.ok(comparison.bootstrap.delta > 0);
  });
});
