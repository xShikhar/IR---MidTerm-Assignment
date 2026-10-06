/**
 * @file server/src/retrieval/fusion.js
 * @description Rank Fusion Algorithms: Reciprocal Rank Fusion (RRF) and Score-Sum Fusion.
 * Reference: Cormack, Clarke, & Büttcher (SIGIR 2009), "Reciprocal Rank Fusion".
 */

import { CONFIG } from '../config/index.js';

/**
 * Merges multiple ranked result lists using Reciprocal Rank Fusion (RRF).
 *
 * @param {Array<Array<{ docId: string, score: number, title?: string, body?: string, domain?: string }>>} rankedLists
 * @param {number} [k=CONFIG.retrieval.fusion.rrfConstant] - Smoothing parameter (default 60)
 * @returns {Array<{ docId: string, score: number, title: string, body: string, domain: string, rrfScore: number, rankContributions: Object }>}
 */
export function reciprocalRankFusion(rankedLists, k = CONFIG.retrieval.fusion.rrfConstant) {
  if (!rankedLists || rankedLists.length === 0) return [];

  const docScores = new Map(); // docId -> { rrfScore, rankContributions: [], docMeta }

  rankedLists.forEach((list, listIdx) => {
    list.forEach((item, rankIdx) => {
      const rank = rankIdx + 1; // 1-based rank
      const rrfComponent = 1 / (k + rank);

      if (!docScores.has(item.docId)) {
        docScores.set(item.docId, {
          rrfScore: 0,
          rankContributions: [],
          title: item.title,
          body: item.body,
          domain: item.domain
        });
      }

      const entry = docScores.get(item.docId);
      entry.rrfScore += rrfComponent;
      entry.rankContributions.push({
        listIndex: listIdx,
        rank,
        component: Number(rrfComponent.toFixed(6))
      });
      if (item.title && !entry.title) {
        entry.title = item.title;
        entry.body = item.body;
        entry.domain = item.domain;
      }
    });
  });

  const fused = Array.from(docScores.entries()).map(([docId, data]) => ({
    docId,
    score: Number(data.rrfScore.toFixed(6)),
    rrfScore: Number(data.rrfScore.toFixed(6)),
    title: data.title,
    body: data.body,
    domain: data.domain,
    rankContributions: data.rankContributions
  }));

  // Sort descending by RRF score
  fused.sort((a, b) => b.score - a.score);
  return fused;
}

/**
 * Merges ranked lists using Min-Max Normalized Score-Sum Fusion.
 *
 * @param {Array<Array<{ docId: string, score: number, title?: string, body?: string, domain?: string }>>} rankedLists
 * @param {number[]} [weights] - Optional weights per list (must sum to 1.0)
 * @returns {Array<{ docId: string, score: number, title: string, body: string, domain: string, scoreContributions: Object }>}
 */
export function scoreSumFusion(rankedLists, weights = null) {
  if (!rankedLists || rankedLists.length === 0) return [];

  const nLists = rankedLists.length;
  const listWeights = weights && weights.length === nLists
    ? weights
    : Array(nLists).fill(1 / nLists);

  const docScores = new Map();

  rankedLists.forEach((list, listIdx) => {
    if (list.length === 0) return;

    // Min-Max normalization for this list
    const scores = list.map(item => item.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = (maxScore - minScore) || 1.0;

    list.forEach(item => {
      const normalizedScore = (item.score - minScore) / range;
      const weightedScore = normalizedScore * listWeights[listIdx];

      if (!docScores.has(item.docId)) {
        docScores.set(item.docId, {
          totalScore: 0,
          scoreContributions: [],
          title: item.title,
          body: item.body,
          domain: item.domain
        });
      }

      const entry = docScores.get(item.docId);
      entry.totalScore += weightedScore;
      entry.scoreContributions.push({
        listIndex: listIdx,
        rawScore: item.score,
        normalizedScore: Number(normalizedScore.toFixed(4)),
        weightedScore: Number(weightedScore.toFixed(4))
      });
      if (item.title && !entry.title) {
        entry.title = item.title;
        entry.body = item.body;
        entry.domain = item.domain;
      }
    });
  });

  const fused = Array.from(docScores.entries()).map(([docId, data]) => ({
    docId,
    score: Number(data.totalScore.toFixed(4)),
    title: data.title,
    body: data.body,
    domain: data.domain,
    scoreContributions: data.scoreContributions
  }));

  fused.sort((a, b) => b.score - a.score);
  return fused;
}
