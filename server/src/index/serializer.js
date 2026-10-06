/**
 * @file server/src/index/serializer.js
 * @description Inverted Index Disk Serialization and Deserialization Engine.
 * Supports streaming file I/O for saving and loading the complete index.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config/index.js';

/**
 * Serializes the complete in-memory index structure to disk as JSON.
 *
 * @param {Object} index - Index data structure from builder
 * @param {string} [filePath=CONFIG.paths.indexFile] - Destination file path
 */
export function saveIndex(index, filePath = CONFIG.paths.indexFile) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const jsonString = JSON.stringify(index);
  fs.writeFileSync(filePath, jsonString, 'utf-8');
}

/**
 * Loads the serialized inverted index from disk into memory.
 *
 * @param {string} [filePath=CONFIG.paths.indexFile] - Target file path
 * @returns {Object} Deserialized Inverted Index structure
 */
export function loadIndex(filePath = CONFIG.paths.indexFile) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[TurnTrace Index Loader] Index file not found at: ${filePath}. Run 'npm run build:index' first.`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const index = JSON.parse(raw);

  if (!index.metadata || !index.docs || !index.dictionary) {
    throw new Error('[TurnTrace Index Loader] Corrupted index file: missing required index components.');
  }

  return index;
}
