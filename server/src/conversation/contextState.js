/**
 * @file server/src/conversation/contextState.js
 * @description Decayed Term-Weight Context Vector Engine.
 * Manages conversational state across dialogue turns using exponential decay:
 *   Weight(t, age) = tfidf(t) * (lambda ^ age)
 * Preserves explicit term provenance (origin turn, source type, raw weight, decay factor).
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * @typedef {Object} ContextTermProvenance
 * @property {string} term - Normalized stem
 * @property {number} sourceTurn - Turn ordinal where term was ingested
 * @property {'query' | 'passage'} sourceType - Origin entity
 * @property {number} rawWeight - Initial TF-IDF weight at inception
 * @property {number} age - Age in turns
 * @property {number} decayFactor - lambda ^ age
 * @property {number} currentWeight - Decayed effective weight
 * @property {number} idf - Collection IDF
 */

export class ContextState {
  /**
   * @param {Object} [options]
   * @param {number} [options.lambda=CONFIG.conversation.context.decayLambda]
   * @param {number} [options.maxHistoryTurns=CONFIG.conversation.context.maxHistoryTurns]
   * @param {number} [options.topTermsPerDoc=CONFIG.conversation.context.topTermsPerDoc]
   */
  constructor(options = {}) {
    this.lambda = options.lambda ?? CONFIG.conversation.context.decayLambda;
    this.maxHistoryTurns = options.maxHistoryTurns ?? CONFIG.conversation.context.maxHistoryTurns;
    this.topTermsPerDoc = options.topTermsPerDoc ?? CONFIG.conversation.context.topTermsPerDoc;
    this.turnCounter = 0;
    /** @type {Map<string, ContextTermProvenance>} */
    this.terms = new Map();
  }

  /**
   * Clears context state (used upon topic shift RESET).
   */
  reset() {
    this.terms.clear();
  }

  /**
   * Advances age by 1 turn and applies exponential decay to all active terms.
   */
  decayAll() {
    this.turnCounter++;
    for (const [term, data] of this.terms.entries()) {
      data.age += 1;
      data.decayFactor = Math.pow(this.lambda, data.age);
      data.currentWeight = Number((data.rawWeight * data.decayFactor).toFixed(4));

      // Evict terms whose weight has decayed below threshold or exceeded history window
      if (data.age > this.maxHistoryTurns || data.currentWeight < 0.01) {
        this.terms.delete(term);
      }
    }
  }

  /**
   * Ingests query terms and top-ranked passages into the conversational context.
   *
   * @param {string} rawQuery - Current turn query
   * @param {Array<{ docId: string, title: string, body: string }>} topPassages - Top retrieved passages
   * @param {Object} index - Inverted index
   */
  update(rawQuery, topPassages, index) {
    this.decayAll();

    // 1. Ingest query terms (high priority)
    const queryStems = analyze(rawQuery, true);
    for (const stem of queryStems) {
      const entry = index.dictionary[stem];
      if (!entry) continue;

      const idf = entry.idf;
      const rawWeight = Math.max(1.0, Number((1.0 * (idf || 1.0)).toFixed(4))); // Minimum baseline weight of 1.0

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

    // 2. Ingest top-ranked passages' most salient terms
    if (topPassages && topPassages.length > 0) {
      const topDoc = topPassages[0];
      const docTerms = analyze(`${topDoc.title} ${topDoc.body}`, true);

      // Count local TF
      const tfMap = new Map();
      for (const t of docTerms) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      // Compute TF-IDF scores
      const docSalientTerms = [];
      for (const [t, tf] of tfMap.entries()) {
        const entry = index.dictionary[t];
        if (entry && !this.terms.has(t)) {
          const tfidf = (1 + Math.log(tf)) * entry.idf;
          docSalientTerms.push({ term: t, tfidf, idf: entry.idf });
        }
      }

      // Keep top-N salient terms
      docSalientTerms.sort((a, b) => b.tfidf - a.tfidf);
      const toIngest = docSalientTerms.slice(0, this.topTermsPerDoc);

      for (const item of toIngest) {
        const rawWeight = item.tfidf * 0.5; // Scaled down relative to direct query terms
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

  /**
   * Returns current context vector representation.
   * @returns {Map<string, number>}
   */
  getVector() {
    const vec = new Map();
    for (const [term, data] of this.terms.entries()) {
      vec.set(term, data.currentWeight);
    }
    return vec;
  }

  /**
   * Returns sorted list of all context terms with provenance.
   * @returns {ContextTermProvenance[]}
   */
  getProvenanceList() {
    const list = Array.from(this.terms.values());
    list.sort((a, b) => b.currentWeight - a.currentWeight);
    return list;
  }
}
