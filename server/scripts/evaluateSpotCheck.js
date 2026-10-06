/**
 * @file server/scripts/evaluateSpotCheck.js
 * @description Computes inter-annotator agreement (Cohen's Kappa) between human spot-check judgments
 * and reference LLM relevance grades.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCohenKappa } from '../../eval/src/qrelsLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export function evaluateSpotCheckAgreement() {
  const sheetPath = path.join(rootDir, 'eval/output/spot_check_sheet.csv');
  const keyPath = path.join(rootDir, 'eval/output/spot_check_key.csv');

  if (!fs.existsSync(sheetPath) || !fs.existsSync(keyPath)) {
    console.error('Spot check sheet or key file missing.');
    process.exit(1);
  }

  const parseCsvToMap = (filePath, queryCol, docCol, gradeCol) => {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
    const header = lines[0].toLowerCase().split(',').map(c => c.replace(/^"|"$/g, '').trim());
    const qIdx = header.indexOf(queryCol.toLowerCase());
    const dIdx = header.indexOf(docCol.toLowerCase());
    const gIdx = header.indexOf(gradeCol.toLowerCase());

    const map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)
        ?.map(c => c.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
      const q = cols[qIdx];
      const d = cols[dIdx];
      const g = cols[gIdx];
      if (q && d && g !== '' && g !== undefined && !isNaN(Number(g))) {
        map.set(`${q}_${d}`, Number(g));
      }
    }
    return map;
  };

  const humanMap = parseCsvToMap(sheetPath, 'queryId', 'docId', 'relevanceGrade');
  const keyMap = parseCsvToMap(keyPath, 'queryId', 'docId', 'referenceGrade');

  console.log('=== TurnTrace Human Spot-Check Agreement Evaluation ===');
  console.log(`Reference entries: ${keyMap.size}`);
  console.log(`Human completed entries: ${humanMap.size}`);

  if (humanMap.size === 0) {
    console.log('Notice: Human spot-check grades have not yet been entered in eval/output/spot_check_sheet.csv.');
    console.log('Once human annotators fill in the "relevanceGrade" column (0, 1, or 2), re-run this script to compute Cohen\'s Kappa.');
    return { status: 'PENDING_HUMAN_LABELS', completedRows: 0 };
  }

  const kappa = computeCohenKappa(humanMap, keyMap);
  console.log(`- Overlapping Judged Items: ${kappa.n}`);
  console.log(`- Observed Agreement: ${kappa.observedAgreement}`);
  console.log(`- Chance Agreement:   ${kappa.chanceAgreement}`);
  console.log(`- Cohen's Kappa:      ${kappa.kappa}`);
  return kappa;
}

if (process.argv[1] && process.argv[1].endsWith('evaluateSpotCheck.js')) {
  evaluateSpotCheckAgreement();
}
