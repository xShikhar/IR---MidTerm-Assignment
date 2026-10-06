import React, { useRef, useEffect } from 'react';
import ResultCard from './ResultCard';

export default function ChatPanel({
  messages,
  inputText,
  setInputText,
  isLoading,
  onSend,
  onInspectScore,
  onSelectTurnTrace,
  quickPrompts,
  activeScenario,
  scenarioNextTurn
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-panel">
      <div className="chat-history">
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="chat-empty-state">
            <div className="empty-state-badge">Conversational Search Engine</div>
            <h2 className="empty-state-title">Welcome to TurnTrace</h2>
            <p className="empty-state-desc">
              Ask natural conversational questions across Computer Science, Space Physics, Biology, and History.
              Inspect the right panel to observe real-time decision guards, entity locks, term provenance, and mathematical score breakdowns.
            </p>

            <div className="empty-quickstart-grid">
              <div
                className="quickstart-card"
                onClick={() => onSend('What is the James Webb Space Telescope?')}
              >
                <span className="qs-icon">🔭</span>
                <div className="qs-text">
                  <div className="qs-title">James Webb Space Telescope</div>
                  <div className="qs-sub">Test anaphoric follow-ups & aspect pivots</div>
                </div>
              </div>

              <div
                className="quickstart-card"
                onClick={() => onSend('How does the Transformer architecture use self-attention?')}
              >
                <span className="qs-icon">🤖</span>
                <div className="qs-text">
                  <div className="qs-title">Transformer Architecture</div>
                  <div className="qs-sub">Test lexical polysemy & power transformers</div>
                </div>
              </div>

              <div
                className="quickstart-card"
                onClick={() => onSend('What is the vector space model in information retrieval?')}
              >
                <span className="qs-icon">📐</span>
                <div className="qs-text">
                  <div className="qs-title">Vector Space Model</div>
                  <div className="qs-sub">Compare lnc.ltc with Okapi BM25 ranking</div>
                </div>
              </div>

              <div
                className="quickstart-card"
                onClick={() => onSend('What was Alan Turing formulation of the imitation game?')}
              >
                <span className="qs-icon">🧠</span>
                <div className="qs-text">
                  <div className="qs-title">Alan Turing & Black Holes</div>
                  <div className="qs-sub">Observe conversational topic shift detection</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Message Stream */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-item ${msg.role === 'user' ? 'message-user' : 'message-engine'}`}>
            {msg.role === 'user' ? (
              <div className="user-bubble">
                <span className="user-icon">👤</span>
                <span className="user-text">{msg.content}</span>
              </div>
            ) : (
              <div className="engine-turn-container">
                {/* Error Banner */}
                {msg.error && (
                  <div className="engine-error-banner">
                    <span>⚠️ {msg.error}</span>
                  </div>
                )}

                {/* Clarification Alert */}
                {msg.trace?.clarification?.fired && (
                  <div className="clarification-banner">
                    <div className="clarification-icon">💡</div>
                    <div className="clarification-text-wrap">
                      <span className="clarification-title">Ambiguity Clarification Triggered:</span>
                      <span className="clarification-q">{msg.trace.clarification.clarifyingQuestion}</span>
                    </div>
                  </div>
                )}

                {/* Conversational Query Rewrite Pill */}
                {msg.trace?.rewriter && (
                  <div className="rewrite-summary-bar" onClick={() => onSelectTurnTrace(msg.trace)}>
                    <div className="rewrite-summary-left">
                      <span className="rewrite-icon">🔄</span>
                      <span className="rewrite-label">Rewritten Query:</span>
                      <span className="rewrite-query-str">"{msg.trace.rewriter.rewrittenQuery}"</span>
                    </div>
                    <span className="rewrite-trace-action">Inspect Turn #{msg.trace.turn} Trace →</span>
                  </div>
                )}

                {/* Ranked Results List */}
                <div className="results-list">
                  {(msg.results || []).map((doc, rIdx) => (
                    <ResultCard
                      key={doc.docId || rIdx}
                      doc={doc}
                      rank={rIdx + 1}
                      onInspectScore={onInspectScore}
                      onCardClick={() => msg.trace && onSelectTurnTrace(msg.trace)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading State Skeletons */}
        {isLoading && (
          <div className="message-item message-engine">
            <div className="loading-turn-banner">
              <span className="loading-spinner-ring" />
              <span className="loading-status-text">
                Executing native IR retrieval pipeline (normalizing → decision guards → index scoring → trace)...
              </span>
            </div>

            <div className="skeleton-cards-container">
              <div className="skeleton-card">
                <div className="skeleton-line skeleton-header" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-body" />
                <div className="skeleton-line skeleton-body short" />
              </div>
              <div className="skeleton-card">
                <div className="skeleton-line skeleton-header" />
                <div className="skeleton-line skeleton-title" />
                <div className="skeleton-line skeleton-body" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Search Input Bar */}
      <div className="chat-input-bar">
        {/* Next Scenario Turn or Quick Prompts */}
        <div className="quick-prompts">
          {scenarioNextTurn ? (
            <div className="scenario-next-suggestion">
              <span className="scenario-hint-label">Next Scenario Turn ({scenarioNextTurn.turnId}):</span>
              <button
                type="button"
                className="chip-btn chip-highlight"
                onClick={() => onSend(scenarioNextTurn.query)}
              >
                "{scenarioNextTurn.query}" →
              </button>
            </div>
          ) : (
            quickPrompts.map((p, pIdx) => (
              <button
                key={pIdx}
                type="button"
                className="chip-btn"
                onClick={() => onSend(p)}
              >
                {p}
              </button>
            ))
          )}
        </div>

        <form
          className="input-row"
          onSubmit={e => {
            e.preventDefault();
            onSend();
          }}
        >
          <input
            type="text"
            className="search-input"
            placeholder="Ask a conversational search question (e.g., 'What is its orbit located in space?')..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>
    </div>
  );
}
