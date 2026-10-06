/**
 * @file server/test/retrieval.test.js
 * @description Unit tests for Phase 3 Core Retrieval & Scoring Engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TopKHeap } from '../src/retrieval/heap.js';
import { scoreCosineLncLtc } from '../src/retrieval/cosine.js';
import { scoreBM25 } from '../src/retrieval/bm25.js';
import { evaluateBooleanAnd, evaluateEntityConstraints } from '../src/retrieval/boolean.js';
import { evaluatePhraseQuery } from '../src/retrieval/phrase.js';
import { reciprocalRankFusion, scoreSumFusion } from '../src/retrieval/fusion.js';
import { eliminateLowIdfTerms } from '../src/retrieval/indexElimination.js';
import { buildIndex } from '../src/index/builder.js';

describe('Retrieval Engine: Top-K Binary Min-Heap', () => {
  it('maintains exactly top K elements in descending sorted order', () => {
    const heap = new TopKHeap(3);
    const scores = [0.1, 0.9, 0.4, 0.7, 0.2, 0.85];

    scores.forEach((s, idx) => {
      heap.insert({ docId: `doc_${idx}`, score: s });
    });

    assert.equal(heap.size(), 3);
    const sorted = heap.toSortedArray();
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].score, 0.9);
    assert.equal(sorted[1].score, 0.85);
    assert.equal(sorted[2].score, 0.7);
  });
});

describe('Retrieval Engine: Scoring & Ranking Models', () => {
  const samplePassages = [
    {
      docId: 'doc_1',
      title: 'Information Retrieval and Vector Space',
      body: 'The vector space model calculates cosine similarity between term vectors.',
      domain: 'cs_ai'
    },
    {
      docId: 'doc_2',
      title: 'Deep Learning Transformers',
      body: 'Transformer architectures rely on multi-head attention and self-attention.',
      domain: 'cs_ai'
    },
    {
      docId: 'doc_3',
      title: 'Space Telescopes and Astronomy',
      body: 'James Webb observes distant galaxies in infrared wavelengths.',
      domain: 'space_physics'
    }
  ];

  const index = buildIndex(samplePassages);

  it('computes SMART lnc.ltc cosine scores with intermediate breakdown', () => {
    const results = scoreCosineLncLtc(['vector', 'space', 'model'], index, { topK: 5 });
    assert.ok(results.length > 0);
    assert.equal(results[0].docId, 'doc_1');
    assert.ok(results[0].score > 0);
    assert.equal(results[0].breakdown.scoringModel, 'SMART lnc.ltc Cosine');
    assert.ok(results[0].breakdown.termContributions.length > 0);
  });

  it('computes Okapi BM25 scores with length normalization', () => {
    const results = scoreBM25(['vector', 'space'], index, { topK: 5 });
    assert.ok(results.length > 0);
    assert.equal(results[0].docId, 'doc_1');
    assert.ok(results[0].score > 0);
    assert.equal(results[0].breakdown.scoringModel, 'Okapi BM25');
  });

  it('filters low IDF terms with index elimination', () => {
    const dict = {
      rare: { df: 1, idf: 3.5 },
      common: { df: 100, idf: 0.05 }
    };
    const { retainedTerms, eliminatedTerms } = eliminateLowIdfTerms(['rare', 'common'], dict, 0.20);
    assert.deepEqual(retainedTerms, ['rare']);
    assert.deepEqual(eliminatedTerms, ['common']);
  });
});

describe('Retrieval Engine: Boolean & Phrase Operations', () => {
  const samplePassages = [
    {
      docId: 'doc_1',
      title: 'Alan Turing',
      body: 'Alan Turing proposed the universal Turing machine.',
      domain: 'cs_ai'
    },
    {
      docId: 'doc_2',
      title: 'Turing Test',
      body: 'The imitation game evaluates artificial machine intelligence.',
      domain: 'cs_ai'
    }
  ];
  const index = buildIndex(samplePassages);

  it('evaluates Boolean AND with DF ordering', () => {
    const res = evaluateBooleanAnd(['alan', 'turing'], index);
    assert.equal(res.length, 1);
    assert.equal(res[0].docId, 'doc_1');
  });

  it('falls back to OR when AND is empty in entity constraints', () => {
    const res = evaluateEntityConstraints(['alan', 'imitation'], index);
    assert.equal(res.mode, 'OR_FALLBACK');
    assert.equal(res.postings.length, 2);
  });

  it('evaluates exact positional phrases', () => {
    const res = evaluatePhraseQuery('Alan Turing', index);
    assert.equal(res.length, 1);
    assert.equal(res[0].docId, 'doc_1');
  });
});

describe('Retrieval Engine: Rank Fusion', () => {
  it('combines multiple rankings via Reciprocal Rank Fusion (RRF)', () => {
    const listA = [{ docId: 'doc_1', score: 0.9 }, { docId: 'doc_2', score: 0.8 }];
    const listB = [{ docId: 'doc_2', score: 0.95 }, { docId: 'doc_3', score: 0.7 }];

    const fused = reciprocalRankFusion([listA, listB], 60);
    assert.equal(fused.length, 3);
    // doc_2 is rank 2 in listA and rank 1 in listB -> 1/62 + 1/61 = 0.016129 + 0.016393 = 0.0325
    // doc_1 is rank 1 in listA -> 1/61 = 0.016393
    // doc_2 should be ranked 1st overall in RRF
    assert.equal(fused[0].docId, 'doc_2');
    assert.ok(fused[0].score > fused[1].score);
  });

  it('combines rankings via Score-Sum Fusion with min-max normalization', () => {
    const listA = [{ docId: 'doc_1', score: 10 }, { docId: 'doc_2', score: 5 }];
    const listB = [{ docId: 'doc_2', score: 100 }, { docId: 'doc_1', score: 50 }];

    const fused = scoreSumFusion([listA, listB]);
    assert.equal(fused.length, 2);
    assert.ok(fused[0].score > 0);
  });
});
