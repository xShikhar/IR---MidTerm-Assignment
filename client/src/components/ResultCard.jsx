import React from 'react';

export default function ResultCard({
  doc,
  rank,
  queryTerms = [],
  onInspectScore,
  onCardClick
}) {
  const score = doc.score || 0;

  // Domain aesthetic tags
  const domainColors = {
    cs_ai: { name: 'CS & AI', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
    space_physics: { name: 'Space & Physics', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
    history_civilization: { name: 'History', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
    biology_medicine: { name: 'Bio & Medicine', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' }
  };

  const dom = domainColors[doc.domain] || { name: doc.domain, color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };

  // Match confidence tier
  let confidenceLabel = 'Relevant';
  let confidenceClass = 'tier-relevant';
  if (score > 0.40) {
    confidenceLabel = 'High Relevance';
    confidenceClass = 'tier-high';
  } else if (score < 0.25) {
    confidenceLabel = 'Background';
    confidenceClass = 'tier-low';
  }

  const termContributions = doc.breakdown?.termContributions || [];
  const topMatchedTerms = termContributions.slice(0, 4);

  return (
    <div className="result-card" onClick={onCardClick}>
      <div className="result-card-header">
        <div className="result-rank-score">
          <span className="rank-badge">#{rank}</span>
          <span className="score-badge">{score.toFixed(4)}</span>
          <span className={`confidence-pill ${confidenceClass}`}>{confidenceLabel}</span>
          <span className="doc-id-text">{doc.docId}</span>
        </div>

        <div className="card-header-actions">
          <span
            className="domain-badge"
            style={{ color: dom.color, backgroundColor: dom.bg, borderColor: dom.border }}
          >
            {dom.name}
          </span>
          <button
            type="button"
            className="btn-score-inspect"
            onClick={e => {
              e.stopPropagation();
              onInspectScore(doc);
            }}
            title="Inspect term-by-term weights, TF breakdown, and Euclidean norm"
          >
            Inspect Score 🔬
          </button>
        </div>
      </div>

      <h4 className="result-title">{doc.title}</h4>

      <p className="result-body">{doc.body}</p>

      {/* Matched Terms Snippet */}
      {topMatchedTerms.length > 0 && (
        <div className="result-matched-terms">
          <span className="matched-label">Matching Terms:</span>
          <div className="matched-chips-list">
            {topMatchedTerms.map((t, idx) => (
              <span key={idx} className="matched-term-chip">
                {t.term}
                <span className="matched-term-weight">
                  +{typeof t.product === 'number' ? t.product.toFixed(3) : typeof t.scoreContribution === 'number' ? t.scoreContribution.toFixed(3) : ''}
                </span>
              </span>
            ))}
            {termContributions.length > 4 && (
              <span className="more-terms-count">+{termContributions.length - 4} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
