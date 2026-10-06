/**
 * @file server/src/retrieval/titleFilter.js
 * @description Title-Zone Candidate Filtering for Entity Locking.
 * In "hard" lock mode, restricts candidate evaluation to passages whose title zone
 * contains ALL locked entity terms (Boolean AND ordered by increasing df).
 * If fewer than minCandidates survive, triggers graceful fallback to "soft" mode.
 */

import { CONFIG } from '../config/index.js';

/**
 * Computes candidate document IDs satisfying title-zone entity constraints.
 *
 * @param {Array<{ term: string }>} lockedEntities - Active locked entity terms
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {'hard' | 'soft'} [options.lockMode=CONFIG.novelty.lock.mode] - Lock mode
 * @param {number} [options.minCandidates=CONFIG.novelty.lock.minCandidates] - Minimum candidate threshold
 * @returns {{
 *   filteredDocIds: Set<string> | null,
 *   candidateCount: number,
 *   fallback: boolean,
 *   lockMode: string,
 *   reason: string
 * }}
 */
export function computeTitleFilteredCandidates(lockedEntities = [], index, options = {}) {
  const lockMode = options.lockMode || CONFIG.novelty.lock.mode;
  const minCandidates = options.minCandidates ?? CONFIG.novelty.lock.minCandidates;

  if (!lockedEntities || lockedEntities.length === 0) {
    return {
      filteredDocIds: null,
      candidateCount: 0,
      fallback: false,
      lockMode: 'none',
      reason: 'No locked entities active: unrestricted retrieval.'
    };
  }

  if (lockMode === 'soft') {
    return {
      filteredDocIds: null,
      candidateCount: 0,
      fallback: false,
      lockMode: 'soft',
      reason: 'Soft lock mode: entity terms boosted without candidate filtering.'
    };
  }

  // 1. Collect title-zone postings for each locked entity term
  const termTitleDocSets = [];

  for (const entity of lockedEntities) {
    const entry = index.dictionary[entity.term];
    if (!entry) {
      return {
        filteredDocIds: null,
        candidateCount: 0,
        fallback: true,
        lockMode: 'soft_fallback',
        reason: `Entity term "${entity.term}" not found in index dictionary: falling back to soft lock.`
      };
    }

    const titleDocIds = new Set();
    for (const posting of entry.postings || []) {
      if ((posting.titleTf || 0) > 0) {
        titleDocIds.add(posting.docId);
      }
    }

    termTitleDocSets.push({
      term: entity.term,
      docIds: titleDocIds,
      count: titleDocIds.size
    });
  }

  // 2. Order by increasing DF for optimal Boolean AND intersection
  termTitleDocSets.sort((a, b) => a.count - b.count);

  // 3. Intersect title doc sets
  let survivingDocIds = new Set(termTitleDocSets[0].docIds);

  for (let i = 1; i < termTitleDocSets.length; i++) {
    const nextSet = termTitleDocSets[i].docIds;
    const intersected = new Set();
    for (const docId of survivingDocIds) {
      if (nextSet.has(docId)) {
        intersected.add(docId);
      }
    }
    survivingDocIds = intersected;
    if (survivingDocIds.size === 0) break;
  }

  const candidateCount = survivingDocIds.size;

  // 4. Fallback check: if surviving candidates < minCandidates, relax to soft mode
  if (candidateCount < minCandidates) {
    return {
      filteredDocIds: null,
      candidateCount,
      fallback: true,
      lockMode: 'soft_fallback',
      reason: `Hard lock fallback: only ${candidateCount} candidate passages survived title filter (< threshold ${minCandidates}).`
    };
  }

  return {
    filteredDocIds: survivingDocIds,
    candidateCount,
    fallback: false,
    lockMode: 'hard',
    reason: `Hard lock satisfied: ${candidateCount} candidate passages contain all locked entity terms in title zone.`
  };
}
