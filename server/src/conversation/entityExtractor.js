/**
 * @file server/src/conversation/entityExtractor.js
 * @description Extracts entity and aspect candidate terms from query tokens using
 * collection-wide IDF and title-zone presence among top-N retrieval candidates.
 *
 * Definitions:
 * - Entity term: A stemmed query term with IDF >= minIdf that appears in the title zone
 *   of at least minTitleHits of the top-N results for that turn.
 * - Aspect term: Any other non-stopword query term with IDF >= minIdf.
 */

import { analyze } from '../index/normalizer.js';
import { executeRetrieval } from '../retrieval/engine.js';
import { CONFIG } from '../config/index.js';

/**
 * Extracts entity candidate terms from a query string or term array.
 *
 * @param {string | string[]} queryInput - Raw query string or pre-analyzed stems
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.minIdf=CONFIG.novelty.entity.minIdf] - Minimum collection IDF
 * @param {number} [options.topN=CONFIG.novelty.entity.topN] - Top-N retrieval depth
 * @param {number} [options.minTitleHits=CONFIG.novelty.entity.minTitleHits] - Minimum title hits in top-N
 * @param {number} [options.sourceTurn=1] - Turn number of source query
 * @returns {Array<{ term: string, idf: number, titleHitCount: number, sourceTurn: number }>}
 */
export function extractEntityCandidates(queryInput, index, options = {}) {
  const minIdf = options.minIdf ?? CONFIG.novelty.entity.minIdf;
  const topN = options.topN ?? CONFIG.novelty.entity.topN;
  const minTitleHits = options.minTitleHits ?? CONFIG.novelty.entity.minTitleHits;
  const sourceTurn = options.sourceTurn ?? 1;

  const rawQuery = typeof queryInput === 'string' ? queryInput : queryInput.join(' ');
  const stems = Array.isArray(queryInput) ? queryInput : analyze(rawQuery, true);

  if (stems.length === 0) {
    return [];
  }

  // 1. Identify candidate terms with sufficient collection IDF
  const highIdfTerms = stems.filter(stem => {
    const entry = index.dictionary[stem];
    return entry && entry.idf >= minIdf;
  });

  if (highIdfTerms.length === 0) {
    return [];
  }

  // 2. Perform shallow retrieval to inspect top-N candidate document titles
  const shallowRes = executeRetrieval(rawQuery, index, {
    topK: topN,
    applyIndexElimination: false,
    useChampionLists: false,
    model: 'cosine'
  });

  const topDocs = shallowRes.results.slice(0, topN);
  const candidates = [];

  for (const term of highIdfTerms) {
    const entry = index.dictionary[term];
    let titleHitCount = 0;

    for (const doc of topDocs) {
      // Check title-zone posting presence or title text tokens
      const docPostings = entry.postings || [];
      const p = docPostings.find(pos => pos.docId === doc.docId);
      if (p && (p.titleTf || 0) > 0) {
        titleHitCount++;
      } else {
        // Fallback: analyze title string
        const titleStems = analyze(doc.title || '', true);
        if (titleStems.includes(term)) {
          titleHitCount++;
        }
      }
    }

    if (titleHitCount >= minTitleHits) {
      candidates.push({
        term,
        idf: Number(entry.idf.toFixed(4)),
        titleHitCount,
        sourceTurn
      });
    }
  }

  return candidates;
}

/**
 * Extracts aspect terms from a query, excluding identified entity candidates.
 *
 * @param {string | string[]} queryInput - Raw query string or pre-analyzed stems
 * @param {Array<{ term: string }>} entityTerms - Identified entity terms to exclude
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.minIdf=CONFIG.novelty.aspect.minIdf] - Minimum collection IDF
 * @param {number} [options.sourceTurn=1] - Turn number of source query
 * @returns {Array<{ term: string, idf: number, weight: number, sourceTurn: number }>}
 */
export function extractAspectTerms(queryInput, entityTerms = [], index, options = {}) {
  const minIdf = options.minIdf ?? CONFIG.novelty.aspect.minIdf;
  const sourceTurn = options.sourceTurn ?? 1;

  const rawQuery = typeof queryInput === 'string' ? queryInput : queryInput.join(' ');
  const stems = Array.isArray(queryInput) ? queryInput : analyze(rawQuery, true);

  const entitySet = new Set(entityTerms.map(e => e.term));
  const aspects = [];
  const seen = new Set();

  for (const stem of stems) {
    if (entitySet.has(stem) || seen.has(stem)) {
      continue;
    }
    seen.add(stem);

    const entry = index.dictionary[stem];
    if (entry && entry.idf >= minIdf) {
      aspects.push({
        term: stem,
        idf: Number(entry.idf.toFixed(4)),
        weight: 1.0,
        sourceTurn
      });
    }
  }

  return aspects;
}
