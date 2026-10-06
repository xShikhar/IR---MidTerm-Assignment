/**
 * @file client/src/App.jsx
 * @description TurnTrace React Frontend.
 * Exposes conversational retrieval dialogue alongside an unredacted
 * per-turn Information Retrieval Trace Inspector.
 */

import React, { useState, useEffect, useRef } from 'react';

const QUICK_PROMPTS = [
  'What is the vector space model in information retrieval?',
  'How does term frequency weighting work in it?',
  'What about cosine normalization?',
  'Compare it with Okapi BM25.',
  'Now what is NASA Artemis program?',
  'Tell me about mercury toxicity and environmental exposure.',
  'Who painted the Mona Lisa?'
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTrace, setActiveTrace] = useState(null);
  const [stats, setStats] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => console.log('Stats unavailable'));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (queryToSend = inputText) => {
    const q = (queryToSend || '').trim();
    if (!q || isLoading) return;

    setInputText('');
    setIsLoading(true);

    const userMessage = { role: 'user', content: q };
    setMessages(prev => [...prev, userMessage]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, sessionId: 'live_demo' })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const engineMessage = {
        role: 'engine',
        results: data.results,
        trace: data.trace
      };

      setMessages(prev => [...prev, engineMessage]);
      setActiveTrace(data.trace);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'engine',
          results: [],
          trace: null,
          error: `Error communicating with retrieval backend: ${err.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'live_demo' })
    });
    setMessages([]);
    setActiveTrace(null);
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="header">
        <div className="header-brand">
          <span className="logo-badge">TurnTrace</span>
          <span className="header-title">Inspectable Conversational Search</span>
          <span className="header-meta">CSD358 Track T2 | Pure IR Core</span>
        </div>
        <div className="header-actions">
          {stats && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Corpus: {stats.metadata?.totalDocs?.toLocaleString()} docs | {stats.metadata?.vocabularySize?.toLocaleString()} stems
            </span>
          )}
          <button className="btn-secondary" onClick={handleReset} title="Reset conversational history and term weights">
            Reset Context
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="main-content">
        {/* Left: Chat & Results Pane */}
        <div className="chat-panel">
          <div className="chat-history">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: '40px', color: '#94a3b8' }}>
                <h3 style={{ color: '#f8fafc', marginBottom: '8px' }}>Welcome to TurnTrace</h3>
                <p style={{ maxWidth: '520px', margin: '0 auto', fontSize: '13px' }}>
                  Ask conversational questions across computer science, space physics, biology, and history.
                  Inspect the right panel to observe how topic-shift detection, decayed term weights, and scoring breakdowns function at every turn.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`message-item ${msg.role === 'user' ? 'message-user' : 'message-engine'}`}>
                {msg.role === 'user' ? (
                  <div>{msg.content}</div>
                ) : (
                  <div>
                    {msg.error && (
                      <div style={{ color: '#f43f5e', fontSize: '13px' }}>{msg.error}</div>
                    )}

                    {msg.trace?.clarification?.fired && (
                      <div className="clarification-banner">
                        <span>⚠️ <strong>Ambiguity Clarification Triggered:</strong></span>
                        <span>{msg.trace.clarification.clarifyingQuestion}</span>
                      </div>
                    )}

                    <div className="results-list">
                      {msg.results.map((doc, rIdx) => (
                        <div
                          key={doc.docId}
                          className="result-card"
                          onClick={() => msg.trace && setActiveTrace(msg.trace)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="result-card-header">
                            <div className="result-rank-score">
                              <span className="rank-badge">#{rIdx + 1}</span>
                              <span className="score-badge">Score: {doc.score.toFixed(4)}</span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>({doc.docId})</span>
                            </div>
                            <span className="domain-tag">{doc.domain}</span>
                          </div>
                          <div className="result-title">{doc.title}</div>
                          <div className="result-body">{doc.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Query Input Bar */}
          <div className="chat-input-bar">
            <div className="quick-prompts">
              {QUICK_PROMPTS.map((p, pIdx) => (
                <button key={pIdx} className="chip-btn" onClick={() => handleSend(p)}>
                  {p}
                </button>
              ))}
            </div>
            <form
              className="input-row"
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                type="text"
                className="search-input"
                placeholder="Ask a conversational search question..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" className="btn-primary" disabled={isLoading || !inputText.trim()}>
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Trace Inspector Pane */}
        <div className="trace-panel">
          <div className="trace-panel-title">
            <span>Information Retrieval Trace</span>
            {activeTrace && <span className="turn-pill">Turn {activeTrace.turn}</span>}
          </div>

          {!activeTrace ? (
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '20px' }}>
              Run a conversational search query to inspect real-time postings, weights, topic-shift decisions, and score breakdowns.
            </div>
          ) : (
            <>
              {/* Timings Section */}
              <div className="trace-section">
                <div className="trace-section-header">1. Latency Breakdown</div>
                <div className="timing-grid">
                  <div className="timing-item">
                    <span>Lexical:</span>
                    <span className="timing-val">{activeTrace.timings.lexicalAnalysisMs} ms</span>
                  </div>
                  <div className="timing-item">
                    <span>Topic Shift:</span>
                    <span className="timing-val">{activeTrace.timings.topicShiftMs} ms</span>
                  </div>
                  <div className="timing-item">
                    <span>Rewriting:</span>
                    <span className="timing-val">{activeTrace.timings.rewritingMs} ms</span>
                  </div>
                  <div className="timing-item">
                    <span>Retrieval & Fusion:</span>
                    <span className="timing-val">{activeTrace.timings.retrievalAndFusionMs} ms</span>
                  </div>
                  <div className="timing-item" style={{ gridColumn: 'span 2' }}>
                    <span>Total Turn Latency:</span>
                    <span className="timing-val" style={{ color: '#60a5fa' }}>{activeTrace.timings.totalLatencyMs} ms</span>
                  </div>
                </div>
              </div>

              {/* Topic Shift Detector */}
              <div className="trace-section">
                <div className="trace-section-header">2. Topic Shift Detector</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Decision:</span>
                  <span className={activeTrace.shiftDecision.decision === 'CARRY' ? 'badge-carry' : 'badge-reset'}>
                    {activeTrace.shiftDecision.decision}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                  Cosine: <strong style={{ color: '#f8fafc' }}>{activeTrace.shiftDecision.cosineSimilarity}</strong> (Threshold: {activeTrace.shiftDecision.threshold})
                </div>
                <div style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>
                  Reason: {activeTrace.shiftDecision.reason}
                </div>
              </div>

              {/* Query Rewriter with Provenance */}
              <div className="trace-section">
                <div className="trace-section-header">3. Query Rewriting & Provenance</div>
                <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                  Mode: <strong style={{ color: '#38bdf8' }}>{activeTrace.rewriter.mode}</strong>
                </div>
                <div className="code-box" style={{ marginBottom: '8px' }}>
                  {activeTrace.rewriter.rewrittenQuery}
                </div>
                {activeTrace.rewriter.addedTerms?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Added Context Terms:</div>
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Term</th>
                          <th>Source Turn</th>
                          <th>Raw Wt</th>
                          <th>Effective Wt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTrace.rewriter.addedTerms.map((t, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#38bdf8' }}>{t.term}</td>
                            <td>Turn {t.sourceTurn}</td>
                            <td>{t.rawWeight}</td>
                            <td style={{ color: '#34d399' }}>{t.currentWeight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Decayed Context Vector */}
              <div className="trace-section">
                <div className="trace-section-header">4. Context State (Decayed Weights)</div>
                {activeTrace.contextTerms?.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Context vector is empty.</div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Stem</th>
                          <th>Origin</th>
                          <th>Age</th>
                          <th>Decay λ^t</th>
                          <th>Current Wt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTrace.contextTerms.slice(0, 8).map((t, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#e2e8f0', fontWeight: '500' }}>{t.term}</td>
                            <td>{t.sourceType}</td>
                            <td>{t.age}</td>
                            <td>{t.decayFactor.toFixed(3)}</td>
                            <td style={{ color: '#10b981', fontFamily: 'monospace' }}>{t.currentWeight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Postings Statistics */}
              <div className="trace-section">
                <div className="trace-section-header">5. Postings Statistics Used</div>
                <table className="trace-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Doc Freq (df)</th>
                      <th>lnc.ltc IDF</th>
                      <th>BM25 IDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrace.postingsUsed.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ color: '#a78bfa' }}>{p.term}</td>
                        <td>{p.df.toLocaleString()}</td>
                        <td style={{ fontFamily: 'monospace' }}>{p.idf}</td>
                        <td style={{ fontFamily: 'monospace' }}>{p.bm25Idf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sub-Query Decomposition */}
              {activeTrace.decomposition?.isDecomposed && (
                <div className="trace-section">
                  <div className="trace-section-header">6. Multi-Part Decomposition & Fusion</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Sub-Queries Evaluated:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {activeTrace.decomposition.subQueries.map((sq, idx) => (
                      <div key={idx} className="code-box">
                        <span style={{ color: '#38bdf8' }}>[{sq.type}]</span> {sq.subQuery} ({sq.returnedCount} results)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
