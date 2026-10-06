/**
 * @file eval/src/qrelsLoader.js
 * @description Loads conversation scenarios, dialogue turns, and human relevance judgments.
 * Provides judgment completeness validation and Cohen's Kappa inter-annotator agreement calculation.
 *
 * Ground Rule: Strictly reads human annotations. Does not generate any relevance labels.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Parses judged relevance grades from a CSV file.
 * Expected columns: queryId, docId, relevanceGrade.
 *
 * @param {string} csvPath
 * @returns {Record<string, Record<string, number>>} Map: queryId -> docId -> grade (0, 1, or 2)
 */
export function loadQrelsFromCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return {};
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return {};

  const qrels = {};
  const header = lines[0].toLowerCase();
  const headerCols = header.split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const queryIdIdx = headerCols.indexOf('queryid');
  const docIdIdx = headerCols.indexOf('docid');
  const gradeIdx = headerCols.indexOf('relevancegrade');

  const qIdx = queryIdIdx !== -1 ? queryIdIdx : 2;
  const dIdx = docIdIdx !== -1 ? docIdIdx : 8;
  const gIdx = gradeIdx !== -1 ? gradeIdx : 12;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
      ?.map(c => c.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];

    const queryId = cols[qIdx];
    const docId = cols[dIdx];
    const rawGrade = cols[gIdx];

    if (queryId && docId && rawGrade !== '' && rawGrade !== undefined && !isNaN(Number(rawGrade))) {
      const grade = Number(rawGrade);
      if (!qrels[queryId]) qrels[queryId] = {};
      qrels[queryId][docId] = grade;
    }
  }

  return qrels;
}

/**
 * Validates the completeness of relevance judgments across all conversational turns.
 *
 * @param {Array<Object>} conversations - Conversation definitions
 * @param {Record<string, Record<string, number>>} qrels - Loaded qrels
 * @returns {{ isComplete: boolean, totalTurns: number, judgedTurnsCount: number, missingTurns: string[], totalJudgedPairs: number }}
 */
export function validateCompleteness(conversations, qrels) {
  const allTurns = [];
  for (const conv of conversations) {
    for (const turn of conv.turns) {
      allTurns.push(`${conv.id}_${turn.turnId}`);
    }
  }

  const missingTurns = [];
  let judgedTurnsCount = 0;
  let totalJudgedPairs = 0;

  for (const turnKey of allTurns) {
    const turnMap = qrels[turnKey];
    if (turnMap && Object.keys(turnMap).length > 0) {
      judgedTurnsCount++;
      totalJudgedPairs += Object.keys(turnMap).length;
    } else {
      missingTurns.push(turnKey);
    }
  }

  return {
    isComplete: missingTurns.length === 0,
    totalTurns: allTurns.length,
    judgedTurnsCount,
    missingTurns,
    totalJudgedPairs
  };
}

/**
 * Computes Cohen's Kappa coefficient of inter-annotator agreement between two independent judges
 * on overlapping judged turns/documents.
 *
 * @param {Record<string, number> | Array<Object>} judgeA - Map or array of (turnKey_docId -> grade)
 * @param {Record<string, number> | Array<Object>} judgeB - Map or array of (turnKey_docId -> grade)
 * @returns {{ n: number, observedAgreement: number, chanceAgreement: number, kappa: number, agreementMatrix: Object }}
 */
export function computeCohenKappa(judgeA, judgeB) {
  // Normalize inputs to Map: "queryId_docId" -> grade
  const mapA = new Map();
  const mapB = new Map();

  const toMap = (src, target) => {
    if (src instanceof Map) {
      for (const [k, v] of src.entries()) target.set(k, Number(v));
    } else if (Array.isArray(src)) {
      for (const item of src) {
        if (item.queryId && item.docId && item.relevanceGrade !== '' && item.relevanceGrade !== undefined) {
          target.set(`${item.queryId}_${item.docId}`, Number(item.relevanceGrade));
        }
      }
    } else if (typeof src === 'object' && src !== null) {
      for (const [k, v] of Object.entries(src)) {
        if (typeof v === 'object' && v !== null) {
          for (const [d, grade] of Object.entries(v)) {
            target.set(`${k}_${d}`, Number(grade));
          }
        } else {
          target.set(k, Number(v));
        }
      }
    }
  };

  toMap(judgeA, mapA);
  toMap(judgeB, mapB);

  // Find shared keys
  const overlappingKeys = [];
  for (const key of mapA.keys()) {
    if (mapB.has(key)) {
      overlappingKeys.push(key);
    }
  }

  const n = overlappingKeys.length;
  if (n === 0) {
    return {
      n: 0,
      observedAgreement: 0,
      chanceAgreement: 0,
      kappa: 0,
      agreementMatrix: {},
      note: 'Zero overlapping judged items between the two judges.'
    };
  }

  // Categories: grades 0, 1, 2
  const categories = [0, 1, 2];
  const matrix = {
    0: { 0: 0, 1: 0, 2: 0 },
    1: { 0: 0, 1: 0, 2: 0 },
    2: { 0: 0, 1: 0, 2: 0 }
  };

  let agreements = 0;
  for (const key of overlappingKeys) {
    const valA = mapA.get(key);
    const valB = mapB.get(key);
    const catA = [0, 1, 2].includes(valA) ? valA : 0;
    const catB = [0, 1, 2].includes(valB) ? valB : 0;

    matrix[catA][catB]++;
    if (catA === catB) {
      agreements++;
    }
  }

  const observedAgreement = agreements / n;

  // Marginal probabilities
  let chanceAgreement = 0;
  for (const cat of categories) {
    const rowSum = matrix[cat][0] + matrix[cat][1] + matrix[cat][2];
    const colSum = matrix[0][cat] + matrix[1][cat] + matrix[2][cat];
    const pA = rowSum / n;
    const pB = colSum / n;
    chanceAgreement += pA * pB;
  }

  let kappa = 0;
  if (chanceAgreement === 1) {
    kappa = 1;
  } else {
    kappa = (observedAgreement - chanceAgreement) / (1 - chanceAgreement);
  }

  return {
    n,
    observedAgreement: Number(observedAgreement.toFixed(4)),
    chanceAgreement: Number(chanceAgreement.toFixed(4)),
    kappa: Number(kappa.toFixed(4)),
    agreementMatrix: matrix
  };
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

  const completeness = validateCompleteness(conversations, qrels);

  console.log(`[TurnTrace Qrels Loader] Loaded ${conversations.length} conversations, ${completeness.judgedTurnsCount}/${completeness.totalTurns} judged turns (${completeness.totalJudgedPairs} judged doc pairs).`);
  if (!completeness.isComplete) {
    console.warn(`[TurnTrace Qrels Loader] STATUS: Incomplete judging (${completeness.missingTurns.length} turns unjudged). Awaiting team relevance judgments via eval/output/pooling/judge_*_pool.csv.`);
  }

  return { conversations, qrels };
}
