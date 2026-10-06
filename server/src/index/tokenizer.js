/**
 * @file server/src/index/tokenizer.js
 * @description Lexical analysis module for TurnTrace.
 * Converts unstructured text into indexed positional tokens with offset metadata.
 */

/**
 * @typedef {Object} PositionalToken
 * @property {string} rawToken - Original token extracted from text
 * @property {string} cleanToken - Normalized alphanumeric token
 * @property {number} position - 0-indexed token ordinal in the stream
 */

/**
 * Tokenizes text into an array of lowercase tokens with positional offsets.
 * Preserves token order for phrase queries and positional index construction.
 *
 * @param {string} text - Raw input string
 * @returns {PositionalToken[]} Array of tokens with position metadata
 */
export function tokenizeWithPositions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Regex matching words, numbers, and alphanumeric identifiers
  // Strips peripheral punctuation while preserving internal word structure
  const wordRegex = /[a-zA-Z0-9]+(?:'[a-zA-Z0-9]+)?/g;
  const tokens = [];
  let match;
  let position = 0;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawToken = match[0];
    const cleanToken = rawToken.toLowerCase().replace(/^'+|'+$/g, '');
    if (cleanToken.length > 0) {
      tokens.push({
        rawToken,
        cleanToken,
        position: position++
      });
    }
  }

  return tokens;
}

/**
 * Simple tokenization returning an array of string tokens.
 *
 * @param {string} text - Raw input text
 * @returns {string[]} Array of token strings
 */
export function tokenize(text) {
  return tokenizeWithPositions(text).map(t => t.cleanToken);
}
