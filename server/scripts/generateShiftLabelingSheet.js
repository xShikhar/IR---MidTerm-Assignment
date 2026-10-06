/**
 * @file server/scripts/generateShiftLabelingSheet.js
 * @description Generates a human labeling sheet for conversational shift detection actions.
 * Outputs all 70 turns across dev and test splits with an empty expectedAction column
 * for human annotators to label ("carry" | "reset" | "entity_switch").
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
const rows = [];
rows.push(['conversationId', 'domain', 'split', 'turnIndex', 'turnId', 'query', 'previousTurns', 'detectedAction', 'expectedAction', 'notes'].join(','));

for (const c of convs) {
  const split = devSet.has(c.id) ? 'dev' : 'test';
  const ctx = new ContextState();
  const prevTurns = [];

  for (let i = 0; i < c.turns.length; i++) {
    const t = c.turns[i];
    let detected = 'INITIAL';
    if (i > 0) {
      const dec = detectTopicShift(t.query, ctx.getVector(), index);
      detected = dec.decision;
    }
    ctx.update(t.query, [{ docId: 'dummy', title: t.query, body: t.query }], index);

    const prevStr = prevTurns.map((p, idx) => `T${idx+1}: ${p}`).join(' | ');
    prevTurns.push(t.query);

    const csvEscape = str => '"' + String(str || '').replace(/"/g, '""') + '"';

    rows.push([
      c.id,
      c.domain,
      split,
      i + 1,
      t.turnId,
      csvEscape(t.query),
      csvEscape(prevStr),
      detected,
      '', // expectedAction left strictly blank for judges
      ''  // notes left blank
    ].join(','));
  }
}

const outDir = path.resolve('eval/output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'shift_labeling_sheet.csv');
fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
console.log(`[Shift Labeling Sheet] Successfully generated ${rows.length - 1} turns at ${outPath}`);
