/**
 * @file server/src/index/normalizer.js
 * @description Morphological normalization and stop-word filtering module.
 * Combines diacritic stripping, case folding, stop word elimination,
 * and Porter stemming.
 */

import { stem } from './porterStemmer.js';

// Standard Information Retrieval stop words (SMART / Salton & Buckley standard set)
export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
  'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
  'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll',
  'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
  'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
  'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
  'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to',
  'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom',
  'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
  'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Strips accents, decomposes unicode diacritics, and normalizes to ASCII.
 *
 * @param {string} text - Raw input text
 * @returns {string} Normalized ASCII string
 */
export function removeDiacritics(text) {
  if (!text || typeof text !== 'string') return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Checks if a token is a stop word.
 *
 * @param {string} token - Lowercase token
 * @returns {boolean} True if token is in the stop words dictionary
 */
export function isStopWord(token) {
  return STOP_WORDS.has(token.toLowerCase());
}

/**
 * Normalizes a single word token: lowercases, strips diacritics, and stems.
 *
 * @param {string} token - Input word
 * @returns {string} Stemmed morphological token
 */
export function normalizeToken(token) {
  if (!token || typeof token !== 'string') return '';
  const clean = removeDiacritics(token).toLowerCase().trim();
  return stem(clean);
}

/**
 * Normalizes an array of raw positional tokens:
 * eliminates stop words while preserving positional offsets.
 *
 * @param {Array<{ cleanToken: string, position: number }>} positionalTokens
 * @param {boolean} [filterStopwords=true] - Whether to filter out stop words
 * @returns {Array<{ term: string, position: number }>} Normalized terms with original positions
 */
export function normalizeTokensWithPositions(positionalTokens, filterStopwords = true) {
  const result = [];
  for (const item of positionalTokens) {
    const raw = item.cleanToken;
    if (filterStopwords && isStopWord(raw)) {
      continue;
    }
    const term = normalizeToken(raw);
    if (term.length > 0) {
      result.push({
        term,
        position: item.position
      });
    }
  }
  return result;
}

/**
 * High-level pipeline: takes a string of text, tokenizes, removes stop words, and stems.
 *
 * @param {string} text - Raw input text
 * @param {boolean} [filterStopwords=true] - Whether to filter out stop words
 * @returns {string[]} Array of normalized stems
 */
export function analyze(text, filterStopwords = true) {
  if (!text || typeof text !== 'string') return [];
  // Normalize diacritics and tokenize
  const clean = removeDiacritics(text);
  const words = clean
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const stems = [];
  for (const w of words) {
    if (filterStopwords && isStopWord(w)) {
      continue;
    }
    const s = normalizeToken(w);
    if (s.length > 0) {
      stems.push(s);
    }
  }
  return stems;
}
