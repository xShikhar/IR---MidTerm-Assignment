/**
 * @file eval/src/metrics/decisionClassification.js
 * @description Evaluates transition decision classifier against human gold expectedAction labels.
 * Computes precision, recall, F1, macro-F1, and confusion matrix across:
 * - 'carry'
 * - 'entity_switch'
 * - 'reset'
 * Only computes metrics on labeled turns; discloses labeled vs total turns count.
 */

const CLASSES = ['carry', 'entity_switch', 'reset'];

/**
 * Normalizes action strings to lowercase standard labels.
 */
function normalizeAction(str) {
  const s = String(str || '').trim().toLowerCase();
  if (s === 'carry') return 'carry';
  if (s === 'entity_switch' || s === 'switch') return 'entity_switch';
  if (s === 'reset') return 'reset';
  return '';
}

/**
 * Computes classification metrics on labeled turns.
 *
 * @param {Array<{ queryId: string, predicted: string, expected: string }>} records
 * @returns {{
 *   labeledCount: number,
 *   totalCount: number,
 *   accuracy: number,
 *   macroF1: number,
 *   perClass: Record<string, { precision: number, recall: number, f1: number, support: number }>,
 *   confusionMatrix: Record<string, Record<string, number>>
 * }}
 */
export function evaluateDecisionClassification(records = []) {
  const totalCount = records.length;
  const labeled = records
    .map(r => ({
      queryId: r.queryId,
      predicted: normalizeAction(r.predicted),
      expected: normalizeAction(r.expected)
    }))
    .filter(r => r.expected !== '');

  const labeledCount = labeled.length;

  // Initialize confusion matrix: [expected][predicted]
  const confusionMatrix = {};
  for (const exp of CLASSES) {
    confusionMatrix[exp] = {};
    for (const pred of CLASSES) {
      confusionMatrix[exp][pred] = 0;
    }
  }

  if (labeledCount === 0) {
    return {
      labeledCount: 0,
      totalCount,
      accuracy: 0.0,
      macroF1: 0.0,
      perClass: {
        carry: { precision: 0, recall: 0, f1: 0, support: 0 },
        entity_switch: { precision: 0, recall: 0, f1: 0, support: 0 },
        reset: { precision: 0, recall: 0, f1: 0, support: 0 }
      },
      confusionMatrix
    };
  }

  let correctCount = 0;
  for (const r of labeled) {
    if (CLASSES.includes(r.expected) && CLASSES.includes(r.predicted)) {
      confusionMatrix[r.expected][r.predicted]++;
    }
    if (r.predicted === r.expected) {
      correctCount++;
    }
  }

  const perClass = {};
  let f1Sum = 0;
  let activeClasses = 0;

  for (const cls of CLASSES) {
    const tp = confusionMatrix[cls][cls] || 0;
    const fp = CLASSES.reduce((sum, c) => c !== cls ? sum + (confusionMatrix[c][cls] || 0) : sum, 0);
    const fn = CLASSES.reduce((sum, c) => c !== cls ? sum + (confusionMatrix[cls][c] || 0) : sum, 0);
    const support = tp + fn;

    const precision = (tp + fp) > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0.0;
    const recall = (tp + fn) > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0.0;
    const f1 = (precision + recall) > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0.0;

    perClass[cls] = { precision, recall, f1, support };

    if (support > 0) {
      f1Sum += f1;
      activeClasses++;
    }
  }

  const accuracy = Number((correctCount / labeledCount).toFixed(4));
  const macroF1 = activeClasses > 0 ? Number((f1Sum / activeClasses).toFixed(4)) : 0.0;

  return {
    labeledCount,
    totalCount,
    accuracy,
    macroF1,
    perClass,
    confusionMatrix
  };
}
