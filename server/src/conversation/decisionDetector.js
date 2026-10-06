/**
 * @file server/src/conversation/decisionDetector.js
 * @description Conversational Decision Detector for Entity Lock Architecture.
 * Replaces fragile unigram cosine heuristics with explicit entity-disjointness rules.
 *
 * Decision Taxonomy:
 * - CARRY: Continue existing dialogue thread. (Default behavior).
 * - ENTITY_SWITCH: User shifts to a new entity that is disjoint from the locked entity,
 *   but query retains partial lexical overlap with previous conversational context.
 * - RESET: User shifts to a completely new topic with disjoint entity candidates AND
 *   zero lexical overlap with preceding context.
 *
 * Entity-Switch Guards:
 * - Always CARRY if query contains any currently locked entity term.
 * - Always CARRY if query contains surface pronouns or ellipsis markers.
 * - New entity candidate only counts if it achieves title-zone hits in top-3 results.
 */

import { analyze } from '../index/normalizer.js';
import { extractEntityCandidates } from './entityExtractor.js';
import { CONFIG } from '../config/index.js';

/**
 * Detects conversational transition decision for the incoming turn.
 *
 * @param {string} rawQuery - Incoming user query
 * @param {Array<{ term: string }>} lockedEntities - Currently locked entity terms
 * @param {Set<string> | Array<{ term: string }>} contextTerms - Active context terms (entity + aspect)
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @returns {{
 *   decision: 'CARRY' | 'entity_switch' | 'reset',
 *   entityCandidates: Array<Object>,
 *   guardsTriggered: string[],
 *   reason: string
 * }}
 */
export function detectConversationalDecision(rawQuery, lockedEntities = [], contextTerms = [], index, options = {}) {
  // If no prior entity is locked, this is turn 1 or post-reset turn
  if (!lockedEntities || lockedEntities.length === 0) {
    const initialCandidates = extractEntityCandidates(rawQuery, index, options);
    return {
      decision: 'CARRY',
      entityCandidates: initialCandidates,
      guardsTriggered: ['initial_turn'],
      reason: 'Initial turn: establish initial conversational entity lock.'
    };
  }

  const queryLower = rawQuery.toLowerCase();
  const queryWords = queryLower.match(/[a-z0-9]+/g) || [];
  const queryStems = analyze(rawQuery, true);

  // 1. Guard 1: Surface Pronoun presence
  const matchedPronouns = CONFIG.conversation.shift.pronouns.filter(p => queryWords.includes(p));
  if (matchedPronouns.length > 0) {
    return {
      decision: 'CARRY',
      entityCandidates: [],
      guardsTriggered: ['pronoun'],
      reason: `Pronoun guard triggered (${matchedPronouns.join(', ')}): always carry on anaphora.`
    };
  }

  // 2. Guard 2: Ellipsis Marker presence
  const matchedEllipsis = CONFIG.conversation.shift.ellipsisMarkers.filter(m =>
    queryLower.startsWith(m) || queryLower.includes(m)
  );
  if (matchedEllipsis.length > 0) {
    return {
      decision: 'CARRY',
      entityCandidates: [],
      guardsTriggered: ['ellipsis'],
      reason: `Ellipsis guard triggered ("${matchedEllipsis[0]}"): carry on contextual follow-up.`
    };
  }

  // 3. Guard 3: Query contains any term from the currently locked entity
  const lockedTermsSet = new Set(lockedEntities.map(e => e.term));
  const matchedLockedTerms = queryStems.filter(s => lockedTermsSet.has(s));
  if (matchedLockedTerms.length > 0) {
    return {
      decision: 'CARRY',
      entityCandidates: [],
      guardsTriggered: ['locked_entity_token'],
      reason: `Locked entity guard triggered: query references locked entity terms (${matchedLockedTerms.join(', ')}).`
    };
  }

  // 4. Extract new entity candidates from the query (must have title hits in top 3)
  const queryEntityCandidates = extractEntityCandidates(rawQuery, index, {
    topN: CONFIG.novelty.entity.topN,
    minTitleHits: CONFIG.novelty.entity.minTitleHits,
    minIdf: CONFIG.novelty.entity.minIdf,
    ...options
  });

  // If query contains no entity candidate satisfying title-hit threshold in top 3, carry by default
  if (queryEntityCandidates.length === 0) {
    return {
      decision: 'CARRY',
      entityCandidates: [],
      guardsTriggered: ['default_carry_no_new_entity'],
      reason: 'Default carry: query introduces aspectual/sub-topic inquiry without new entity candidate.'
    };
  }

  // 5. Check disjointness between query entity candidates and locked entity
  const candidateTerms = queryEntityCandidates.map(c => c.term);
  const isDisjoint = candidateTerms.every(term => !lockedTermsSet.has(term));

  if (!isDisjoint) {
    return {
      decision: 'CARRY',
      entityCandidates: queryEntityCandidates,
      guardsTriggered: ['entity_overlap'],
      reason: 'Entity candidate intersects locked entity terms: maintain continuity.'
    };
  }

  // 6. Differentiate ENTITY_SWITCH vs RESET based on lexical context overlap
  const contextTermSet = new Set(
    Array.isArray(contextTerms)
      ? contextTerms.map(t => (typeof t === 'string' ? t : t.term))
      : Array.from(contextTerms || [])
  );

  const overlappingContextTerms = queryStems.filter(stem => contextTermSet.has(stem));

  if (overlappingContextTerms.length > 0) {
    return {
      decision: 'entity_switch',
      entityCandidates: queryEntityCandidates,
      guardsTriggered: [],
      reason: `Entity switch: new entity candidate [${candidateTerms.join(', ')}] disjoint from locked entity, but shares lexical context tokens (${overlappingContextTerms.join(', ')}).`
    };
  }

  return {
    decision: 'reset',
    entityCandidates: queryEntityCandidates,
    guardsTriggered: [],
    reason: `Topic reset: new entity candidate [${candidateTerms.join(', ')}] is disjoint from locked entity with zero lexical context overlap.`
  };
}
