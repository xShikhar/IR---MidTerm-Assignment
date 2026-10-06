/**
 * @file server/src/retrieval/heap.js
 * @description Binary Min-Heap data structure for efficient O(N log K) top-K selection.
 * Maintains the K highest-scoring documents without requiring an expensive O(N log N) full sort.
 */

/**
 * @typedef {Object} ScoredDocument
 * @property {string} docId - Document identifier
 * @property {number} score - Document relevance score
 * @property {Object} [breakdown] - Intermediate score breakdown for inspection
 */

export class TopKHeap {
  /**
   * @param {number} k - Maximum number of top elements to retain
   */
  constructor(k) {
    this.k = k;
    /** @type {ScoredDocument[]} */
    this.data = [];
  }

  /**
   * Returns current count of items in the heap.
   * @returns {number}
   */
  size() {
    return this.data.length;
  }

  /**
   * Returns the minimum element currently in top-K without removing it.
   * @returns {ScoredDocument | null}
   */
  peek() {
    return this.data.length > 0 ? this.data[0] : null;
  }

  /**
   * Inserts an element or replaces the minimum if score is higher.
   *
   * @param {ScoredDocument} item
   */
  insert(item) {
    if (this.data.length < this.k) {
      this.data.push(item);
      this._siftUp(this.data.length - 1);
    } else if (item.score > this.data[0].score) {
      this.data[0] = item;
      this._siftDown(0);
    }
  }

  /**
   * Extracts all items sorted in descending order of score.
   *
   * @returns {ScoredDocument[]}
   */
  toSortedArray() {
    const copy = [...this.data];
    return copy.sort((a, b) => b.score - a.score);
  }

  _siftUp(index) {
    let curr = index;
    while (curr > 0) {
      const parent = Math.floor((curr - 1) / 2);
      if (this.data[curr].score < this.data[parent].score) {
        const temp = this.data[curr];
        this.data[curr] = this.data[parent];
        this.data[parent] = temp;
        curr = parent;
      } else {
        break;
      }
    }
  }

  _siftDown(index) {
    let curr = index;
    const length = this.data.length;

    while (true) {
      const left = 2 * curr + 1;
      const right = 2 * curr + 2;
      let smallest = curr;

      if (left < length && this.data[left].score < this.data[smallest].score) {
        smallest = left;
      }
      if (right < length && this.data[right].score < this.data[smallest].score) {
        smallest = right;
      }

      if (smallest !== curr) {
        const temp = this.data[curr];
        this.data[curr] = this.data[smallest];
        this.data[smallest] = temp;
        curr = smallest;
      } else {
        break;
      }
    }
  }
}
