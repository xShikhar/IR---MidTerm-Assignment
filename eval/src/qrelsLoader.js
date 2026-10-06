/**
 * @file eval/src/qrelsLoader.js
 * @description Loads conversation scenarios, dialogue turns, and pooled relevance judgments.
 */

import fs from 'node:fs';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Loads evaluated conversation sessions and pooled qrels.
 *
 * @returns {{ conversations: Array<Object>, qrels: Record<string, Record<string, number>> }}
 */
export function loadEvaluationData() {
  const convPath = CONFIG.paths.conversationsFile;
  const qrelsPath = CONFIG.paths.qrelsFile;

  if (!fs.existsSync(convPath) || !fs.existsSync(qrelsPath)) {
    throw new Error('Evaluation datasets not found. Run "npm run prepare:data" first.');
  }

  const conversations = JSON.parse(fs.readFileSync(convPath, 'utf-8'));
  const qrels = JSON.parse(fs.readFileSync(qrelsPath, 'utf-8'));

  return { conversations, qrels };
}
