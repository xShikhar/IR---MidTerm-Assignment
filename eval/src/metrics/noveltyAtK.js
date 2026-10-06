/**
 * @file eval/src/metrics/noveltyAtK.js
 * @description Novelty@K Evaluation Metric.
 * Measures the fraction of the top-K retrieved passages on a given turn that were
 * NOT displayed to the user in any earlier turn of the same conversational session.
 * High novelty indicates reduced redundant repeat passages across conversational turns.
 */

/**
 * Computes Novelty@K for a turn given its ranked results and the set of previously shown docIds.
 *
 * @param {Array<{ docId: string }>} rankedList - Ranked passages returned for the turn
 * @param {Set<string> | Array<string>} seenDocIds - Passages displayed in previous turns
 * @param {number} [k=10] - Cutoff depth
 * @returns {{ noveltyAtK: number, newCount: number, seenCount: number }}
 */
export function computeNoveltyAtK(rankedList, seenDocIds = new Set(), k = 10) {
  if (!rankedList || rankedList.length === 0 || k <= 0) {
    return { noveltyAtK: 1.0, newCount: 0, seenCount: 0 };
  }

  const seenSet = seenDocIds instanceof Set ? seenDocIds : new Set(seenDocIds);
  const cutoff = rankedList.slice(0, k);

  let newCount = 0;
  let seenCount = 0;

  for (const item of cutoff) {
    if (seenSet.has(item.docId)) {
      seenCount++;
    } else {
      newCount++;
    }
  }

  const effectiveK = cutoff.length;
  const noveltyAtK = effectiveK > 0 ? Number((newCount / effectiveK).toFixed(4)) : 1.0;

  return {
    noveltyAtK,
    newCount,
    seenCount
  };
}
