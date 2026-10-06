import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCompleteness, computeCohenKappa } from '../src/qrelsLoader.js';

describe('Evaluation Engine: Qrels Loader & Inter-Annotator Agreement', () => {
  const dummyConversations = [
    {
      id: 'conv_01',
      turns: [{ turnId: 'turn_01' }, { turnId: 'turn_02' }]
    },
    {
      id: 'conv_02',
      turns: [{ turnId: 'turn_01' }]
    }
  ];

  it('validates incomplete qrels correctly', () => {
    const incompleteQrels = {
      conv_01_turn_01: { doc_00001: 2 }
    };
    const res = validateCompleteness(dummyConversations, incompleteQrels);
    assert.equal(res.isComplete, false);
    assert.equal(res.totalTurns, 3);
    assert.equal(res.judgedTurnsCount, 1);
    assert.deepEqual(res.missingTurns, ['conv_01_turn_02', 'conv_02_turn_01']);
  });

  it('validates complete qrels correctly', () => {
    const completeQrels = {
      conv_01_turn_01: { doc_00001: 2 },
      conv_01_turn_02: { doc_00002: 1 },
      conv_02_turn_01: { doc_00003: 2 }
    };
    const res = validateCompleteness(dummyConversations, completeQrels);
    assert.equal(res.isComplete, true);
    assert.equal(res.judgedTurnsCount, 3);
    assert.equal(res.missingTurns.length, 0);
  });

  it('computes Cohen\'s Kappa on overlapping judge annotations', () => {
    // 10 shared items
    // Judge A: [2, 2, 2, 1, 1, 1, 0, 0, 0, 0]
    // Judge B: [2, 2, 1, 1, 1, 0, 0, 0, 0, 0]
    const judgeA = {
      't1_d1': 2, 't1_d2': 2, 't1_d3': 2,
      't1_d4': 1, 't1_d5': 1, 't1_d6': 1,
      't1_d7': 0, 't1_d8': 0, 't1_d9': 0, 't1_d10': 0
    };
    const judgeB = {
      't1_d1': 2, 't1_d2': 2, 't1_d3': 1,
      't1_d4': 1, 't1_d5': 1, 't1_d6': 0,
      't1_d7': 0, 't1_d8': 0, 't1_d9': 0, 't1_d10': 0
    };

    const res = computeCohenKappa(judgeA, judgeB);
    assert.equal(res.n, 10);
    assert.equal(res.observedAgreement, 0.8); // 8 out of 10 match
    assert.ok(res.kappa > 0.6); // substantial agreement
    assert.ok(res.kappa <= 1.0);
  });

  it('returns kappa = 1 for identical judgments', () => {
    const judgeA = { 't1_d1': 2, 't1_d2': 0 };
    const judgeB = { 't1_d1': 2, 't1_d2': 0 };
    const res = computeCohenKappa(judgeA, judgeB);
    assert.equal(res.kappa, 1.0);
    assert.equal(res.observedAgreement, 1.0);
  });
});
