/**
 * @file server/src/index/postings.js
 * @description Inverted index posting and postings list data structures.
 * Supports term frequencies across document zones (title & body),
 * exact word position arrays, and classical postings intersection algorithms.
 */

/**
 * Single document posting entry for an indexed term.
 */
export class Posting {
  /**
   * @param {string} docId - Document identifier
   */
  constructor(docId) {
    this.docId = docId;
    this.tf = 0;
    this.titleTf = 0;
    this.bodyTf = 0;
    this.positions = [];
  }

  /**
   * Adds an occurrence of the term in this document.
   *
   * @param {number} position - Word position offset
   * @param {'title' | 'body'} zone - Document field zone
   */
  addOccurrence(position, zone) {
    this.tf++;
    if (zone === 'title') {
      this.titleTf++;
    } else {
      this.bodyTf++;
    }
    this.positions.push(position);
  }
}

/**
 * Merges two sorted postings lists using Boolean AND (intersection).
 * Standard two-pointer linear sweep algorithm: O(|P1| + |P2|).
 *
 * @param {Posting[]} p1 - First sorted postings list
 * @param {Posting[]} p2 - Second sorted postings list
 * @returns {Posting[]} Intersected postings list
 */
export function intersectPostings(p1, p2) {
  if (!p1 || !p2 || p1.length === 0 || p2.length === 0) {
    return [];
  }

  const result = [];
  let i = 0;
  let j = 0;

  while (i < p1.length && j < p2.length) {
    if (p1[i].docId === p2[j].docId) {
      // Merge postings information
      const merged = new Posting(p1[i].docId);
      merged.tf = p1[i].tf + p2[j].tf;
      merged.titleTf = p1[i].titleTf + p2[j].titleTf;
      merged.bodyTf = p1[i].bodyTf + p2[j].bodyTf;
      merged.positions = [...p1[i].positions, ...p2[j].positions].sort((a, b) => a - b);
      result.push(merged);
      i++;
      j++;
    } else if (p1[i].docId < p2[j].docId) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

/**
 * Merges two sorted postings lists using Boolean OR (union).
 * Linear sweep algorithm: O(|P1| + |P2|).
 *
 * @param {Posting[]} p1 - First sorted postings list
 * @param {Posting[]} p2 - Second sorted postings list
 * @returns {Posting[]} Union of postings lists
 */
export function unionPostings(p1, p2) {
  if (!p1 || p1.length === 0) return p2 ? [...p2] : [];
  if (!p2 || p2.length === 0) return [...p1];

  const result = [];
  let i = 0;
  let j = 0;

  while (i < p1.length && j < p2.length) {
    if (p1[i].docId === p2[j].docId) {
      result.push(p1[i]);
      i++;
      j++;
    } else if (p1[i].docId < p2[j].docId) {
      result.push(p1[i]);
      i++;
    } else {
      result.push(p2[j]);
      j++;
    }
  }

  while (i < p1.length) {
    result.push(p1[i++]);
  }
  while (j < p2.length) {
    result.push(p2[j++]);
  }

  return result;
}

/**
 * Computes Boolean NOT: all documents in the universe except those in postings list.
 *
 * @param {Posting[]} postings - Postings list to negate
 * @param {string[]} allDocIds - Sorted array of all document IDs in the collection
 * @returns {Posting[]} Complement postings list
 */
export function negatePostings(postings, allDocIds) {
  if (!postings || postings.length === 0) {
    return allDocIds.map(docId => new Posting(docId));
  }

  const excluded = new Set(postings.map(p => p.docId));
  const result = [];
  for (const docId of allDocIds) {
    if (!excluded.has(docId)) {
      result.push(new Posting(docId));
    }
  }
  return result;
}

/**
 * Positional intersection for phrase queries (Manning, Raghavan & Schütze, 2008, Ch. 2.4).
 * Finds documents where term 2 appears within `k` positions after term 1.
 * For exact consecutive bigrams / phrases, `k = 1`.
 *
 * @param {Posting[]} p1 - Postings of first term
 * @param {Posting[]} p2 - Postings of second term
 * @param {number} [maxDistance=1] - Maximum position delta (pos2 - pos1)
 * @returns {Posting[]} Filtered postings matching the phrase constraint
 */
export function positionalIntersect(p1, p2, maxDistance = 1) {
  if (!p1 || !p2 || p1.length === 0 || p2.length === 0) {
    return [];
  }

  const result = [];
  let i = 0;
  let j = 0;

  while (i < p1.length && j < p2.length) {
    if (p1[i].docId === p2[j].docId) {
      const positions1 = p1[i].positions;
      const positions2 = p2[j].positions;
      const matchedPositions = [];

      let posI = 0;
      let posJ = 0;

      while (posI < positions1.length && posJ < positions2.length) {
        const diff = positions2[posJ] - positions1[posI];
        if (diff > 0 && diff <= maxDistance) {
          matchedPositions.push(positions2[posJ]);
          posI++;
          posJ++;
        } else if (positions2[posJ] <= positions1[posI]) {
          posJ++;
        } else {
          posI++;
        }
      }

      if (matchedPositions.length > 0) {
        const matchPosting = new Posting(p1[i].docId);
        matchPosting.tf = matchedPositions.length;
        matchPosting.titleTf = p1[i].titleTf;
        matchPosting.bodyTf = p1[i].bodyTf;
        matchPosting.positions = matchedPositions;
        result.push(matchPosting);
      }

      i++;
      j++;
    } else if (p1[i].docId < p2[j].docId) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}
