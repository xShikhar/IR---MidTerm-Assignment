/**
 * @file server/test/conversation.test.js
 * @description Unit tests for Phase 4 Conversational Layer and Trace Assembly.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ContextState } from '../src/conversation/contextState.js';
import { detectTopicShift } from '../src/conversation/shiftDetector.js';
import { rewriteQuery } from '../src/conversation/rewriter.js';
import { isMultiPartQuery, extractSubQueries } from '../src/conversation/decomposer.js';
import { evaluateClarification, clusterPassages } from '../src/conversation/clarifier.js';
import { executeConversationalTurn } from '../src/api/traceAssembly.js';
import { buildIndex } from '../src/index/builder.js';

describe('Conversation Layer: Context State & Exponential Decay', () => {
  const samplePassages = [
    {
      docId: 'doc_1',
      title: 'Vector Space Model',
      body: 'Information retrieval systems compute cosine similarity over inverted index vectors.',
      domain: 'cs_ai'
    }
  ];
  const index = buildIndex(samplePassages);

  it('ingests query and top passage terms with initial weight', () => {
    const context = new ContextState({ lambda: 0.75 });
    context.update('vector space model', samplePassages, index);

    const prov = context.getProvenanceList();
    assert.ok(prov.length > 0);
    const vectorTerm = prov.find(p => p.term === 'vector');
    assert.ok(vectorTerm);
    assert.equal(vectorTerm.age, 0);
    assert.equal(vectorTerm.decayFactor, 1.0);
  });

  it('decays term weights exponentially across dialogue turns', () => {
    const context = new ContextState({ lambda: 0.5 });
    context.update('vector space', samplePassages, index);

    const initialWeight = context.terms.get('vector').currentWeight;
    context.decayAll(); // Turn 1
    const decayedWeight1 = context.terms.get('vector').currentWeight;
    assert.equal(decayedWeight1, Number((initialWeight * 0.5).toFixed(4)));

    context.decayAll(); // Turn 2
    const decayedWeight2 = context.terms.get('vector').currentWeight;
    assert.equal(decayedWeight2, Number((initialWeight * 0.25).toFixed(4)));
  });
});

describe('Conversation Layer: Topic Shift Detector', () => {
  const passages = [
    {
      docId: 'doc_1',
      title: 'Turing Test',
      body: 'Alan Turing proposed the imitation game for artificial machine intelligence.',
      domain: 'cs_ai'
    },
    {
      docId: 'doc_2',
      title: 'Black Holes',
      body: 'General relativity predicts an event horizon around astrophysical black holes.',
      domain: 'space_physics'
    }
  ];
  const index = buildIndex(passages);

  it('detects continuation on high topical overlap', () => {
    const context = new ContextState();
    context.update('Alan Turing machine intelligence', passages, index);
    const res = detectTopicShift('What did Turing propose?', context.getVector(), index);
    assert.equal(res.decision, 'CARRY');
  });

  it('overrides low cosine when pronouns or ellipsis are present', () => {
    const context = new ContextState();
    context.update('Alan Turing machine intelligence', passages, index);
    const res = detectTopicShift('Did it work?', context.getVector(), index);
    assert.equal(res.decision, 'CARRY');
    assert.equal(res.signals.hasPronoun, true);
  });

  it('detects topic shift when cosine is low and no anaphora exists', () => {
    const context = new ContextState();
    context.update('Alan Turing machine intelligence', passages, index);
    const res = detectTopicShift('What is an astrophysical black hole?', context.getVector(), index);
    assert.equal(res.decision, 'RESET');
  });
});

describe('Conversation Layer: Query Rewriting with Provenance', () => {
  it('expands query with top decayed context terms on CARRY', () => {
    const context = new ContextState();
    context.terms.set('turing', {
      term: 'turing',
      sourceTurn: 1,
      sourceType: 'query',
      rawWeight: 2.5,
      decayFactor: 1.0,
      currentWeight: 2.5,
      idf: 2.5
    });

    const rewrite = rewriteQuery('How does the test work?', context, 'CARRY');
    assert.equal(rewrite.mode, 'EXPANDED');
    assert.ok(rewrite.rewrittenQuery.includes('turing'));
    assert.equal(rewrite.addedTerms.length, 1);
    assert.equal(rewrite.addedTerms[0].term, 'turing');
  });

  it('resets context and avoids expansion on RESET', () => {
    const context = new ContextState();
    context.terms.set('turing', {
      term: 'turing',
      sourceTurn: 1,
      sourceType: 'query',
      rawWeight: 2.5,
      decayFactor: 1.0,
      currentWeight: 2.5,
      idf: 2.5
    });

    const rewrite = rewriteQuery('Who painted the Mona Lisa?', context, 'RESET');
    assert.equal(rewrite.mode, 'STANDALONE');
    assert.equal(rewrite.rewrittenQuery, 'Who painted the Mona Lisa?');
    assert.equal(rewrite.addedTerms.length, 0);
    assert.equal(context.terms.size, 0);
  });
});

describe('Conversation Layer: Multi-Part Query Decomposer', () => {
  it('identifies comparative queries and extracts clauses', () => {
    const q = 'Compare vector space model with Okapi BM25';
    assert.equal(isMultiPartQuery(q), true);
    const parts = extractSubQueries(q);
    assert.equal(parts.length, 2);
    assert.equal(parts[0], 'vector space model');
    assert.equal(parts[1], 'Okapi BM25');
  });
});

describe('Conversation Layer: Cluster Clarifier', () => {
  const index = {
    dictionary: {
      planet: { idf: 2.0 },
      element: { idf: 2.2 },
      orbit: { idf: 1.8 },
      toxic: { idf: 2.1 }
    }
  };

  it('does not fire when confidence margin is high', () => {
    const results = [
      { docId: '1', score: 0.95, title: 'Mercury Planet Orbit', body: 'Planet Mercury orbits Sun.' },
      { docId: '2', score: 0.60, title: 'Planetary Science', body: 'Solar system bodies.' }
    ];
    const clarify = evaluateClarification(results, index, { marginThreshold: 0.1 });
    assert.equal(clarify.fired, false);
    assert.ok(clarify.reason.includes('High confidence'));
  });

  it('fires and generates a clarifying question on low margin bimodal clusters', () => {
    const results = [
      { docId: '1', score: 0.81, title: 'Mercury Planet Orbit', body: 'Planet Mercury orbit in space.' },
      { docId: '2', score: 0.80, title: 'Mercury Element Toxicity', body: 'Toxic metal element mercury poison.' }
    ];
    const clarify = evaluateClarification(results, index, { marginThreshold: 0.05 });
    assert.equal(clarify.fired, true);
    assert.ok(clarify.clarifyingQuestion.includes('Did you mean'));
  });
});

describe('End-to-End Trace Assembly', () => {
  const passages = [
    {
      docId: 'doc_1',
      title: 'Vector Space Model',
      body: 'Cosine similarity computes document rankings.',
      domain: 'cs_ai'
    }
  ];
  const index = buildIndex(passages);

  it('returns ranked results with complete unredacted trace', async () => {
    const context = new ContextState();
    const response = await executeConversationalTurn('What is the vector space model?', context, index);

    assert.ok(response.results);
    assert.ok(response.trace);
    assert.equal(response.trace.turn, 1);
    assert.ok(response.trace.timings.totalLatencyMs >= 0);
    assert.ok(response.trace.shiftDecision);
    assert.ok(response.trace.rewriter);
    assert.ok(response.trace.decomposition);
    assert.ok(Array.isArray(response.trace.positionalTokens));
    assert.ok(Array.isArray(response.trace.phraseMatches));
    assert.equal(response.trace.retrievalExecution.championLists, false);
    assert.equal(response.trace.retrievalExecution.indexElimination, true);
  });

  it('detects exact quoted phrase matches using positional index', async () => {
    const context = new ContextState();
    const phraseResp = await executeConversationalTurn('Tell me about "Vector Space Model"', context, index);

    assert.equal(phraseResp.trace.phraseMatches.length, 1);
    assert.equal(phraseResp.trace.phraseMatches[0].phrase, 'Vector Space Model');
    assert.equal(phraseResp.trace.phraseMatches[0].matchingDocCount, 1);
    assert.equal(phraseResp.trace.phraseMatches[0].docIds[0], 'doc_1');
  });

  it('honors useChampionLists and custom retrieval parameters online', async () => {
    const context = new ContextState();
    const champResp = await executeConversationalTurn('vector space', context, index, {
      useChampionLists: true,
      model: 'bm25'
    });

    assert.equal(champResp.trace.retrievalExecution.championLists, true);
    assert.equal(champResp.trace.retrievalExecution.model, 'bm25');
  });
});
