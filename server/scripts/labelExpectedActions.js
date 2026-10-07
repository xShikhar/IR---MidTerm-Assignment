/**
 * @file server/scripts/labelExpectedActions.js
 * @description Generates and imports AI-labeled expectedAction labels for all 70 benchmark turns.
 *
 * Requirements:
 * 1. Labels strictly based on dialogue context: previous turns + current query.
 * 2. Classes: 'carry', 'reset', 'entity_switch'.
 * 3. Saves first to eval/output/expected_action_llm.csv.
 * 4. Imports into data/conversations.json.
 * 5. Turn 1 of each conversation is excluded from decision metrics.
 * 6. Evaluates decision metrics on DEV split for:
 *    - Legacy cosine shift detector
 *    - New entity-lock decision detector
 * 7. Reports aggregate counts for TEST.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIndex } from '../src/index/serializer.js';
import { CONFIG } from '../src/config/index.js';
import { ContextState } from '../src/conversation/contextState.js';
import { detectTopicShift } from '../src/conversation/shiftDetector.js';
import { detectConversationalDecision } from '../src/conversation/decisionDetector.js';
import { evaluateDecisionClassification } from '../../eval/src/metrics/decisionClassification.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export function runExpectedActionLabeling() {
  console.log('=== TurnTrace Phase 4: Expected Action Labeling ===');

  const convsPath = CONFIG.paths.conversationsFile;
  const splitsPath = CONFIG.paths.splitsFile;
  const conversations = JSON.parse(fs.readFileSync(convsPath, 'utf-8'));
  const splits = JSON.parse(fs.readFileSync(splitsPath, 'utf-8'));

  const devConvIds = new Set(splits.dev.conversationIds);
  const testConvIds = new Set(splits.test.conversationIds);

  // AI-labeled expected actions based strictly on conversation structure:
  // - carry: Standard continuity, aspectual follow-up, or pronoun anaphora.
  // - reset: Disjoint entity topic transition with zero lexical context overlap (conv_09_T4 black hole, conv_10_T4 Mona Lisa).
  // - entity_switch: Disjoint entity domain pivot that retains surface lexical overlap (conv_11_T4 mercury element, conv_12_T4 electrical transformer).
  const expectedLabels = {
    // conv_01: Quantum Computing
    'conv_01_turn_01': { action: 'carry', rationale: 'Initial turn establishes quantum computing topic.' },
    'conv_01_turn_02': { action: 'carry', rationale: 'Mechanistic follow-up on qubit superposition.' },
    'conv_01_turn_03': { action: 'carry', rationale: 'Mechanism follow-up on quantum entanglement.' },
    'conv_01_turn_04': { action: 'carry', rationale: 'Computational speedup inquiry on quantum systems.' },
    'conv_01_turn_05': { action: 'carry', rationale: 'Physical stability inquiry on quantum decoherence.' },

    // conv_02: Relational Databases & SQL
    'conv_02_turn_01': { action: 'carry', rationale: 'Initial turn establishes relational databases.' },
    'conv_02_turn_02': { action: 'carry', rationale: 'Key constraint follow-up on primary keys.' },
    'conv_02_turn_03': { action: 'carry', rationale: 'Relational integrity follow-up on foreign keys.' },
    'conv_02_turn_04': { action: 'carry', rationale: 'Schema normalization follow-up on normal forms.' },
    'conv_02_turn_05': { action: 'carry', rationale: 'Transactional guarantee follow-up on ACID properties.' },

    // conv_03: James Webb Space Telescope
    'conv_03_turn_01': { action: 'carry', rationale: 'Initial turn establishes JWST observatory.' },
    'conv_03_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on JWST orbit location.' },
    'conv_03_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on primary mirror size.' },
    'conv_03_turn_04': { action: 'carry', rationale: 'Thermal instrument protection follow-up on sunshield.' },
    'conv_03_turn_05': { action: 'carry', rationale: 'Pronoun/aspect follow-up on infrared observation.' },

    // conv_04: Apollo 11 Moon Landing
    'conv_04_turn_01': { action: 'carry', rationale: 'Initial turn establishes Apollo 11 mission.' },
    'conv_04_turn_02': { action: 'carry', rationale: 'Spacecraft nomenclature follow-up on lunar module.' },
    'conv_04_turn_03': { action: 'carry', rationale: 'Landing geography follow-up on Sea of Tranquility.' },
    'conv_04_turn_04': { action: 'carry', rationale: 'Pronoun follow-up on surface stay duration.' },
    'conv_04_turn_05': { action: 'carry', rationale: 'Mission recovery follow-up on command module splashdown.' },

    // conv_05: CRISPR-Cas9 Gene Editing
    'conv_05_turn_01': { action: 'carry', rationale: 'Initial turn establishes CRISPR-Cas9 genome editing.' },
    'conv_05_turn_02': { action: 'carry', rationale: 'Mechanistic targeting follow-up on guide RNA.' },
    'conv_05_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on Nobel Prize laureates.' },
    'conv_05_turn_04': { action: 'carry', rationale: 'Societal and ethical follow-up on human germline editing.' },
    'conv_05_turn_05': { action: 'carry', rationale: 'Comparative therapeutic follow-up on somatic vs germline therapy.' },

    // conv_06: mRNA Vaccines
    'conv_06_turn_01': { action: 'carry', rationale: 'Initial turn establishes mRNA vaccines.' },
    'conv_06_turn_02': { action: 'carry', rationale: 'Delivery vehicle follow-up on lipid nanoparticles.' },
    'conv_06_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on cellular spike protein translation.' },
    'conv_06_turn_04': { action: 'carry', rationale: 'Pronoun follow-up on immune antibody response.' },
    'conv_06_turn_05': { action: 'carry', rationale: 'Storage stability follow-up on ultra-cold temperatures.' },

    // conv_07: Johannes Gutenberg Printing Press
    'conv_07_turn_01': { action: 'carry', rationale: 'Initial turn establishes European movable type press.' },
    'conv_07_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on Gutenberg first print shop in Mainz.' },
    'conv_07_turn_03': { action: 'carry', rationale: 'Publication history follow-up on first major printed book.' },
    'conv_07_turn_04': { action: 'carry', rationale: 'Pronoun follow-up on Protestant Reformation influence.' },
    'conv_07_turn_05': { action: 'carry', rationale: 'Societal consequence follow-up on European literacy rates.' },

    // conv_08: Ancient Library of Alexandria
    'conv_08_turn_01': { action: 'carry', rationale: 'Initial turn establishes Library of Alexandria.' },
    'conv_08_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on Ptolemaic royal founders.' },
    'conv_08_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on papyrus scroll capacity.' },
    'conv_08_turn_04': { action: 'carry', rationale: 'Historical inquiry follow-up on library destruction.' },
    'conv_08_turn_05': { action: 'carry', rationale: 'Intellectual leadership follow-up on chief librarians.' },

    // conv_09: Alan Turing to Black Holes (Cross-domain Topic Shift)
    'conv_09_turn_01': { action: 'carry', rationale: 'Initial turn establishes Alan Turing imitation game.' },
    'conv_09_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on 1950 Mind paper.' },
    'conv_09_turn_03': { action: 'carry', rationale: 'Philosophical objections follow-up on imitation game.' },
    'conv_09_turn_04': { action: 'reset', rationale: 'Abrupt topic shift to astrophysical black holes with zero context overlap.' },
    'conv_09_turn_05': { action: 'carry', rationale: 'Pronoun follow-up on black hole event horizon.' },

    // conv_10: Penicillin to Mona Lisa (Cross-domain Topic Shift)
    'conv_10_turn_01': { action: 'carry', rationale: 'Initial turn establishes Alexander Fleming penicillin.' },
    'conv_10_turn_02': { action: 'carry', rationale: 'Biological origin follow-up on Penicillium mould.' },
    'conv_10_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on Oxford purification team.' },
    'conv_10_turn_04': { action: 'reset', rationale: 'Abrupt topic shift to Mona Lisa painting in Florence with zero context overlap.' },
    'conv_10_turn_05': { action: 'carry', rationale: 'Pronoun follow-up on Louvre Museum exhibition.' },

    // conv_11: Mercury Planet vs Toxic Chemical Element (Polysemy Ambiguity)
    'conv_11_turn_01': { action: 'carry', rationale: 'Initial turn establishes astronomical planet Mercury.' },
    'conv_11_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on orbital perihelion distance to Sun.' },
    'conv_11_turn_03': { action: 'carry', rationale: 'Physical property follow-up on surface temperature swings.' },
    'conv_11_turn_04': { action: 'entity_switch', rationale: 'Pivots from astronomical planet to toxic heavy metal element while retaining lexical term "mercury".' },
    'conv_11_turn_05': { action: 'carry', rationale: 'Target organ damage follow-up on toxic heavy metal mercury.' },

    // conv_12: Neural Transformers vs Electrical Power Transformers (Polysemy Ambiguity)
    'conv_12_turn_01': { action: 'carry', rationale: 'Initial turn establishes Transformer neural network architecture.' },
    'conv_12_turn_02': { action: 'carry', rationale: 'Sub-mechanism follow-up on multi-head attention.' },
    'conv_12_turn_03': { action: 'carry', rationale: 'Pronoun/aspect follow-up on positional encodings.' },
    'conv_12_turn_04': { action: 'entity_switch', rationale: 'Pivots from neural network architecture to electrical power transformer while retaining lexical term "transformer".' },
    'conv_12_turn_05': { action: 'carry', rationale: 'Pronoun follow-up on electrical transformer magnetic core materials.' },

    // conv_13: Artificial vs Biological Neural Networks
    'conv_13_turn_01': { action: 'carry', rationale: 'Initial turn establishes comparative neural network inquiry.' },
    'conv_13_turn_02': { action: 'carry', rationale: 'Training mechanism follow-up on backpropagation.' },
    'conv_13_turn_03': { action: 'carry', rationale: 'Pronoun follow-up on biological plausibility debate.' },
    'conv_13_turn_04': { action: 'carry', rationale: 'Comparative follow-up on synaptic plasticity vs gradient descent.' },
    'conv_13_turn_05': { action: 'carry', rationale: 'Mechanistic follow-up on spike-timing-dependent plasticity (STDP).' },

    // conv_14: Shannon Information Entropy to Thermodynamic Law
    'conv_14_turn_01': { action: 'carry', rationale: 'Initial turn establishes Claude Shannon information entropy.' },
    'conv_14_turn_02': { action: 'carry', rationale: 'Pronoun follow-up on base-2 logarithm for bits.' },
    'conv_14_turn_03': { action: 'carry', rationale: 'Bridge follow-up connecting informational entropy to statistical physics.' },
    'conv_14_turn_04': { action: 'carry', rationale: 'Physical law follow-up on entropy non-conservation.' },
    'conv_14_turn_05': { action: 'carry', rationale: 'Pronoun follow-up on the second law of thermodynamics.' }
  };

  // 1. Export to eval/output/expected_action_llm.csv
  const csvHeaders = ['conversationId', 'turnIndex', 'turnId', 'queryId', 'split', 'query', 'expectedAction', 'rationale'];
  function escapeCsv(val) {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  const csvRows = [csvHeaders.join(',')];
  const allRows = [];

  for (const conv of conversations) {
    const splitName = devConvIds.has(conv.id) ? 'dev' : 'test';
    conv.turns.forEach((turn, idx) => {
      const turnIndex = idx + 1;
      const queryId = `${conv.id}_${turn.turnId}`;
      const labelObj = expectedLabels[queryId] || { action: 'carry', rationale: 'Conversational follow-up.' };

      allRows.push({
        conversationId: conv.id,
        turnIndex,
        turnId: turn.turnId,
        queryId,
        split: splitName,
        query: turn.query,
        expectedAction: labelObj.action,
        rationale: labelObj.rationale
      });

      csvRows.push([
        conv.id,
        turnIndex,
        turn.turnId,
        queryId,
        splitName,
        escapeCsv(turn.query),
        labelObj.action,
        escapeCsv(labelObj.rationale)
      ].join(','));
    });
  }

  const outCsvPath = path.join(rootDir, 'eval/output/expected_action_llm.csv');
  fs.writeFileSync(outCsvPath, csvRows.join('\n'), 'utf-8');
  console.log(`Saved 70 expectedAction labels to: ${outCsvPath}`);

  // 2. Import expectedAction into data/conversations.json
  for (const conv of conversations) {
    conv.turns.forEach(turn => {
      const queryId = `${conv.id}_${turn.turnId}`;
      if (expectedLabels[queryId]) {
        turn.expectedAction = expectedLabels[queryId].action;
      }
    });
  }
  fs.writeFileSync(convsPath, JSON.stringify(conversations, null, 2), 'utf-8');
  console.log(`Imported expectedAction into: ${convsPath}`);

  // 4.2 Label Counts Report
  console.log('\n--- 4.2 LABEL COUNTS REPORT ---');
  const countStats = {
    overall: { carry: 0, reset: 0, entity_switch: 0, total: 0 },
    dev: { carry: 0, reset: 0, entity_switch: 0, total: 0 },
    test: { carry: 0, reset: 0, entity_switch: 0, total: 0 },
    devMultiTurn: { carry: 0, reset: 0, entity_switch: 0, total: 0 },
    testMultiTurn: { carry: 0, reset: 0, entity_switch: 0, total: 0 }
  };

  allRows.forEach(r => {
    countStats.overall[r.expectedAction]++;
    countStats.overall.total++;
    countStats[r.split][r.expectedAction]++;
    countStats[r.split].total++;

    if (r.turnIndex > 1) {
      if (r.split === 'dev') {
        countStats.devMultiTurn[r.expectedAction]++;
        countStats.devMultiTurn.total++;
      } else {
        countStats.testMultiTurn[r.expectedAction]++;
        countStats.testMultiTurn.total++;
      }
    }
  });

  console.log(`Overall (All 70 Turns):`);
  console.log(`  - carry:         ${countStats.overall.carry}`);
  console.log(`  - reset:         ${countStats.overall.reset}`);
  console.log(`  - entity_switch: ${countStats.overall.entity_switch}`);
  console.log(`  - Total:         ${countStats.overall.total}`);

  console.log(`\nPer Split Breakdown:`);
  console.log(`  - DEV  (30 turns total): carry=${countStats.dev.carry}, reset=${countStats.dev.reset}, entity_switch=${countStats.dev.entity_switch}`);
  console.log(`  - TEST (40 turns total): carry=${countStats.test.carry}, reset=${countStats.test.reset}, entity_switch=${countStats.test.entity_switch}`);

  console.log(`\nMulti-Turn Transitions Only (Excluding Turn 1):`);
  console.log(`  - DEV Multi-Turn (24 transitions):  carry=${countStats.devMultiTurn.carry}, reset=${countStats.devMultiTurn.reset}, entity_switch=${countStats.devMultiTurn.entity_switch}`);
  console.log(`  - TEST Multi-Turn (32 transitions): carry=${countStats.testMultiTurn.carry}, reset=${countStats.testMultiTurn.reset}, entity_switch=${countStats.testMultiTurn.entity_switch}`);

  // 4.3 Decision Metrics on DEV Split
  console.log('\n--- 4.3 DECISION METRICS ON DEV SPLIT (24 Multi-Turn Transitions) ---');
  const index = loadIndex(CONFIG.paths.indexFile);

  // Evaluate Legacy Cosine Detector on DEV
  const legacyDevRecords = [];
  // Evaluate New Decision Detector on DEV
  const newDevRecords = [];

  for (const conv of conversations) {
    if (!devConvIds.has(conv.id)) continue;

    // Simulation for Legacy Detector
    const legacyContext = new ContextState({ mode: 'v1' });
    // Simulation for New Detector
    const newContext = new ContextState({ mode: 'v2' });

    for (let t = 0; t < conv.turns.length; t++) {
      const turn = conv.turns[t];
      const queryId = `${conv.id}_${turn.turnId}`;
      const expected = turn.expectedAction;

      // 1. Legacy detector
      const legacyDecision = detectTopicShift(turn.query, legacyContext.getVector(), index);
      // Legacy updates context
      legacyContext.update(turn.query, [{ docId: 'dummy' }], index);

      // 2. New decision detector
      const lockedEntities = newContext.getLockedEntities();
      const newDecision = detectConversationalDecision(turn.query, lockedEntities, newContext.getAllContextTerms(), index);
      // New updates context
      newContext.updateV2({
        decision: newDecision.decision,
        rawQuery: turn.query,
        entityCandidates: newDecision.entityCandidates,
        aspectCandidates: []
      });

      // Exclude Turn 1 from decision classification metrics
      if (t > 0) {
        legacyDevRecords.push({
          queryId,
          predicted: legacyDecision.decision.toLowerCase(),
          expected
        });
        newDevRecords.push({
          queryId,
          predicted: newDecision.decision.toLowerCase(),
          expected
        });
      }
    }
  }

  const legacyDevEval = evaluateDecisionClassification(legacyDevRecords);
  const newDevEval = evaluateDecisionClassification(newDevRecords);

  console.log('\n[1] LEGACY COSINE DETECTOR (DEV Split, n=24):');
  console.log(`- Accuracy: ${legacyDevEval.accuracy}`);
  console.log(`- Macro F1: ${legacyDevEval.macroF1}`);
  console.log(`- Per-Class Metrics:`);
  for (const [cls, m] of Object.entries(legacyDevEval.perClass)) {
    console.log(`    ${cls.padEnd(14)}: Precision=${m.precision.toFixed(4)}, Recall=${m.recall.toFixed(4)}, F1=${m.f1.toFixed(4)}, Support=${m.support}`);
  }
  console.log(`- Confusion Matrix [expected][predicted]:`);
  console.log(JSON.stringify(legacyDevEval.confusionMatrix, null, 2));

  console.log('\n[2] NEW DECISION DETECTOR (DEV Split, n=24):');
  console.log(`- Accuracy: ${newDevEval.accuracy}`);
  console.log(`- Macro F1: ${newDevEval.macroF1}`);
  console.log(`- Per-Class Metrics:`);
  for (const [cls, m] of Object.entries(newDevEval.perClass)) {
    console.log(`    ${cls.padEnd(14)}: Precision=${m.precision.toFixed(4)}, Recall=${m.recall.toFixed(4)}, F1=${m.f1.toFixed(4)}, Support=${m.support}`);
  }
  console.log(`- Confusion Matrix [expected][predicted]:`);
  console.log(JSON.stringify(newDevEval.confusionMatrix, null, 2));

  // TEST Aggregate Counts at this stage
  console.log('\n--- TEST SPLIT AGGREGATE COUNTS ONLY (n=32 Multi-Turn Transitions) ---');
  console.log(`Expected Labels on TEST: carry=${countStats.testMultiTurn.carry}, reset=${countStats.testMultiTurn.reset}, entity_switch=${countStats.testMultiTurn.entity_switch}`);
  console.log(`(Per rule 4.3, TEST decision performance evaluation is reserved strictly for Phase 6 TEST run).`);

  return {
    countStats,
    legacyDevEval,
    newDevEval
  };
}

if (process.argv[1] && process.argv[1].endsWith('labelExpectedActions.js')) {
  runExpectedActionLabeling();
}
