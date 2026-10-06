/**
 * @file server/test/api.test.js
 * @description Unit and Integration tests for TurnTrace Express REST API.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/api/server.js';

describe('Express REST API Endpoints', () => {
  let server;
  let port = 3099;
  let baseUrl = `http://127.0.0.1:${port}`;

  before(async () => {
    await new Promise(resolve => {
      server = app.listen(port, resolve);
    });
  });

  after(async () => {
    await new Promise(resolve => {
      server.close(resolve);
    });
  });

  it('GET /api/health returns ok status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  it('GET /api/stats returns index metadata', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.metadata);
    assert.ok(data.metadata.totalDocs > 0);
  });

  it('POST /api/chat returns ranked results and full inspectable trace', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is the vector space model?',
        sessionId: 'test_session_1'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.results.length > 0);
    assert.ok(data.trace);
    assert.equal(data.trace.turn, 1);
    assert.ok(data.trace.shiftDecision);
    assert.ok(data.trace.timings);
  });

  it('POST /api/reset resets session context', async () => {
    const res = await fetch(`${baseUrl}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'test_session_1' })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
  });

  it('GET /api/conversations returns benchmark dialogues', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    assert.ok(data[0].turns.length > 0);
  });

  it('POST /api/chat supports model, lockMode, and seenPenalty options', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is Okapi BM25?',
        sessionId: 'test_session_2',
        model: 'bm25',
        lockMode: 'soft',
        applySeenPenalty: true
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.trace.retrievalExecution.model, 'bm25');
    assert.equal(data.trace.seenPassagePenalty.enabled, true);
  });
});
