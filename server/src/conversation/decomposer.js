/**
 * @file server/src/conversation/decomposer.js
 * @description Multi-Part Query Decomposer.
 * Splits comparative questions ("compare X and Y", "difference between X and Y")
 * or multi-clause conjunctions into:
 *   1. A Boolean entity constraint sub-query (AND on high-IDF terms with OR fallback)
 *   2. Independent semantic vector sub-queries for each constituent clause
 * Fuses ranked lists with both Reciprocal Rank Fusion (RRF) and Score-Sum Fusion.
 */

import { analyze } from '../index/normalizer.js';
import { executeRetrieval } from '../retrieval/engine.js';
import { evaluateEntityConstraints } from '../retrieval/boolean.js';
import { reciprocalRankFusion, scoreSumFusion } from '../retrieval/fusion.js';
import { CONFIG } from '../config/index.js';

/**
 * Checks if a query exhibits multi-part or comparative grammatical patterns.
 *
 * @param {string} query
 * @returns {boolean}
 */
export function isMultiPartQuery(query) {
  if (!query) return false;
  const q = query.toLowerCase();
  return (
    q.includes('compare') ||
    q.includes('versus') ||
    q.includes(' vs ') ||
    q.includes('difference between') ||
    q.includes(' as well as ') ||
    (q.includes(' and ') && q.length > 30)
  );
}

/**
 * Splits a comparative query into constituent sub-clauses.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function extractSubQueries(query) {
  let clean = query.replace(/^(compare|what is the difference between|difference between)\s+/i, '');

  const separators = [/\s+with\s+/i, /\s+and\s+/i, /\s+versus\s+/i, /\s+vs\.?\s+/i];
  for (const sep of separators) {
    if (sep.test(clean)) {
      const parts = clean.split(sep).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return parts;
      }
    }
  }

  return [query];
}

/**
 * Decomposes query into Boolean entity constraints and vector sub-queries,
 * retrieves each list, and fuses them via RRF and Score-Sum.
 *
 * @param {string} query - Rewritten query
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.topK=CONFIG.retrieval.topK]
 * @returns {{ isDecomposed: boolean, subQueries: Array<Object>, fusedResultsRrf: Array<Object>, fusedResultsScoreSum: Array<Object> }}
 */
export function decomposeAndRetrieve(query, index, options = {}) {
  const topK = options.topK || CONFIG.retrieval.topK;

  if (!isMultiPartQuery(query)) {
    const retRes = executeRetrieval(query, index, {
      topK,
      model: options.model || 'cosine',
      useChampionLists: options.useChampionLists,
      applyIndexElimination: options.applyIndexElimination
    });
    return {
      isDecomposed: false,
      subQueries: [{ query, type: 'vector_primary', resultsCount: retRes.results.length }],
      fusedResultsRrf: retRes.results,
      fusedResultsScoreSum: retRes.results,
      eliminatedTerms: retRes.trace?.eliminatedTerms || []
    };
  }

  const parts = extractSubQueries(query);
  const subQueriesTrace = [];
  const candidateLists = [];

  // 1. Vector sub-query per clause
  for (const part of parts) {
    const partTerms = analyze(part, true);
    const partRes = executeRetrieval(part, index, {
      topK: topK * 2,
      model: options.model || 'cosine',
      useChampionLists: options.useChampionLists,
      applyIndexElimination: options.applyIndexElimination
    });
    candidateLists.push(partRes.results);
    subQueriesTrace.push({
      subQuery: part,
      type: 'vector_clause',
      terms: partTerms,
      returnedCount: partRes.results.length,
      eliminatedTerms: partRes.trace?.eliminatedTerms || []
    });
  }

  // 2. Boolean sub-query on high-IDF entity terms
  const allTerms = analyze(query, true);
  // Filter to high-IDF terms (top half)
  const scoredTerms = allTerms
    .map(t => ({ term: t, idf: index.dictionary[t]?.idf || 0 }))
    .sort((a, b) => b.idf - a.idf);
  const highIdfTerms = scoredTerms.slice(0, 3).map(t => t.term);

  const booleanResult = evaluateEntityConstraints(highIdfTerms, index);
  const booleanScoredDocs = booleanResult.postings.slice(0, topK * 2).map((p, idx) => {
    const docMeta = index.docs[p.docId];
    return {
      docId: p.docId,
      score: 1.0 / (idx + 1),
      title: docMeta?.title,
      body: docMeta?.body,
      domain: docMeta?.domain
    };
  });
  candidateLists.push(booleanScoredDocs);

  subQueriesTrace.push({
    subQuery: highIdfTerms.join(' AND '),
    type: `boolean_entity_${booleanResult.mode}`,
    terms: highIdfTerms,
    returnedCount: booleanScoredDocs.length
  });

  // 3. Fused ranked lists
  const fusedRrf = reciprocalRankFusion(candidateLists, CONFIG.retrieval.fusion.rrfConstant).slice(0, topK);
  const fusedScoreSum = scoreSumFusion(candidateLists).slice(0, topK);

  return {
    isDecomposed: true,
    subQueries: subQueriesTrace,
    fusedResultsRrf: fusedRrf,
    fusedResultsScoreSum: fusedScoreSum
  };
}
