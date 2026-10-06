/**
 * @file eval/src/qrelsLoader.js
 * @description Loads conversation scenarios, dialogue turns, and human relevance judgments.
 * Supports loading from data/qrels.json or eval/output/judged_qrels.csv.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Parses judged relevance grades from a CSV file.
 *
 * @param {string} csvPath
 * @returns {Record<string, Record<string, number>>}
 */
export function loadQrelsFromCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return {};
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return {};

  const qrels = {};
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    // Regex matching CSV with quotes
    const cols = lines[i].match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
      ?.map(c => c.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];

    const queryId = cols[0];
    const docId = cols[5];
    const rawGrade = cols[9];

    if (queryId && docId && rawGrade !== '' && rawGrade !== undefined && !isNaN(Number(rawGrade))) {
      const grade = Number(rawGrade);
      if (grade >= 1) { // 1 = relevant, 2 = highly relevant
        if (!qrels[queryId]) qrels[queryId] = {};
        qrels[queryId][docId] = grade;
      }
    }
  }

  return qrels;
}

/**
 * Loads evaluated conversation sessions and pooled qrels.
 *
 * @returns {{ conversations: Array<Object>, qrels: Record<string, Record<string, number>> }}
 */
export function loadEvaluationData() {
  const convPath = CONFIG.paths.conversationsFile;
  const qrelsPath = CONFIG.paths.qrelsFile;
  const judgedCsvPath = path.join(CONFIG.paths.evalOutputDir, 'judged_qrels.csv');
  const poolingCsvPath = path.join(CONFIG.paths.evalOutputDir, 'pooling_sheet.csv');

  if (!fs.existsSync(convPath)) {
    throw new Error('Conversations file not found. Run "npm run prepare:data" first.');
  }

  const conversations = JSON.parse(fs.readFileSync(convPath, 'utf-8'));
  let qrels = {};

  // 1. Try loading from judged_qrels.csv if annotators saved CSV
  if (fs.existsSync(judgedCsvPath)) {
    qrels = loadQrelsFromCsv(judgedCsvPath);
  } else if (fs.existsSync(qrelsPath)) {
    try {
      qrels = JSON.parse(fs.readFileSync(qrelsPath, 'utf-8'));
    } catch {
      qrels = {};
    }
  }

  // If qrels is empty, check pooling_sheet.csv for any entered grades
  if (Object.keys(qrels).length === 0 && fs.existsSync(poolingCsvPath)) {
    qrels = loadQrelsFromCsv(poolingCsvPath);
  }

  const judgedTurnCount = Object.keys(qrels).length;
  const totalJudgedDocs = Object.values(qrels).reduce((sum, m) => sum + Object.keys(m).length, 0);

  console.log(`[TurnTrace Qrels Loader] Loaded ${conversations.length} conversations, ${judgedTurnCount} judged turns (${totalJudgedDocs} judged relevant doc pairs).`);
  if (judgedTurnCount === 0) {
    console.warn('[TurnTrace Qrels Loader] WARNING: Qrels dataset is currently unjudged. Awaiting team relevance judgments via eval/output/pooling_sheet.csv.');
  }

  return { conversations, qrels };
}
