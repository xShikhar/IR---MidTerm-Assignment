/**
 * @file server/src/index/builder.js
 * @description Inverted Index Construction Engine for TurnTrace.
 * Builds multi-zone inverted index with term frequencies, positional offsets,
 * document length norms (both SMART euclidean norm and BM25 token lengths),
 * and precomputed champion lists.
 */

import { tokenizeWithPositions } from './tokenizer.js';
import { normalizeTokensWithPositions } from './normalizer.js';
import { Posting } from './postings.js';
import { buildChampionLists } from './championLists.js';

/**
 * Builds the complete inverted index from an array of document passages.
 *
 * @param {Array<{ docId: string, title: string, body: string, domain: string }>} passages
 * @returns {Object} Complete Inverted Index data structure
 */
export function buildIndex(passages) {
  const totalDocs = passages.length;
  const docs = {};
  const dictionary = {}; // term -> { df, idf, bm25Idf, postings }
  const docTermWeights = {}; // docId -> Map<term, logTf> for computing Euclidean length
  const allDocIds = [];
  let totalTokensAcrossCollection = 0;

  for (let d = 0; d < totalDocs; d++) {
    const passage = passages[d];
    const docId = passage.docId;
    allDocIds.push(docId);

    // 1. Process title tokens
    const rawTitleTokens = tokenizeWithPositions(passage.title);
    const normTitleTokens = normalizeTokensWithPositions(rawTitleTokens, true);

    // 2. Process body tokens (offsetting positions after title)
    const rawBodyTokens = tokenizeWithPositions(passage.body);
    const titleOffset = rawTitleTokens.length + 10; // separation buffer for phrase search
    const normBodyTokens = normalizeTokensWithPositions(
      rawBodyTokens.map(t => ({ cleanToken: t.cleanToken, position: t.position + titleOffset })),
      true
    );

    const docLength = rawTitleTokens.length + rawBodyTokens.length;
    totalTokensAcrossCollection += docLength;

    // Track term occurrences within this document
    const termMap = new Map(); // term -> Posting
    const logTfMap = new Map();

    // Ingest title occurrences
    for (const item of normTitleTokens) {
      if (!termMap.has(item.term)) {
        termMap.set(item.term, new Posting(docId));
      }
      termMap.get(item.term).addOccurrence(item.position, 'title');
    }

    // Ingest body occurrences
    for (const item of normBodyTokens) {
      if (!termMap.has(item.term)) {
        termMap.set(item.term, new Posting(docId));
      }
      termMap.get(item.term).addOccurrence(item.position, 'body');
    }

    // Compute Euclidean norm for SMART lnc.ltc: sqrt(sum( (1 + ln(tf))^2 ))
    let sumSquaredWeights = 0;
    for (const [term, posting] of termMap.entries()) {
      const logTf = 1 + Math.log(posting.tf);
      logTfMap.set(term, logTf);
      sumSquaredWeights += logTf * logTf;

      // Add to global dictionary postings
      if (!dictionary[term]) {
        dictionary[term] = {
          df: 0,
          idf: 0,
          bm25Idf: 0,
          postings: []
        };
      }
      dictionary[term].df++;
      dictionary[term].postings.push(posting);
    }

    const euclideanNorm = Math.sqrt(sumSquaredWeights) || 1.0;

    docs[docId] = {
      docId,
      title: passage.title,
      body: passage.body,
      domain: passage.domain,
      docLength,
      titleLength: rawTitleTokens.length,
      bodyLength: rawBodyTokens.length,
      euclideanNorm
    };

    docTermWeights[docId] = logTfMap;
  }

  // 3. Compute collection-wide IDFs
  const avgDocLength = totalTokensAcrossCollection / (totalDocs || 1);

  for (const [term, entry] of Object.entries(dictionary)) {
    const df = entry.df;
    // Standard un-smoothed natural log IDF: ln(N / df)
    entry.idf = Math.log(totalDocs / df);
    // Robertson-Spärck Jones Okapi BM25 smoothed IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
    entry.bm25Idf = Math.max(0, Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5)));
  }

  // 4. Compute champion lists
  const championLists = buildChampionLists(dictionary);

  allDocIds.sort();

  return {
    metadata: {
      totalDocs,
      avgDocLength,
      vocabularySize: Object.keys(dictionary).length,
      totalPostings: Object.values(dictionary).reduce((acc, cur) => acc + cur.df, 0)
    },
    docs,
    dictionary,
    championLists,
    allDocIds
  };
}
