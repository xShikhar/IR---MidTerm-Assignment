/**
 * @file server/src/retrieval/seenPenalty.js
 * @description Seen-Passage Demotion Engine.
 * Penalizes passages displayed to the user earlier in the same conversation session
 * by multiplying their score by (1 - penalty) prior to final top-K selection.
 * State is strictly isolated per conversation session.
 */

import { CONFIG } from '../config/index.js';

export class SeenPassageTracker {
  /**
   * @param {number} [penalty=CONFIG.novelty.seen.penalty] - Penalty factor (e.g. 0.30 -> multiplier 0.70)
   */
  constructor(penalty = CONFIG.novelty.seen.penalty) {
    this.penalty = penalty;
    /** @type {Set<string>} */
    this.seenDocIds = new Set();
  }

  /**
   * Applies penalty multiplier to candidates displayed in earlier turns.
   *
   * @param {Array<Object>} results - Ranked candidate passages
   * @returns {{
   *   penalizedResults: Array<Object>,
   *   demotedPassages: Array<{ docId: string, originalScore: number, penalizedScore: number, penalty: number }>
   * }}
   */
  applyPenalty(results) {
    if (!results || results.length === 0 || this.seenDocIds.size === 0 || this.penalty <= 0) {
      return {
        penalizedResults: results,
        demotedPassages: []
      };
    }

    const demotedPassages = [];
    const modified = results.map(r => {
      if (this.seenDocIds.has(r.docId)) {
        const originalScore = r.score;
        const penalizedScore = Number((originalScore * (1 - this.penalty)).toFixed(6));
        demotedPassages.push({
          docId: r.docId,
          title: r.title,
          originalScore,
          penalizedScore,
          penalty: this.penalty
        });
        return {
          ...r,
          score: penalizedScore,
          isPenalized: true,
          originalScore
        };
      }
      return r;
    });

    // Re-sort candidates by score descending
    modified.sort((a, b) => b.score - a.score);

    return {
      penalizedResults: modified,
      demotedPassages
    };
  }

  /**
   * Records top-K passages shown to the user on this turn.
   *
   * @param {Array<{ docId: string }>} topResults - Displayed top results
   */
  recordShown(topResults) {
    if (!topResults) return;
    for (const res of topResults) {
      if (res.docId) {
        this.seenDocIds.add(res.docId);
      }
    }
  }

  /**
   * Clears seen passage history upon session reset.
   */
  reset() {
    this.seenDocIds.clear();
  }
}
