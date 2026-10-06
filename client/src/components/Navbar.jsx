import React from 'react';

export default function Navbar({
  stats,
  isOnline,
  onOpenBenchmarks,
  onOpenStats,
  onResetSession,
  activeScenario
}) {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="logo-badge-container">
          <span className="logo-icon">⚡</span>
          <span className="logo-badge">TurnTrace</span>
        </div>
        <div className="header-titles">
          <div className="header-title-row">
            <span className="header-title">Inspectable Conversational Search</span>
            <span className="tag-pure-ir">100% Native IR Core</span>
          </div>
          <span className="header-meta">CSD358 Hackathon Track T2 | Zero External LLM or Vector DB</span>
        </div>
      </div>

      <div className="header-center-info">
        {activeScenario ? (
          <div className="active-scenario-chip">
            <span className="scenario-dot" />
            <span className="scenario-label">Active Scenario:</span>
            <span className="scenario-name">{activeScenario.title || activeScenario.id}</span>
          </div>
        ) : (
          <div className="status-indicator-chip">
            <span className={`status-dot ${isOnline ? 'dot-online' : 'dot-offline'}`} />
            <span className="status-text">
              {isOnline ? 'Engine Online (35,000 Passages)' : 'Connecting to Server...'}
            </span>
          </div>
        )}
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="btn-header btn-benchmarks"
          onClick={onOpenBenchmarks}
          title="Open benchmark dialogue scenarios (JWST, Transformers, Alan Turing, etc.)"
        >
          <span className="btn-icon">📚</span>
          <span>Benchmark Scenarios (14)</span>
        </button>

        <button
          type="button"
          className="btn-header btn-stats"
          onClick={onOpenStats}
          title="Inspect collection statistics, vocabulary size, and domain distribution"
        >
          <span className="btn-icon">📊</span>
          <span>Corpus Stats</span>
        </button>

        <button
          type="button"
          className="btn-header btn-reset"
          onClick={onResetSession}
          title="Reset conversational history, entity locks, and seen documents"
        >
          <span className="btn-icon">🔄</span>
          <span>Reset Context</span>
        </button>
      </div>
    </header>
  );
}
