/**
 * @file server/src/conversation/clarifier.js
 * @description Cluster-Pruned Clarifying Question Generator.
 * Reference: Manning, Raghavan, & Schütze (2008), §7.1.6 (Leader/Follower Cluster Pruning).
 *
 * Checks two preconditions before firing:
 *   1. Score margin between top candidates is small: (Score[0] - Score[1]) < scoreMarginThreshold
 *   2. Top results separate into 2+ distinct topical clusters with disjoint high-IDF terms.
 * Never fires when ranking confidence is high.
 */

import { CONFIG } from '../config/index.js';
import { analyze } from '../index/normalizer.js';

/**
 * Computes Jaccard term similarity between two token sets.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Jaccard coefficient in [0, 1]
 */
function jaccardSimilarity(setA, setB) {
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Groups candidate passages using leader/follower cluster pruning.
 *
 * @param {Array<{ docId: string, title: string, body: string }>} passages
 * @param {number} [similarityThreshold=0.25]
 * @returns {Array<{ leaderDocId: string, members: Array<Object>, termSet: Set<string> }>}
 */
export function clusterPassages(passages, similarityThreshold = 0.25) {
  const clusters = [];

  for (const passage of passages) {
    const text = `${passage.title} ${passage.body}`;
    const termSet = new Set(analyze(text, true));

    let assigned = false;
    for (const cluster of clusters) {
      const sim = jaccardSimilarity(termSet, cluster.termSet);
      if (sim >= similarityThreshold) {
        cluster.members.push(passage);
        // Merge prominent terms into cluster profile
        for (const t of termSet) cluster.termSet.add(t);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      clusters.push({
        leaderDocId: passage.docId,
        leaderTitle: passage.title,
        members: [passage],
        termSet
      });
    }
  }

  return clusters;
}

/**
 * Evaluates candidate ranking for ambiguity and generates a clarifying question if appropriate.
 *
 * @param {Array<{ docId: string, score: number, title: string, body: string }>} topResults
 * @param {Object} index - Inverted index
 * @param {Object} [options]
 * @param {number} [options.marginThreshold=CONFIG.conversation.clarifier.scoreMarginThreshold]
 * @returns {{ fired: boolean, margin: number, clustersCount: number, clarifyingQuestion: string | null, distinguishingTerms: Array<string>, reason: string }}
 */
export function evaluateClarification(topResults, index, options = {}) {
  const marginThreshold = options.marginThreshold ?? CONFIG.conversation.clarifier.scoreMarginThreshold;

  if (!topResults || topResults.length < 2) {
    return {
      fired: false,
      margin: 1.0,
      clustersCount: 0,
      clarifyingQuestion: null,
      distinguishingTerms: [],
      reason: 'Insufficient candidate results to evaluate ambiguity.'
    };
  }

  // 1. Margin Check: Compare rank 1 vs rank 2
  const margin = Number((topResults[0].score - topResults[1].score).toFixed(4));
  if (margin > marginThreshold) {
    return {
      fired: false,
      margin,
      clustersCount: 1,
      clarifyingQuestion: null,
      distinguishingTerms: [],
      reason: `High confidence: top score margin (${margin}) exceeds threshold (${marginThreshold}).`
    };
  }

  // 2. Leader/Follower Cluster Pruning
  const candidatesToCluster = topResults.slice(0, 6);
  const clusters = clusterPassages(candidatesToCluster, 0.25);

  // Must have at least 2 distinct clusters
  const significantClusters = clusters.filter(c => c.members.length >= 1);
  if (significantClusters.length < 2) {
    return {
      fired: false,
      margin,
      clustersCount: significantClusters.length,
      clarifyingQuestion: null,
      distinguishingTerms: [],
      reason: 'Candidates are topically cohesive (single dominant cluster).'
    };
  }

  // 3. Extract High-IDF Distinguishing Terms
  const clusterA = significantClusters[0];
  const clusterB = significantClusters[1];

  const getDistinctiveTerms = (targetCluster, otherCluster) => {
    const distinctive = [];
    for (const term of targetCluster.termSet) {
      if (!otherCluster.termSet.has(term)) {
        const idf = index.dictionary[term]?.idf || 0;
        if (idf > 0.5) {
          distinctive.push({ term, idf });
        }
      }
    }
    distinctive.sort((a, b) => b.idf - a.idf);
    return distinctive.slice(0, 2).map(x => x.term);
  };

  const termsA = getDistinctiveTerms(clusterA, clusterB);
  const termsB = getDistinctiveTerms(clusterB, clusterA);

  const topicA = termsA.join(' ') || clusterA.leaderTitle.split('-')[0].trim();
  const topicB = termsB.join(' ') || clusterB.leaderTitle.split('-')[0].trim();

  const clarifyingQuestion = `Did you mean information related to ${topicA} or ${topicB}?`;

  return {
    fired: true,
    margin,
    clustersCount: significantClusters.length,
    clarifyingQuestion,
    distinguishingTerms: [...termsA, ...termsB],
    reason: `Low margin (${margin} <= ${marginThreshold}) across ${significantClusters.length} distinct clusters.`
  };
}
