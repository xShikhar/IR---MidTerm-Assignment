/**
 * @file eval/test/metrics.test.js
 * @description Unit tests for evaluation metrics calculations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePrecisionAtK, computeRecallAtK, computeReciprocalRank, computeNdcgAtK } from '../src/metrics.js';

describe('Evaluation Metrics: Precision, Recall, MRR, and nDCG', () => {
  const qrels = {
    doc_1: 2, // Highly relevant
    doc_2: 1, // Relevant
    doc_3: 0  // Irrelevant
  };

  it('computes Precision@k accurately', () => {
    const rankedList = [{ docId: 'doc_1' }, { docId: 'doc_3' }, { docId: 'doc_2' }];
    assert.equal(computePrecisionAtK(rankedList, qrels, 2), 1 / 2); // 1 relevant in top 2
    assert.equal(computePrecisionAtK(rankedList, qrels, 3), 2 / 3); // 2 relevant in top 3
  });

  it('computes Recall@k accurately', () => {
    const rankedList = [{ docId: 'doc_1' }, { docId: 'doc_3' }];
    // Total relevant in qrels = 2 (doc_1 and doc_2)
    assert.equal(computeRecallAtK(rankedList, qrels, 2), 1 / 2);
  });

  it('computes Mean Reciprocal Rank (MRR)', () => {
    const rankedA = [{ docId: 'doc_1' }]; // rank 1 -> 1.0
    const rankedB = [{ docId: 'doc_3' }, { docId: 'doc_2' }]; // rank 2 -> 0.5
    const rankedC = [{ docId: 'doc_3' }]; // none -> 0

    assert.equal(computeReciprocalRank(rankedA, qrels), 1.0);
    assert.equal(computeReciprocalRank(rankedB, qrels), 0.5);
    assert.equal(computeReciprocalRank(rankedC, qrels), 0.0);
  });

  it('computes nDCG@k with graded relevance', () => {
    // Ideal order: doc_1 (rel 2), doc_2 (rel 1), doc_3 (rel 0)
    const perfectRanking = [{ docId: 'doc_1' }, { docId: 'doc_2' }, { docId: 'doc_3' }];
    assert.equal(computeNdcgAtK(perfectRanking, qrels, 3), 1.0);

    // Inverted ranking: doc_2 (rel 1), doc_1 (rel 2)
    const invertedRanking = [{ docId: 'doc_2' }, { docId: 'doc_1' }, { docId: 'doc_3' }];
    const ndcg = computeNdcgAtK(invertedRanking, qrels, 3);
    assert.ok(ndcg < 1.0 && ndcg > 0.75);
    assert.equal(Number(ndcg.toFixed(4)), 0.7967);
  });
});
