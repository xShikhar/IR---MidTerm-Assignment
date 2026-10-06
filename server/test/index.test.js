/**
 * @file server/test/index.test.js
 * @description Unit tests for Phase 2 Indexing Engine using native node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, tokenizeWithPositions } from '../src/index/tokenizer.js';
import { stem } from '../src/index/porterStemmer.js';
import { normalizeToken, isStopWord, removeDiacritics, analyze } from '../src/index/normalizer.js';
import { Posting, intersectPostings, unionPostings, negatePostings, positionalIntersect } from '../src/index/postings.js';
import { buildIndex } from '../src/index/builder.js';
import { buildChampionLists } from '../src/index/championLists.js';

describe('Indexing Engine: Tokenizer & Positional Offsets', () => {
  it('tokenizes text and strips punctuation while maintaining order', () => {
    const text = 'Information Retrieval, Vector-Space Model: 2026!';
    const tokens = tokenize(text);
    assert.deepEqual(tokens, ['information', 'retrieval', 'vector', 'space', 'model', '2026']);
  });

  it('preserves exact positional offsets for tokens', () => {
    const text = 'Search engines use inverted indexes.';
    const positional = tokenizeWithPositions(text);
    assert.equal(positional.length, 5);
    assert.equal(positional[0].cleanToken, 'search');
    assert.equal(positional[0].position, 0);
    assert.equal(positional[4].cleanToken, 'indexes');
    assert.equal(positional[4].position, 4);
  });

  it('tokenizes words with diacritics without splitting characters', () => {
    const text = 'café résumé';
    const tokens = tokenize(text);
    assert.deepEqual(tokens, ['cafe', 'resume']);
    const analyzed = analyze(text);
    assert.deepEqual(analyzed, ['cafe', 'resum']);
  });
});

describe('Indexing Engine: Normalizer & Porter Stemmer', () => {
  it('removes diacritics and accents correctly', () => {
    const text = 'Crème brûlée and résumé';
    assert.equal(removeDiacritics(text), 'Creme brulee and resume');
  });

  it('correctly identifies stop words', () => {
    assert.equal(isStopWord('the'), true);
    assert.equal(isStopWord('and'), true);
    assert.equal(isStopWord('retrieval'), false);
  });

  it('stems words according to Porter 1980 rules', () => {
    assert.equal(stem('retrieval'), 'retriev');
    assert.equal(stem('retrieved'), 'retriev');
    assert.equal(stem('retrieving'), 'retriev');
    assert.equal(stem('connects'), 'connect');
    assert.equal(stem('connecting'), 'connect');
    assert.equal(stem('connection'), 'connect');
    assert.equal(stem('relational'), 'relat');
    assert.equal(stem('conditional'), 'condit');
  });

  it('runs high-level analyze pipeline filtering stop words', () => {
    const result = analyze('The inverted index calculates term frequencies.');
    assert.ok(!result.includes('the'));
    assert.ok(result.includes('invert'));
    assert.ok(result.includes('index'));
    assert.ok(result.includes('calcul'));
    assert.ok(result.includes('term'));
    assert.ok(result.includes('frequenc'));
  });
});

describe('Indexing Engine: Postings List Intersection & Phrases', () => {
  it('merges postings using two-pointer Boolean AND intersection', () => {
    const p1 = [new Posting('doc_1'), new Posting('doc_3'), new Posting('doc_5')];
    const p2 = [new Posting('doc_2'), new Posting('doc_3'), new Posting('doc_5'), new Posting('doc_6')];

    p1[0].tf = 1; p1[1].tf = 2; p1[2].tf = 1;
    p2[0].tf = 1; p2[1].tf = 3; p2[2].tf = 4; p2[3].tf = 1;

    const intersected = intersectPostings(p1, p2);
    assert.equal(intersected.length, 2);
    assert.equal(intersected[0].docId, 'doc_3');
    assert.equal(intersected[0].tf, 5); // 2 + 3
    assert.equal(intersected[1].docId, 'doc_5');
    assert.equal(intersected[1].tf, 5); // 1 + 4
  });

  it('merges postings using Boolean OR union', () => {
    const p1 = [new Posting('doc_1'), new Posting('doc_3')];
    const p2 = [new Posting('doc_2'), new Posting('doc_3')];

    const union = unionPostings(p1, p2);
    assert.equal(union.length, 3);
    assert.deepEqual(union.map(p => p.docId), ['doc_1', 'doc_2', 'doc_3']);
  });

  it('computes Boolean NOT complement against all document IDs', () => {
    const p = [new Posting('doc_2')];
    const allDocIds = ['doc_1', 'doc_2', 'doc_3'];
    const negated = negatePostings(p, allDocIds);
    assert.deepEqual(negated.map(n => n.docId), ['doc_1', 'doc_3']);
  });

  it('performs positional intersection for exact phrase search (distance = 1)', () => {
    const p1 = new Posting('doc_1');
    p1.positions = [2, 10, 25];

    const p2 = new Posting('doc_1');
    p2.positions = [3, 15, 26];

    const matched = positionalIntersect([p1], [p2], 1);
    assert.equal(matched.length, 1);
    assert.equal(matched[0].docId, 'doc_1');
    assert.equal(matched[0].tf, 2); // (2->3) and (25->26)
    assert.deepEqual(matched[0].positions, [3, 26]);
  });
});

describe('Indexing Engine: Index Builder & Champion Lists', () => {
  it('builds multi-zone index with Euclidean norm and BM25 statistics', () => {
    const passages = [
      {
        docId: 'doc_1',
        title: 'Information Retrieval Basics',
        body: 'Information retrieval systems index documents and compute term weights.',
        domain: 'cs_ai'
      },
      {
        docId: 'doc_2',
        title: 'Space Missions',
        body: 'Space missions explore distant planets and astrophysical phenomena.',
        domain: 'space_physics'
      }
    ];

    const index = buildIndex(passages);
    assert.equal(index.metadata.totalDocs, 2);
    assert.ok(index.docs['doc_1']);
    assert.ok(index.docs['doc_1'].euclideanNorm > 0);
    assert.ok(index.dictionary['retriev']);
    assert.equal(index.dictionary['retriev'].df, 1);
    assert.ok(index.dictionary['retriev'].idf > 0);

    const champ = buildChampionLists(index.dictionary, 5);
    assert.ok(champ['retriev']);
    assert.equal(champ['retriev'][0].docId, 'doc_1');
  });
});
