/**
 * @file server/scripts/generateShiftLabelingSheet.js
 * @description Generates a human labeling sheet for conversational shift detection actions.
 * Outputs all 70 turns across dev and test splits with an empty expectedAction column
 * for human annotators to label ("carry" | "reset" | "entity_switch").
 *
 * NOTE: Annotator sheets strictly exclude detector predictions (detectedAction) to
 * prevent annotator bias. Detector predictions are written separately to
 * eval/output/detector_shift_predictions.csv for internal analysis only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadIndex } from '../src/index/serializer.js';
import { detectTopicShift } from '../src/conversation/shiftDetector.js';
import { ContextState } from '../src/conversation/contextState.js';

const index = loadIndex('data/index.json');
const convs = JSON.parse(fs.readFileSync('data/conversations.json', 'utf8'));
const splits = JSON.parse(fs.readFileSync('data/splits.json', 'utf8'));

const devSet = new Set(splits.dev.conversationIds);
const annotatorRows = [];
const detectorRows = [];

// Header for annotator sheet (NO detectedAction column to prevent bias)
annotatorRows.push(['conversationId', 'domain', 'split', 'turnIndex', 'turnId', 'query', 'previousTurns', 'expectedAction', 'notes'].join(','));

// Header for internal detector outputs (stored separately; annotators never open)
detectorRows.push(['conversationId', 'domain', 'split', 'turnIndex', 'turnId', 'query', 'detectedAction', 'cosineSimilarity', 'hasPronoun', 'isShortQuery', 'hasEllipsis', 'reason'].join(','));

const csvEscape = str => '"' + String(str || '').replace(/"/g, '""') + '"';

for (const c of convs) {
  const split = devSet.has(c.id) ? 'dev' : 'test';
  const ctx = new ContextState();
  const prevTurns = [];

  for (let i = 0; i < c.turns.length; i++) {
    const t = c.turns[i];
    let detected = 'INITIAL';
    let cosineSim = 1.0;
    let hasPronoun = false;
    let isShort = false;
    let hasEllipsis = false;
    let reason = 'Initial turn';

    if (i > 0) {
      const dec = detectTopicShift(t.query, ctx.getVector(), index);
      detected = dec.decision;
      cosineSim = dec.cosineSimilarity;
      hasPronoun = dec.signals.hasPronoun;
      isShort = dec.signals.isShortQuery;
      hasEllipsis = dec.signals.hasEllipsis;
      reason = dec.reason;
    }
    ctx.update(t.query, [{ docId: 'dummy', title: t.query, body: t.query }], index);

    const prevStr = prevTurns.map((p, idx) => `T${idx+1}: ${p}`).join(' | ');
    prevTurns.push(t.query);

    // Annotator row
    annotatorRows.push([
      c.id,
      c.domain,
      split,
      i + 1,
      t.turnId,
      csvEscape(t.query),
      csvEscape(prevStr),
      '', // expectedAction left strictly blank for judges ("carry" | "reset" | "entity_switch")
      ''  // notes left blank
    ].join(','));

    // Internal detector row
    detectorRows.push([
      c.id,
      c.domain,
      split,
      i + 1,
      t.turnId,
      csvEscape(t.query),
      detected,
      cosineSim,
      hasPronoun,
      isShort,
      hasEllipsis,
      csvEscape(reason)
    ].join(','));
  }
}

const outDir = path.resolve('eval/output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Write annotator sheet (bias-free)
const annotatorPath = path.join(outDir, 'shift_labeling_sheet.csv');
fs.writeFileSync(annotatorPath, annotatorRows.join('\n'), 'utf8');
console.log(`[Shift Labeling Sheet] Successfully generated annotator sheet (${annotatorRows.length - 1} turns) at ${annotatorPath}`);

// 2. Write internal detector outputs (stored separately)
const detectorPath = path.join(outDir, 'detector_shift_predictions.csv');
fs.writeFileSync(detectorPath, detectorRows.join('\n'), 'utf8');
console.log(`[Shift Labeling Sheet] Successfully generated internal detector outputs (${detectorRows.length - 1} turns) at ${detectorPath}`);
