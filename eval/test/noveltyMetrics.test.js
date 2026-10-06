/**
 * @file eval/test/noveltyMetrics.test.js
 * @description Unit tests for Novelty, Rewrite Fidelity, and Decision Classification metrics.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRewriteFidelity, computeSpearmanCorrelation } from '../src/metrics/fidelity.js';
import { computeNoveltyAtK } from '../src/metrics/noveltyAtK.js';
import { evaluateDecisionClassification } from '../src/metrics/decisionClassification.js';

describe('Novelty & Fidelity Evaluation Metrics', () => {
  it('computes rewrite fidelity token Jaccard against hand-computed fixture', () => {
    // "apollo 11 landing" -> stems: apollo, 11, land (3)
    // "apollo 11 landing on moon" -> stems: apollo, 11, land, moon (4)
    // intersection = 3, union = 4 -> Jaccard = 0.75
    const fidelity = computeRewriteFidelity('apollo 11 landing', 'apollo 11 landing on moon');
    assert.equal(fidelity, 0.75);

    // Identical queries -> 1.0
    assert.equal(computeRewriteFidelity('vector space model', 'vector space model'), 1.0);

    // Disjoint queries -> 0.0
    assert.equal(computeRewriteFidelity('apollo 11', 'penicillin antibiotic'), 0.0);
  });

  it('computes Spearman rank correlation accurately', () => {
    // Perfect positive correlation
    const x1 = [1, 2, 3, 4, 5];
    const y1 = [10, 20, 30, 40, 50];
    assert.equal(computeSpearmanCorrelation(x1, y1), 1.0);

    // Perfect negative correlation
    const x2 = [1, 2, 3, 4, 5];
    const y2 = [50, 40, 30, 20, 10];
    assert.equal(computeSpearmanCorrelation(x2, y2), -1.0);
  });

  it('computes Novelty@K accurately against known seen passages', () => {
    const rankedList = [
      { docId: 'doc_1' },
      { docId: 'doc_2' },
      { docId: 'doc_3' },
      { docId: 'doc_4' }
    ];
    const seen = new Set(['doc_1', 'doc_3']);

    const res = computeNoveltyAtK(rankedList, seen, 4);
    assert.equal(res.newCount, 2);
    assert.equal(res.seenCount, 2);
    assert.equal(res.noveltyAtK, 0.50);
  });

  it('computes Decision Classification precision, recall, and F1 on hand-crafted labels', () => {
    const records = [
      { queryId: 'q1', predicted: 'carry', expected: 'carry' }, // TP carry
      { queryId: 'q2', predicted: 'carry', expected: 'carry' }, // TP carry
      { queryId: 'q3', predicted: 'entity_switch', expected: 'carry' }, // FP switch, FN carry
      { queryId: 'q4', predicted: 'entity_switch', expected: 'entity_switch' }, // TP switch
      { queryId: 'q5', predicted: 'reset', expected: 'reset' }, // TP reset
      { queryId: 'q6', predicted: 'carry', expected: '' } // unjudged (should be skipped)
    ];

    const evalRes = evaluateDecisionClassification(records);
    assert.equal(evalRes.labeledCount, 5);
    assert.equal(evalRes.totalCount, 6);

    // Carry: TP=2, FP=0, FN=1 -> Prec=1.0, Rec=2/3=0.6667
    assert.equal(evalRes.perClass.carry.precision, 1.0);
    assert.equal(evalRes.perClass.carry.recall, 0.6667);

    // Switch: TP=1, FP=1, FN=0 -> Prec=0.5, Rec=1.0
    assert.equal(evalRes.perClass.entity_switch.precision, 0.5);
    assert.equal(evalRes.perClass.entity_switch.recall, 1.0);

    // Reset: TP=1, FP=0, FN=0 -> Prec=1.0, Rec=1.0, F1=1.0
    assert.equal(evalRes.perClass.reset.f1, 1.0);
  });
});
