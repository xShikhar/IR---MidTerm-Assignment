import React from 'react';

export default function StatsModal({ isOpen, onClose, stats }) {
  if (!isOpen) return null;

  const metadata = stats?.metadata || {
    totalDocs: 35000,
    avgDocLength: 83.58,
    vocabularySize: 80684,
    totalPostings: 1489533
  };

  const domains = stats?.domains || {
    cs_ai: 9222,
    space_physics: 9266,
    history_civilization: 9081,
    biology_medicine: 7431
  };

  const totalDomainPassages = Object.values(domains).reduce((a, b) => a + b, 0);

  const domainLabels = {
    cs_ai: { name: 'Computer Science & AI', color: '#6366f1' },
    space_physics: { name: 'Space Exploration & Physics', color: '#38bdf8' },
    history_civilization: { name: 'History & Civilization', color: '#f59e0b' },
    biology_medicine: { name: 'Biology & Medicine', color: '#10b981' }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-badge">Corpus & Index</span>
            <h2 className="modal-title">Collection Statistics</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Key Metrics Grid */}
          <div className="stats-kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Passages</span>
              <span className="kpi-val">{metadata.totalDocs?.toLocaleString()}</span>
              <span className="kpi-sub">35k authentic Wikipedia chunks</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Vocabulary Size</span>
              <span className="kpi-val">{metadata.vocabularySize?.toLocaleString()}</span>
              <span className="kpi-sub">Stemmed distinct terms</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Postings Entries</span>
              <span className="kpi-val">{metadata.totalPostings?.toLocaleString()}</span>
              <span className="kpi-sub">Inverted index entries</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Avg Document Length</span>
              <span className="kpi-val">{typeof metadata.avgDocLength === 'number' ? metadata.avgDocLength.toFixed(1) : '83.6'}</span>
              <span className="kpi-sub">Tokens per passage</span>
            </div>
          </div>

          {/* Domain Distribution */}
          <div className="modal-section">
            <h3 className="section-heading">Domain Distribution</h3>
            <div className="domain-bar-stack">
              {Object.entries(domains).map(([k, count]) => {
                const pct = ((count / totalDomainPassages) * 100).toFixed(1);
                const info = domainLabels[k] || { name: k, color: '#94a3b8' };
                return (
                  <div
                    key={k}
                    className="domain-bar-segment"
                    style={{ width: `${pct}%`, backgroundColor: info.color }}
                    title={`${info.name}: ${count} passages (${pct}%)`}
                  />
                );
              })}
            </div>

            <div className="domain-legend-grid">
              {Object.entries(domains).map(([k, count]) => {
                const pct = ((count / totalDomainPassages) * 100).toFixed(1);
                const info = domainLabels[k] || { name: k, color: '#94a3b8' };
                return (
                  <div key={k} className="domain-legend-item">
                    <span className="legend-dot" style={{ backgroundColor: info.color }} />
                    <div className="legend-text">
                      <span className="legend-name">{info.name}</span>
                      <span className="legend-count">{count.toLocaleString()} ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Information Retrieval Constants */}
          <div className="modal-section">
            <h3 className="section-heading">Active IR Constants & Parameters</h3>
            <div className="ir-constants-grid">
              <div className="ir-const-item">
                <span className="const-name">Zone Weights:</span>
                <span className="const-val">Title: 0.35 | Body: 0.65</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">BM25 Tuning:</span>
                <span className="const-val">k₁ = 1.2, b = 0.75</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Context Decay:</span>
                <span className="const-val">λ = 0.75 per turn</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Shift Cosine Threshold:</span>
                <span className="const-val">0.26 (Cosine &lt; 0.26)</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Entity Lock Threshold:</span>
                <span className="const-val">IDF ≥ 2.50 + Top-3 Title Hits</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Seen-Passage Penalty:</span>
                <span className="const-val">β = 0.30 (Demotion Multiplier: 0.70)</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Rank Fusion:</span>
                <span className="const-val">RRF (k = 60)</span>
              </div>
              <div className="ir-const-item">
                <span className="const-name">Clarifier Margin:</span>
                <span className="const-val">Threshold: 0.065</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="modal-note">Frozen evaluated corpus (SHA-256 verified) | Zero runtime LLM or vector DB</span>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
