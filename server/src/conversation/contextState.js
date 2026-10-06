/**
 * @file server/src/conversation/contextState.js
 * @description Context State Engine supporting ContextState v2 (Entity Lock + Aspect-Aware)
 * and legacy decayed bag (v1 for A0/S2 baseline comparison).
 *
 * Architecture v2:
 * - entityTerms: Persistent focal subject across carry turns, enforced via title zone.
 * - aspectTerms: Transient query focus; replaces previous aspects on normal carry,
 *   accumulates with decay when additive linguistic cues ('also', 'and', 'as well') appear.
 * - Old decayed bag removed from the primary pipeline path.
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * @typedef {Object} EntityTermEntry
 * @property {string} term - Stemmed entity term
 * @property {number} idf - Collection IDF
 * @property {number} sourceTurn - Turn where entity was locked
 * @property {number} titleHitCount - Title-zone occurrences in top results
 */

/**
 * @typedef {Object} AspectTermEntry
 * @property {string} term - Stemmed aspect term
 * @property {number} weight - Relative weight (1.0 for new, decayed for accumulated)
 * @property {number} idf - Collection IDF
 * @property {number} sourceTurn - Turn where aspect was introduced
 */

export class ContextState {
  /**
   * @param {Object} [options]
   * @param {'v2' | 'v1'} [options.mode='v2'] - Architecture mode ('v2' entity-lock vs 'v1' legacy bag)
   * @param {boolean} [options.accumulateAspects=false] - For A2 ablation (aspects accumulate instead of replace)
   * @param {number} [options.lambda=CONFIG.conversation.context.decayLambda]
   * @param {number} [options.maxHistoryTurns=CONFIG.conversation.context.maxHistoryTurns]
   * @param {number} [options.topTermsPerDoc=CONFIG.conversation.context.topTermsPerDoc]
   */
  constructor(options = {}) {
    this.mode = options.mode || 'v2';
    this.accumulateAspects = Boolean(options.accumulateAspects);
    this.lambda = options.lambda ?? CONFIG.conversation.context.decayLambda;
    this.maxHistoryTurns = options.maxHistoryTurns ?? CONFIG.conversation.context.maxHistoryTurns;
    this.topTermsPerDoc = options.topTermsPerDoc ?? CONFIG.conversation.context.topTermsPerDoc;
    this.turnCounter = 0;

    // V2 Architecture State
    /** @type {Map<string, EntityTermEntry>} */
    this.entityTerms = new Map();
    /** @type {Map<string, AspectTermEntry>} */
    this.aspectTerms = new Map();

    // Legacy V1 Decayed Bag (A0 / S2 baseline only)
    this.terms = new Map();
  }

  /**
   * Clears context state (used upon topic shift RESET or manual reset).
   */
  reset() {
    this.entityTerms.clear();
    this.aspectTerms.clear();
    this.terms.clear();
  }

  /**
   * Updates Context State v2 following the per-turn entity-lock algorithm.
   *
   * @param {Object} params
   * @param {'CARRY' | 'entity_switch' | 'reset'} params.decision - Transition decision
   * @param {string} params.rawQuery - Current turn query
   * @param {Array<EntityTermEntry>} [params.entityCandidates=[]] - Extracted entity candidates
   * @param {Array<AspectTermEntry>} [params.aspectCandidates=[]] - Extracted aspect candidates
   */
  updateV2({ decision, rawQuery = '', entityCandidates = [], aspectCandidates = [] }) {
    this.turnCounter++;
    const queryLower = (rawQuery || '').toLowerCase();
    const queryWords = queryLower.match(/[a-z0-9]+/g) || [];

    const hasAdditiveCue = CONFIG.novelty.aspect.additiveCues.some(cue =>
      queryWords.includes(cue) || queryLower.includes(cue)
    );

    if (decision === 'reset' || decision === 'entity_switch' || this.entityTerms.size === 0) {
      // 1. Replace locked entity with new candidate(s)
      this.entityTerms.clear();
      for (const ent of entityCandidates) {
        this.entityTerms.set(ent.term, {
          ...ent,
          sourceTurn: this.turnCounter
        });
      }

      // 2. Drop old aspects; store new terms
      this.aspectTerms.clear();
      for (const asp of aspectCandidates) {
        this.aspectTerms.set(asp.term, {
          ...asp,
          weight: 1.0,
          sourceTurn: this.turnCounter
        });
      }
    } else {
      // 3. CARRY: Keep locked entity intact
      if (aspectCandidates.length > 0) {
        if (hasAdditiveCue || this.accumulateAspects) {
          // ADD with decay applied to old aspects
          const decayLambda = CONFIG.novelty.aspect.decayLambda;
          for (const [, asp] of this.aspectTerms.entries()) {
            asp.weight = Number((asp.weight * decayLambda).toFixed(4));
          }
          for (const asp of aspectCandidates) {
            this.aspectTerms.set(asp.term, {
              ...asp,
              weight: 1.0,
              sourceTurn: this.turnCounter
            });
          }
        } else {
          // REPLACE old aspects with new aspects
          this.aspectTerms.clear();
          for (const asp of aspectCandidates) {
            this.aspectTerms.set(asp.term, {
              ...asp,
              weight: 1.0,
              sourceTurn: this.turnCounter
            });
          }
        }
      }
      // If aspectCandidates is empty (pure follow-up), keep aspects unchanged
    }
  }

  /**
   * Returns list of currently locked entity terms.
   * @returns {EntityTermEntry[]}
   */
  getLockedEntities() {
    return Array.from(this.entityTerms.values());
  }

  /**
   * Returns list of current aspect terms.
   * @returns {AspectTermEntry[]}
   */
  getAspectTerms() {
    return Array.from(this.aspectTerms.values());
  }

  /**
   * Returns all active tokens in context (entity + aspects).
   * @returns {string[]}
   */
  getAllContextTerms() {
    return [...this.entityTerms.keys(), ...this.aspectTerms.keys()];
  }

  // =========================================================================
  // LEGACY V1 METHODS (Preserved strictly for A0 / S2 baseline ablation)
  // =========================================================================

  decayAll() {
    this.turnCounter++;
    for (const [term, data] of this.terms.entries()) {
      data.age += 1;
      data.decayFactor = Math.pow(this.lambda, data.age);
      data.currentWeight = Number((data.rawWeight * data.decayFactor).toFixed(4));
      if (data.age > this.maxHistoryTurns || data.currentWeight < 0.01) {
        this.terms.delete(term);
      }
    }
  }

  update(rawQuery, topPassages, index) {
    this.decayAll();
    const queryStems = analyze(rawQuery, true);
    for (const stem of queryStems) {
      const entry = index.dictionary[stem];
      if (!entry) continue;
      const idf = entry.idf;
      const rawWeight = Math.max(1.0, Number((1.0 * (idf || 1.0)).toFixed(4)));
      this.terms.set(stem, {
        term: stem,
        sourceTurn: this.turnCounter,
        sourceType: 'query',
        rawWeight,
        age: 0,
        decayFactor: 1.0,
        currentWeight: rawWeight,
        idf: Number(idf.toFixed(4))
      });
    }

    if (topPassages && topPassages.length > 0) {
      const topDoc = topPassages[0];
      const docTerms = analyze(`${topDoc.title} ${topDoc.body}`, true);
      const tfMap = new Map();
      for (const t of docTerms) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }
      const docSalientTerms = [];
      for (const [t, tf] of tfMap.entries()) {
        const entry = index.dictionary[t];
        if (entry && !this.terms.has(t)) {
          const tfidf = (1 + Math.log(tf)) * entry.idf;
          docSalientTerms.push({ term: t, tfidf, idf: entry.idf });
        }
      }
      docSalientTerms.sort((a, b) => b.tfidf - a.tfidf);
      const toIngest = docSalientTerms.slice(0, this.topTermsPerDoc);
      for (const item of toIngest) {
        const rawWeight = item.tfidf * 0.5;
        this.terms.set(item.term, {
          term: item.term,
          sourceTurn: this.turnCounter,
          sourceType: 'passage',
          rawWeight: Number(rawWeight.toFixed(4)),
          age: 0,
          decayFactor: 1.0,
          currentWeight: Number(rawWeight.toFixed(4)),
          idf: Number(item.idf.toFixed(4))
        });
      }
    }
  }

  getVector() {
    const vec = new Map();
    for (const [term, data] of this.terms.entries()) {
      vec.set(term, data.currentWeight);
    }
    return vec;
  }

  getProvenanceList() {
    const list = Array.from(this.terms.values());
    list.sort((a, b) => b.currentWeight - a.currentWeight);
    return list;
  }
}
