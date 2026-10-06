/**
 * @file server/test/entityLock.test.js
 * @description Comprehensive unit tests for Entity-Lock and Aspect-Aware Context Architecture.
 *
 * Verifies:
 * 1. Entity extraction on hand-built mini-corpus.
 * 2. Aspect replacement vs addition with and without additive cues.
 * 3. Pure follow-up preserves active aspects.
 * 4. Entity switch vs continuation guards (including Dev queries:
 *    "Where is its orbit located in space?" and "What organs does the toxic metal damage?").
 * 5. Hard-lock Boolean AND equals brute-force title filter.
 * 6. Fallback triggers at threshold and is flagged.
 * 7. Seen-passage penalty demotes only shown passages and resets per conversation.
 * 8. Concurrent conversations maintain isolated state.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from '../src/index/builder.js';
import { extractEntityCandidates, extractAspectTerms } from '../src/conversation/entityExtractor.js';
import { detectConversationalDecision } from '../src/conversation/decisionDetector.js';
import { ContextState } from '../src/conversation/contextState.js';
import { rewriteQuery } from '../src/conversation/rewriter.js';
import { computeTitleFilteredCandidates } from '../src/retrieval/titleFilter.js';
import { SeenPassageTracker } from '../src/retrieval/seenPenalty.js';
import { scoreCosineLncLtc } from '../src/retrieval/cosine.js';

describe('Headline Novelty: Entity-Lock & Aspect-Aware Context', () => {
  // Hand-built mini corpus
  const miniDocs = [
    {
      docId: 'doc_apollo_1',
      title: 'Apollo 11 mission',
      body: 'Apollo 11 landed astronauts on the lunar surface at the Sea of Tranquillity.'
    },
    {
      docId: 'doc_apollo_2',
      title: 'Apollo 11 orbit',
      body: 'The command module stayed in lunar orbit while astronauts descended.'
    },
    {
      docId: 'doc_mercury_planet',
      title: 'Mercury planet orbit',
      body: 'Mercury is the innermost planet of the Solar System with extreme temperature variations.'
    },
    {
      docId: 'doc_mercury_toxic',
      title: 'Mercury poisoning toxicity',
      body: 'Mercury is a toxic heavy metal that causes severe damage to human brain and kidney organs.'
    },
    {
      docId: 'doc_mona_lisa',
      title: 'Mona Lisa painting',
      body: 'Leonardo da Vinci painted the Mona Lisa in Florence during the Italian Renaissance.'
    }
  ];

  const miniIndex = buildIndex(miniDocs);

  it('extracts entity candidates based on title-zone hits in top results', () => {
    const candidates = extractEntityCandidates('Apollo 11 mission landing', miniIndex, {
      minIdf: 0.1,
      minTitleHits: 1,
      topN: 3
    });
    const terms = candidates.map(c => c.term);
    assert.ok(terms.includes('apollo') || terms.includes('11'), 'Should identify Apollo as entity candidate');
    assert.ok(candidates.some(c => c.titleHitCount >= 1), 'Should have recorded title hits');
  });

  it('replaces aspect terms on standard CARRY when no additive cue is present', () => {
    const ctx = new ContextState({ mode: 'v2' });
    // Turn 1: Apollo landing
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'Apollo 11 landing site',
      entityCandidates: [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }],
      aspectCandidates: [{ term: 'site', idf: 2.0, weight: 1.0, sourceTurn: 1 }]
    });

    assert.equal(ctx.getAspectTerms().length, 1);
    assert.equal(ctx.getAspectTerms()[0].term, 'site');

    // Turn 2: Astronauts spend time (no additive cue) -> REPLACE aspects
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'How long did astronauts spend on the surface?',
      aspectCandidates: [{ term: 'astronaut', idf: 2.2, weight: 1.0, sourceTurn: 2 }]
    });

    const aspectsTurn2 = ctx.getAspectTerms();
    assert.equal(aspectsTurn2.length, 1);
    assert.equal(aspectsTurn2[0].term, 'astronaut', 'Aspect "site" should have been replaced by "astronaut"');
    assert.equal(ctx.getLockedEntities()[0].term, 'apollo', 'Locked entity Apollo remains intact');
  });

  it('accumulates aspect terms with exponential decay when an additive cue is present', () => {
    const ctx = new ContextState({ mode: 'v2' });
    // Turn 1: Apollo orbit
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'Apollo orbit',
      entityCandidates: [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }],
      aspectCandidates: [{ term: 'orbit', idf: 2.0, weight: 1.0, sourceTurn: 1 }]
    });

    // Turn 2: Additive cue "also" -> ADD aspect and decay old aspect
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'What was also the landing speed?',
      aspectCandidates: [{ term: 'speed', idf: 2.1, weight: 1.0, sourceTurn: 2 }]
    });

    const aspects = ctx.getAspectTerms();
    assert.equal(aspects.length, 2, 'Should accumulate both aspects');
    const orbitAspect = aspects.find(a => a.term === 'orbit');
    const speedAspect = aspects.find(a => a.term === 'speed');
    assert.ok(orbitAspect && speedAspect);
    assert.ok(orbitAspect.weight < 1.0, 'Old aspect should have decayed weight (lambda * 1.0)');
    assert.equal(speedAspect.weight, 1.0, 'New aspect should have full weight 1.0');
  });

  it('preserves existing aspects on pure follow-up queries with no new aspects', () => {
    const ctx = new ContextState({ mode: 'v2' });
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'Apollo orbit',
      entityCandidates: [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }],
      aspectCandidates: [{ term: 'orbit', idf: 2.0, weight: 1.0, sourceTurn: 1 }]
    });

    // Follow-up with zero aspect candidates
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'Tell me more about it.',
      aspectCandidates: []
    });

    const aspects = ctx.getAspectTerms();
    assert.equal(aspects.length, 1);
    assert.equal(aspects[0].term, 'orbit', 'Aspect should remain unchanged on pure follow-up');
  });

  it('guards ensure "Where is its orbit located in space?" is NOT classified entity_switch', () => {
    const lockedEntities = [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }];
    const contextTerms = ['apollo', 'mission', 'space'];

    const decision = detectConversationalDecision(
      'Where is its orbit located in space?',
      lockedEntities,
      contextTerms,
      miniIndex
    );

    assert.equal(decision.decision, 'CARRY');
    assert.notEqual(decision.decision, 'entity_switch');
    assert.ok(decision.guardsTriggered.includes('pronoun'), 'Pronoun guard "its" must trigger');
  });

  it('guards ensure "What organs does the toxic metal damage?" is NOT classified entity_switch', () => {
    const lockedEntities = [{ term: 'mercuri', idf: 3.5, titleHitCount: 2, sourceTurn: 1 }];
    const contextTerms = ['mercuri', 'toxic', 'metal'];

    const decision = detectConversationalDecision(
      'What organs does the toxic metal damage?',
      lockedEntities,
      contextTerms,
      miniIndex
    );

    assert.equal(decision.decision, 'CARRY');
    assert.notEqual(decision.decision, 'entity_switch');
    assert.ok(
      decision.guardsTriggered.includes('default_carry_no_new_entity') ||
      decision.guardsTriggered.includes('locked_entity_token'),
      'Must default to carry when no new entity candidates exist in title zone'
    );
  });

  it('triggers reset when user introduces a genuinely disjoint entity with zero context overlap', () => {
    const lockedEntities = [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }];
    const contextTerms = ['apollo', 'orbit', 'lunar'];

    const decision = detectConversationalDecision(
      'Who painted the Mona Lisa in Florence?',
      lockedEntities,
      contextTerms,
      miniIndex,
      { minIdf: 0.1 }
    );

    assert.ok(
      decision.decision === 'reset' || decision.decision === 'entity_switch',
      `Expected reset or entity_switch, got ${decision.decision}`
    );
  });

  it('hard-lock Boolean title filter strictly matches brute-force scan', () => {
    const locked = [{ term: 'apollo' }];
    const filterRes = computeTitleFilteredCandidates(locked, miniIndex, {
      lockMode: 'hard',
      minCandidates: 1
    });

    assert.equal(filterRes.fallback, false);
    assert.ok(filterRes.filteredDocIds.has('doc_apollo_1'));
    assert.ok(filterRes.filteredDocIds.has('doc_apollo_2'));
    assert.ok(!filterRes.filteredDocIds.has('doc_mercury_planet'));
    assert.ok(!filterRes.filteredDocIds.has('doc_mona_lisa'));

    // Brute force verification
    const bruteForceMatches = new Set();
    for (const doc of miniDocs) {
      if (doc.title.toLowerCase().includes('apollo')) {
        bruteForceMatches.add(doc.docId);
      }
    }
    assert.deepEqual(filterRes.filteredDocIds, bruteForceMatches);
  });

  it('hard-lock gracefully falls back to soft mode when candidates < minCandidates', () => {
    const locked = [{ term: 'apollo' }];
    const filterRes = computeTitleFilteredCandidates(locked, miniIndex, {
      lockMode: 'hard',
      minCandidates: 10 // mini corpus only has 2 Apollo docs
    });

    assert.equal(filterRes.fallback, true);
    assert.equal(filterRes.lockMode, 'soft_fallback');
    assert.equal(filterRes.candidateCount, 2);
    assert.equal(filterRes.filteredDocIds, null);
  });

  it('seen-passage penalty demotes previously shown documents and isolates sessions', () => {
    const trackerSessionA = new SeenPassageTracker(0.30);
    const trackerSessionB = new SeenPassageTracker(0.30);

    const candidates = [
      { docId: 'doc_apollo_1', title: 'Doc 1', score: 1.0 },
      { docId: 'doc_apollo_2', title: 'Doc 2', score: 0.8 }
    ];

    // Session A shows doc_apollo_1 on turn 1
    trackerSessionA.recordShown([{ docId: 'doc_apollo_1' }]);

    // Turn 2 in Session A: doc_apollo_1 penalized (1.0 * 0.70 = 0.70)
    const resA = trackerSessionA.applyPenalty(candidates);
    assert.equal(resA.demotedPassages.length, 1);
    assert.equal(resA.demotedPassages[0].docId, 'doc_apollo_1');
    assert.equal(resA.penalizedResults[0].docId, 'doc_apollo_2', 'Doc 2 should surpass penalized Doc 1');
    assert.equal(resA.penalizedResults[1].docId, 'doc_apollo_1');
    assert.equal(resA.penalizedResults[1].score, 0.70);

    // Session B: doc_apollo_1 was NEVER shown -> completely unpenalized
    const resB = trackerSessionB.applyPenalty(candidates);
    assert.equal(resB.demotedPassages.length, 0);
    assert.equal(resB.penalizedResults[0].docId, 'doc_apollo_1');
    assert.equal(resB.penalizedResults[0].score, 1.0);

    // Reset Session A
    trackerSessionA.reset();
    const resAReset = trackerSessionA.applyPenalty(candidates);
    assert.equal(resAReset.demotedPassages.length, 0);
  });

  it('rewriter v2 tracks term provenance with role, sourceTurn, and weight', () => {
    const ctx = new ContextState({ mode: 'v2' });
    ctx.updateV2({
      decision: 'CARRY',
      rawQuery: 'Apollo orbit',
      entityCandidates: [{ term: 'apollo', idf: 2.5, titleHitCount: 2, sourceTurn: 1 }],
      aspectCandidates: [{ term: 'orbit', idf: 2.0, weight: 1.0, sourceTurn: 1 }]
    });

    const rewrite = rewriteQuery('surface landing speed', ctx, 'CARRY');
    assert.ok(rewrite.rewrittenQuery.includes('apollo'));
    assert.ok(rewrite.rewrittenQuery.includes('orbit'));

    const apolloMeta = rewrite.provenance.find(p => p.term === 'apollo');
    assert.ok(apolloMeta);
    assert.equal(apolloMeta.role, 'entity');
    assert.equal(apolloMeta.sourceTurn, 1);
  });
});
