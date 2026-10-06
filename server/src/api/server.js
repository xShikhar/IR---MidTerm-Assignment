/**
 * @file server/src/api/server.js
 * @description Express REST API for TurnTrace.
 * Exposes inspectable conversational search endpoints with session context management.
 */

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { loadIndex } from '../index/serializer.js';
import { ContextState } from '../conversation/contextState.js';
import { SeenPassageTracker } from '../retrieval/seenPenalty.js';
import { executeConversationalTurn } from './traceAssembly.js';
import { CONFIG } from '../config/index.js';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory active session stores: sessionId -> ContextState
const SESSIONS = new Map();

let index = null;

// Initialize index in memory
try {
  index = loadIndex(CONFIG.paths.indexFile);
  console.log(`[TurnTrace Server] Loaded inverted index: ${index.metadata.totalDocs} docs, ${index.metadata.vocabularySize} terms.`);
} catch (err) {
  console.warn(`[TurnTrace Server] Index not preloaded: ${err.message}. Run 'npm run build:index' to generate.`);
}

/**
 * Helper to retrieve or create session context.
 */
function getSessionContext(sessionId = 'default') {
  if (!SESSIONS.has(sessionId)) {
    const ctx = new ContextState();
    ctx.seenTracker = new SeenPassageTracker();
    SESSIONS.set(sessionId, ctx);
  }
  return SESSIONS.get(sessionId);
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    indexLoaded: index !== null,
    totalDocs: index?.metadata?.totalDocs || 0
  });
});

// 2. Collection and Index Statistics
app.get('/api/stats', (req, res) => {
  if (!index) {
    return res.status(503).json({ error: 'Index not loaded. Run npm run build:index.' });
  }
  res.json({
    metadata: index.metadata,
    domains: {
      cs_ai: 9222,
      space_physics: 9266,
      history_civilization: 9081,
      biology_medicine: 7431
    },
    config: {
      scoringModel: 'SMART lnc.ltc Cosine with length normalization',
      decayLambda: CONFIG.conversation.context.decayLambda,
      shiftCosineThreshold: CONFIG.conversation.shift.cosineThreshold,
      topK: CONFIG.retrieval.topK,
      topMExpansionTerms: CONFIG.conversation.rewriter.topMExpansionTerms,
      zones: CONFIG.retrieval.zones,
      bm25: CONFIG.retrieval.bm25,
      novelty: CONFIG.novelty
    }
  });
});

// 3. Reset Session Context
app.post('/api/reset', (req, res) => {
  const sessionId = req.body?.sessionId || 'default';
  if (SESSIONS.has(sessionId)) {
    const ctx = SESSIONS.get(sessionId);
    ctx.reset();
    ctx.seenTracker?.reset();
  }
  res.json({ success: true, message: `Context for session '${sessionId}' reset successfully.` });
});

// 4. Conversational Search Turn
app.post('/api/chat', async (req, res) => {
  const {
    query,
    sessionId = 'default',
    reset = false,
    useChampionLists,
    applyIndexElimination,
    model,
    lockMode,
    applySeenPenalty
  } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Field "query" is required and must be non-empty.' });
  }

  if (!index) {
    return res.status(503).json({ error: 'Inverted index not ready. Please run npm run build:index.' });
  }

  const contextState = getSessionContext(sessionId);
  if (reset) {
    contextState.reset();
  }

  try {
    const response = await executeConversationalTurn(query.trim(), contextState, index, {
      useChampionLists,
      applyIndexElimination,
      model,
      lockMode,
      applySeenPenalty
    });
    res.json(response);
  } catch (err) {
    console.error('[TurnTrace Server Error]', err);
    res.status(500).json({ error: 'Internal retrieval error', details: err.message });
  }
});

// 5. Benchmark Dialogue Scenarios
app.get('/api/conversations', (req, res) => {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf8'));
    const sanitized = raw.map(c => ({
      id: c.id,
      domain: c.domain,
      turns: (c.turns || []).map(t => ({ turnId: t.turnId, query: t.query }))
    }));
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load benchmark conversations', details: err.message });
  }
});

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const port = CONFIG.server.port;
  app.listen(port, () => {
    console.log(`[TurnTrace Server] API listening at http://localhost:${port}`);
  });
}

export default app;
