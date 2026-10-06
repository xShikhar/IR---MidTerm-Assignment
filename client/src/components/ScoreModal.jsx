import React from 'react';

export default function ScoreModal({ isOpen, onClose, doc }) {
  if (!isOpen || !doc) return null;

  const b = doc.breakdown || {};
  const isBm25 = b.scoringModel?.includes('BM25');
  const termContribs = b.termContributions || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container score-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-badge">{b.scoringModel || 'Vector Space'}</span>
            <h2 className="modal-title">Mathematical Score Breakdown</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Document Summary Card */}
          <div className="doc-summary-banner">
            <div className="doc-summary-meta">
              <span className="doc-id-pill">{doc.docId}</span>
              <span className="domain-pill">{doc.domain}</span>
              <span className="final-score-pill">Score: <strong>{doc.score?.toFixed(4)}</strong></span>
            </div>
            <h3 className="doc-summary-title">{doc.title}</h3>
          </div>

          {/* Formula Explanation Banner */}
          <div className="formula-box">
            <div className="formula-label">Retrieval Equation Applied:</div>
            {isBm25 ? (
              <div className="formula-text">
                Score(D, Q) = ∑<sub>t ∈ Q</sub> IDF(t) · [ TF(t,D) · (k₁ + 1) ] / [ TF(t,D) + k₁ · (1 - b + b · |D| / avgdl) ]
                <div className="formula-note">Parameters: k₁ = 1.2, b = 0.75, avgdl = 83.58 tokens</div>
              </div>
            ) : (
              <div className="formula-text">
                Score(D, Q) = [ ∑<sub>t ∈ Q ∩ D</sub> w<sub>t,q</sub> · w<sub>t,d</sub> ] / [ ‖D‖₂ · ‖Q‖₂ ]
                <div className="formula-note">SMART lnc.ltc: Logarithmic TF (1 + ln tf) with Cosine length normalization</div>
              </div>
            )}
          </div>

          {/* Term Contributions Table */}
          <div className="modal-section">
            <h3 className="section-heading">Per-Term Score Contributions</h3>
            {termContribs.length === 0 ? (
              <div className="empty-subtext">No individual term decomposition available.</div>
            ) : isBm25 ? (
              <table className="trace-table score-table">
                <thead>
                  <tr>
                    <th>Query Term</th>
                    <th>TF in Doc</th>
                    <th>BM25 IDF</th>
                    <th>Saturation</th>
                    <th>Term Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {termContribs.map((tc, idx) => (
                    <tr key={idx}>
                      <td className="term-cell">{tc.term}</td>
                      <td>{tc.tf ?? tc.titleTf ?? '1'}</td>
                      <td>{typeof tc.idf === 'number' ? tc.idf.toFixed(4) : tc.idf}</td>
                      <td>{typeof tc.saturation === 'number' ? tc.saturation.toFixed(3) : '—'}</td>
                      <td className="contrib-val">
                        +{typeof tc.scoreContribution === 'number' ? tc.scoreContribution.toFixed(4) : tc.product?.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="trace-table score-table">
                <thead>
                  <tr>
                    <th>Matching Term</th>
                    <th>Query Weight (w<sub>t,q</sub>)</th>
                    <th>Doc Weight (w<sub>t,d</sub>)</th>
                    <th>Product Contribution (w<sub>t,q</sub> · w<sub>t,d</sub>)</th>
                  </tr>
                </thead>
                <tbody>
                  {termContribs.map((tc, idx) => (
                    <tr key={idx}>
                      <td className="term-cell">{tc.term}</td>
                      <td>{typeof tc.queryWeight === 'number' ? tc.queryWeight.toFixed(4) : '—'}</td>
                      <td>{typeof tc.docWeight === 'number' ? tc.docWeight.toFixed(4) : '—'}</td>
                      <td className="contrib-val">+{typeof tc.product === 'number' ? tc.product.toFixed(4) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Zone & Normalization Details */}
          <div className="modal-section">
            <h3 className="section-heading">Zone & Document Normalization Factors</h3>
            <div className="norm-grid">
              <div className="norm-card">
                <span className="norm-label">Title TF Total (Weight 0.35)</span>
                <span className="norm-val">{b.titleTfTotal ?? 0} occurrences</span>
              </div>
              <div className="norm-card">
                <span className="norm-label">Body TF Total (Weight 0.65)</span>
                <span className="norm-val">{b.bodyTfTotal ?? 0} occurrences</span>
              </div>
              <div className="norm-card">
                <span className="norm-label">Document Length (|D|)</span>
                <span className="norm-val">{b.docLength ?? '—'} tokens</span>
              </div>
              {!isBm25 && (
                <div className="norm-card">
                  <span className="norm-label">Euclidean Length Norm (‖D‖₂)</span>
                  <span className="norm-val">{b.euclideanNorm ?? '—'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="modal-note">Exact deterministic scores computed by native ES modules</span>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
