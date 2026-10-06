import React from 'react';

export default function ControlsRibbon({
  model,
  setModel,
  lockMode,
  setLockMode,
  applySeenPenalty,
  setApplySeenPenalty,
  useChampionLists,
  setUseChampionLists,
  applyIndexElimination,
  setApplyIndexElimination,
  onRescoreLastTurn,
  hasActiveResults = false,
  isRescoring = false
}) {
  return (
    <div className="controls-ribbon">
      <div className="controls-group">
        <span className="control-label">Scoring Model:</span>
        <div className="pill-switch">
          <button
            type="button"
            className={`pill-btn ${model === 'cosine' ? 'pill-active' : ''}`}
            onClick={() => setModel('cosine')}
            title="SMART lnc.ltc Vector Space Model with Cosine Normalization"
          >
            SMART lnc.ltc Cosine
          </button>
          <button
            type="button"
            className={`pill-btn ${model === 'bm25' ? 'pill-active' : ''}`}
            onClick={() => setModel('bm25')}
            title="Okapi BM25 Probabilistic Ranking (k1=1.2, b=0.75)"
          >
            Okapi BM25
          </button>
        </div>
      </div>

      <div className="controls-group">
        <span className="control-label">Entity Lock Mode:</span>
        <div className="pill-switch">
          <button
            type="button"
            className={`pill-btn ${lockMode === 'hard' ? 'pill-active' : ''}`}
            onClick={() => setLockMode('hard')}
            title="Hard Lock: Strict Boolean Title-Zone Candidate Filter with <10 fallback"
          >
            Hard Lock (Title Zone)
          </button>
          <button
            type="button"
            className={`pill-btn ${lockMode === 'soft' ? 'pill-active' : ''}`}
            onClick={() => setLockMode('soft')}
            title="Soft Boost: 2.0x score multiplier on locked entity terms without filtering"
          >
            Soft Boost (2.0×)
          </button>
        </div>
      </div>

      <div className="controls-group">
        <span className="control-label">Seen Passage Penalty:</span>
        <button
          type="button"
          className={`toggle-chip ${applySeenPenalty ? 'toggle-on' : 'toggle-off'}`}
          onClick={() => setApplySeenPenalty(!applySeenPenalty)}
          title="Demotes previously viewed passages by 30% (multiplier 0.70) to surface fresh evidence"
        >
          <span className="toggle-indicator" />
          {applySeenPenalty ? 'Novelty Active (β=0.30)' : 'Penalty Disabled'}
        </button>
      </div>

      <div className="controls-group">
        <span className="control-label">Efficiency Pruning:</span>
        <div className="checkbox-pair">
          <button
            type="button"
            className={`chip-toggle ${useChampionLists ? 'chip-on' : ''}`}
            onClick={() => setUseChampionLists(!useChampionLists)}
            title="Ablation R1: Restricts candidate evaluation to top r=50 postings per query term"
          >
            {useChampionLists ? '✓ ' : ''}Champion Lists (r=50)
          </button>
          <button
            type="button"
            className={`chip-toggle ${applyIndexElimination ? 'chip-on' : ''}`}
            onClick={() => setApplyIndexElimination(!applyIndexElimination)}
            title="Ablation R2: Eliminates query terms with collection IDF < 2.50"
          >
            {applyIndexElimination ? '✓ ' : ''}Index Elimination (IDF ≥ 2.50)
          </button>
        </div>
      </div>

      {hasActiveResults && onRescoreLastTurn && (
        <div className="controls-rescore-group">
          <button
            type="button"
            className="btn-rescore"
            onClick={onRescoreLastTurn}
            disabled={isRescoring}
            title="Re-executes the current query with updated ribbon parameters and inspects new scores"
          >
            {isRescoring ? 'Re-scoring...' : '⚡ Re-score Active Turn'}
          </button>
        </div>
      )}
    </div>
  );
}
