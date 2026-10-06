import React, { useState } from 'react';

export default function TraceInspector({ trace }) {
  const [activeTab, setActiveTab] = useState('decision');

  if (!trace) {
    return (
      <div className="trace-panel empty-trace-panel">
        <div className="empty-trace-content">
          <div className="empty-trace-icon">🔍</div>
          <h3 className="empty-trace-title">IR Trace Inspector</h3>
          <p className="empty-trace-desc">
            Execute a conversational search query or click any search turn to inspect real-time postings,
            term IDF values, transition guards, entity locks, and score calculations.
          </p>
          <div className="trace-feature-list">
            <div className="feature-item">✓ Zero black-box LLMs / Vector DBs</div>
            <div className="feature-item">✓ Inverted index collection statistics</div>
            <div className="feature-item">✓ Term-by-term scoring provenance</div>
            <div className="feature-item">✓ Pronoun & locked-entity guards</div>
          </div>
        </div>
      </div>
    );
  }

  const {
    turn,
    rawQuery,
    timings = {},
    entityLock,
    shiftDecision,
    rewriter = {},
    postingsUsed = [],
    seenPassagePenalty,
    decomposition,
    clarification,
    phraseMatches = [],
    retrievalExecution = {}
  } = trace;

  const {
    model = 'cosine',
    championLists = false,
    indexElimination = false,
    minIdf = 2.50,
    eliminatedTerms = []
  } = retrievalExecution;

  const decisionLabel = entityLock?.decision || shiftDecision?.decision || 'CARRY';
  const decisionReason = entityLock?.decisionReason || shiftDecision?.reason || '';
  const guards = entityLock?.guardsTriggered || [];

  return (
    <div className="trace-panel">
      {/* Trace Top Bar */}
      <div className="trace-top-bar">
        <div className="trace-title-group">
          <span className="trace-main-title">IR Execution Trace</span>
          <span className="turn-indicator-pill">Turn #{turn}</span>
        </div>
        <div className="trace-total-time">
          Latency: <strong style={{ color: '#38bdf8' }}>{timings.totalLatencyMs ?? 0} ms</strong>
        </div>
      </div>

      {/* Trace Navigation Tabs */}
      <div className="trace-tabs-bar">
        <button
          type="button"
          className={`trace-tab-btn ${activeTab === 'decision' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('decision')}
        >
          1. State & Decision
        </button>
        <button
          type="button"
          className={`trace-tab-btn ${activeTab === 'query' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          2. Rewriter & Phrase
        </button>
        <button
          type="button"
          className={`trace-tab-btn ${activeTab === 'postings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('postings')}
        >
          3. Postings & Fusion
        </button>
        <button
          type="button"
          className={`trace-tab-btn ${activeTab === 'novelty' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('novelty')}
        >
          4. Novelty & Profiler
        </button>
      </div>

      {/* Active Pipeline Status Strip */}
      <div className="trace-pipeline-strip">
        <div className="pipeline-pill">
          <span className="pipe-label">Model:</span>
          <span className="pipe-val">{model === 'bm25' ? 'Okapi BM25' : 'SMART lnc.ltc'}</span>
        </div>
        <div className={`pipeline-pill ${championLists ? 'pill-active-green' : ''}`}>
          <span className="pipe-label">Champion Lists:</span>
          <span className="pipe-val">{championLists ? 'Active (r=50)' : 'Disabled'}</span>
        </div>
        <div className={`pipeline-pill ${indexElimination ? 'pill-active-blue' : ''}`}>
          <span className="pipe-label">Index Elimination:</span>
          <span className="pipe-val">{indexElimination ? `Active (IDF ≥ ${minIdf})` : 'Disabled'}</span>
        </div>
      </div>

      <div className="trace-tab-content">
        {/* =================================================================== */}
        {/* TAB 1: CONVERSATIONAL DECISION & STATE TRACKING                     */}
        {/* =================================================================== */}
        {activeTab === 'decision' && (
          <div className="tab-pane">
            {/* Transition Decision Card */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Step 1</span>
                <span className="card-step-title">Conversational Transition Decision</span>
              </div>

              <div className="decision-status-row">
                <span className="decision-label-text">Action Classified:</span>
                <span
                  className={
                    decisionLabel === 'CARRY'
                      ? 'badge-carry'
                      : decisionLabel === 'entity_switch'
                        ? 'badge-switch'
                        : 'badge-reset'
                  }
                >
                  {decisionLabel}
                </span>
              </div>

              {guards.length > 0 && (
                <div className="guards-list">
                  <span className="guards-label">Linguistic Guards Triggered:</span>
                  <div className="guard-badges-wrap">
                    {guards.map((g, idx) => (
                      <span key={idx} className="guard-pill">
                        🛡️ {g.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="decision-reason-box">
                <span className="reason-label">Heuristic Reason:</span>
                <span className="reason-text">{decisionReason}</span>
              </div>
            </div>

            {/* Entity Lock Enforcement & Title-Zone Filtering */}
            {entityLock && (
              <div className="trace-card">
                <div className="trace-card-header">
                  <span className="card-step-num">Step 2</span>
                  <span className="card-step-title">Entity Lock & Title-Zone Enforcement</span>
                </div>

                <div className="lock-meta-row">
                  <span className="badge-mode">Mode: {entityLock.lockMode}</span>
                  <div className="candidate-count-summary">
                    Title Zone Hits: <strong>{entityLock.candidateCounts?.survivingTitleCandidates ?? 'N/A'}</strong>
                    {' → '}
                    Final Retrieved: <strong>{entityLock.candidateCounts?.finalRetrievedCount ?? 'N/A'}</strong>
                  </div>
                </div>

                {entityLock.fallback && (
                  <div className="fallback-warning-box">
                    <span className="warn-icon">⚠️</span>
                    <div className="warn-text">
                      <strong>Candidate Starvation Fallback:</strong> Title-zone Boolean matched fewer than 10 documents ({entityLock.candidateCounts?.survivingTitleCandidates}). Gracefully fell back to 2.0× soft entity boost so ranking pool is never starved.
                    </div>
                  </div>
                )}

                <div className="table-wrapper">
                  <div className="sub-heading">Locked Entity Stems (Persistent Context):</div>
                  {entityLock.lockedEntities?.length > 0 ? (
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Entity Stem</th>
                          <th>Collection IDF</th>
                          <th>Title Hits (Top 3)</th>
                          <th>Locked Turn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entityLock.lockedEntities.map((e, idx) => (
                          <tr key={idx}>
                            <td className="entity-stem-cell">{e.term}</td>
                            <td className="mono-num">{typeof e.idf === 'number' ? e.idf.toFixed(4) : e.idf}</td>
                            <td>{e.titleHitCount} / 3</td>
                            <td>Turn #{e.sourceTurn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-subtext">No persistent entity stem locked on this turn.</div>
                  )}
                </div>
              </div>
            )}

            {/* Active Aspect Context */}
            {entityLock && (
              <div className="trace-card">
                <div className="trace-card-header">
                  <span className="card-step-num">Step 3</span>
                  <span className="card-step-title">Aspect-Aware State Tracking</span>
                </div>

                <div className="table-wrapper">
                  {entityLock.aspectTerms?.length > 0 ? (
                    <table className="trace-table">
                      <thead>
                        <tr>
                          <th>Active Aspect Term</th>
                          <th>Turn Decay Weight</th>
                          <th>Collection IDF</th>
                          <th>Intro Turn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entityLock.aspectTerms.map((a, idx) => (
                          <tr key={idx}>
                            <td className="aspect-stem-cell">{a.term}</td>
                            <td className="mono-num highlight-weight">
                              {typeof a.weight === 'number' ? a.weight.toFixed(3) : a.weight}
                            </td>
                            <td className="mono-num">{typeof a.idf === 'number' ? a.idf.toFixed(4) : a.idf}</td>
                            <td>Turn #{a.sourceTurn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty-subtext">No active aspect terms in conversational context.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: QUERY REWRITER & POSITIONAL PHRASE SEARCH                    */}
        {/* =================================================================== */}
        {activeTab === 'query' && (
          <div className="tab-pane">
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Rewriter</span>
                <span className="card-step-title">Provenance-Preserving Rewriter</span>
              </div>

              <div className="query-diff-box">
                <div className="query-diff-item">
                  <span className="diff-tag user-tag">Raw User Query:</span>
                  <div className="diff-query-text">{rawQuery}</div>
                </div>
                <div className="query-diff-arrow">↓ Rewritten by TurnTrace Engine (Mode: {rewriter.mode})</div>
                <div className="query-diff-item">
                  <span className="diff-tag engine-tag">Rewritten Standalone Query:</span>
                  <div className="diff-query-text highlight-rewritten">{rewriter.rewrittenQuery}</div>
                </div>
              </div>

              {rewriter.provenance?.length > 0 && (
                <div className="table-wrapper" style={{ marginTop: '12px' }}>
                  <div className="sub-heading">Term Provenance & Expansion Roles:</div>
                  <table className="trace-table">
                    <thead>
                      <tr>
                        <th>Term</th>
                        <th>Syntactic Role</th>
                        <th>Origin Turn</th>
                        <th>Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewriter.provenance.map((p, idx) => (
                        <tr key={idx}>
                          <td className="term-provenance-name">{p.term}</td>
                          <td>
                            <span className={`role-pill role-${p.role || 'original'}`}>
                              {p.role || 'original'}
                            </span>
                          </td>
                          <td>Turn #{p.sourceTurn}</td>
                          <td className="mono-num highlight-weight">
                            {typeof p.weight === 'number' ? p.weight.toFixed(3) : p.weight}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Positional Phrase Match Detection */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Phrases</span>
                <span className="card-step-title">Positional Quoted Phrase Search</span>
              </div>

              {phraseMatches && phraseMatches.length > 0 ? (
                <div className="phrase-matches-list">
                  {phraseMatches.map((pm, idx) => (
                    <div key={idx} className="phrase-match-item">
                      <div className="phrase-name">"{pm.phrase}"</div>
                      <div className="phrase-stats">
                        Matching Documents via Positional Intersection: <strong>{pm.matchingDocCount}</strong>
                      </div>
                      <div className="phrase-docs-preview">
                        Matching DocIds: {pm.docIds.slice(0, 5).join(', ')}
                        {pm.docIds.length > 5 ? ' ...' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-subtext">
                  No quoted phrase detected in this query.
                  Tip: Put query terms in quotation marks (e.g. <code>"vector space model"</code>) to trigger exact positional postings intersection.
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: POSTINGS DICTIONARY & MULTI-PART FUSION                      */}
        {/* =================================================================== */}
        {activeTab === 'postings' && (
          <div className="tab-pane">
            {/* Efficiency & Index Elimination Card */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Pruning</span>
                <span className="card-step-title">Inverted Index Pruning & Candidate Reduction</span>
              </div>

              <div className="pruning-status-grid">
                <div className="pruning-stat-box">
                  <div className="stat-box-title">Index Elimination (IDF ≥ {minIdf})</div>
                  <div className="stat-box-desc">
                    {indexElimination ? (
                      eliminatedTerms && eliminatedTerms.length > 0 ? (
                        <div className="eliminated-terms-alert">
                          <span className="elim-badge">Pruned {eliminatedTerms.length} Low-IDF Term(s):</span>
                          <div className="elim-chips">
                            {eliminatedTerms.map((t, idx) => (
                              <span key={idx} className="chip-eliminated">
                                ✂️ {typeof t === 'string' ? t : t.term} (IDF &lt; {minIdf})
                              </span>
                            ))}
                          </div>
                          <span className="elim-note">
                            Pruned non-discriminative query terms with collection IDF &lt; {minIdf} to avoid traversing massive postings lists (Manning §7.1.2).
                          </span>
                        </div>
                      ) : (
                        <div className="elim-none">
                          <span className="badge-pass">✓ Active: All Stems Retained</span>
                          <span className="elim-note">
                            All query terms in this turn possess high discriminative power (collection IDF ≥ {minIdf}). Zero terms pruned.
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="elim-disabled">
                        <span className="badge-off">Disabled (Offline Ablation)</span>
                        <span className="elim-note">
                          Full query term evaluation active. Toggle "Index Elimination" in the Controls Ribbon to prune low-IDF terms.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pruning-stat-box">
                  <div className="stat-box-title">Champion Lists (r=50)</div>
                  <div className="stat-box-desc">
                    {championLists ? (
                      <div className="elim-none">
                        <span className="badge-pass">✓ Precomputed Lists Active</span>
                        <span className="elim-note">
                          Candidate gathering restricted to top 50 documents per term sorted by local weight w_(t,d) = 1 + ln(tf) (Manning §7.1.3).
                        </span>
                      </div>
                    ) : (
                      <div className="elim-disabled">
                        <span className="badge-off">Standard Posting Scan</span>
                        <span className="elim-note">
                          Traversing standard complete postings lists across all matching documents.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Dictionary</span>
                <span className="card-step-title">Inverted Index Postings Statistics</span>
              </div>

              <div className="table-wrapper">
                <table className="trace-table">
                  <thead>
                    <tr>
                      <th>Queried Stem</th>
                      <th>Doc Frequency (df)</th>
                      <th>lnc.ltc IDF</th>
                      <th>BM25 IDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postingsUsed.map((p, idx) => (
                      <tr key={idx}>
                        <td className="term-stem-cell">{p.term}</td>
                        <td className="mono-num">{p.df?.toLocaleString()}</td>
                        <td className="mono-num">{typeof p.idf === 'number' ? p.idf.toFixed(4) : p.idf}</td>
                        <td className="mono-num">{typeof p.bm25Idf === 'number' ? p.bm25Idf.toFixed(4) : p.bm25Idf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Decomposition & Fusion */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Fusion</span>
                <span className="card-step-title">Query Decomposition & Rank Fusion</span>
              </div>

              {decomposition?.isDecomposed ? (
                <div className="decomp-section">
                  <div className="sub-heading">Sub-Queries Evaluated:</div>
                  <div className="subquery-list">
                    {decomposition.subQueries.map((sq, idx) => (
                      <div key={idx} className="subquery-card">
                        <div className="sq-type-badge">[{sq.type}]</div>
                        <div className="sq-query">{sq.subQuery}</div>
                        <div className="sq-count">{sq.returnedCount} candidates</div>
                      </div>
                    ))}
                  </div>
                  <div className="fusion-summary-badge">
                    Combined via Reciprocal Rank Fusion (RRF, k = 60)
                  </div>
                </div>
              ) : (
                <div className="empty-subtext">
                  Query was evaluated as a single coherent retrieval turn (no compound clauses or comparative markers).
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: NOVELTY DEMOTIONS & LATENCY PROFILER                         */}
        {/* =================================================================== */}
        {activeTab === 'novelty' && (
          <div className="tab-pane">
            {/* Seen Passage Penalty */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Novelty</span>
                <span className="card-step-title">Seen-Passage Penalty (Novelty Discovery)</span>
              </div>

              <div className="penalty-summary-row">
                <span>Penalty Discount Factor:</span>
                <strong>{((seenPassagePenalty?.penalty ?? 0.30) * 100).toFixed(0)}% (Multiplier: {(1 - (seenPassagePenalty?.penalty ?? 0.30)).toFixed(2)})</strong>
              </div>

              {seenPassagePenalty?.demotedPassages?.length > 0 ? (
                <div className="table-wrapper">
                  <table className="trace-table demoted-table">
                    <thead>
                      <tr>
                        <th>Demoted DocId</th>
                        <th>Original Score</th>
                        <th>Penalized Score</th>
                        <th>Score Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seenPassagePenalty.demotedPassages.map((dp, idx) => (
                        <tr key={idx}>
                          <td className="doc-id-cell">{dp.docId}</td>
                          <td className="mono-num">{dp.originalScore?.toFixed(4)}</td>
                          <td className="mono-num penal-score">{dp.penalizedScore?.toFixed(4)}</td>
                          <td className="discount-tag">-30%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-subtext">
                  No previously shown passages appeared in this turn's candidate pool.
                  (Passages shown in prior turns are tracked per session and discounted to promote novel evidence).
                </div>
              )}
            </div>

            {/* Cluster Clarifier */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Clarifier</span>
                <span className="card-step-title">Leader/Follower Cluster Clarifier</span>
              </div>

              <div className="clarifier-stats-row">
                <div className="clarifier-stat-item">
                  <span>Confidence Margin:</span>
                  <strong>{typeof clarification?.confidenceMargin === 'number' ? clarification.confidenceMargin.toFixed(4) : '—'}</strong>
                </div>
                <div className="clarifier-stat-item">
                  <span>Threshold:</span>
                  <strong>{clarification?.threshold ?? 0.065}</strong>
                </div>
                <div className="clarifier-stat-item">
                  <span>Status:</span>
                  <span className={clarification?.fired ? 'badge-fired' : 'badge-normal'}>
                    {clarification?.fired ? 'Ambiguity Question Triggered' : 'Unambiguous Ranking'}
                  </span>
                </div>
              </div>

              {clarification?.fired && (
                <div className="clarifying-q-banner">
                  <span>Prompt formulated:</span>
                  <em>"{clarification.clarifyingQuestion}"</em>
                </div>
              )}
            </div>

            {/* Latency Breakdown Profiler */}
            <div className="trace-card">
              <div className="trace-card-header">
                <span className="card-step-num">Latency</span>
                <span className="card-step-title">Turn Latency Profiler</span>
              </div>

              <div className="profiler-grid">
                <div className="profiler-item">
                  <span className="prof-label">Lexical Analysis:</span>
                  <span className="prof-val">{timings.lexicalAnalysisMs ?? 0} ms</span>
                </div>
                <div className="profiler-item">
                  <span className="prof-label">Decision Detector:</span>
                  <span className="prof-val">{timings.decisionMs ?? timings.topicShiftMs ?? 0} ms</span>
                </div>
                <div className="profiler-item">
                  <span className="prof-label">Query Rewriting:</span>
                  <span className="prof-val">{timings.rewritingMs ?? 0} ms</span>
                </div>
                <div className="profiler-item">
                  <span className="prof-label">Retrieval & Fusion:</span>
                  <span className="prof-val">{timings.retrievalAndFusionMs ?? 0} ms</span>
                </div>
                <div className="profiler-item">
                  <span className="prof-label">Clarifier Check:</span>
                  <span className="prof-val">{timings.clarificationMs ?? 0} ms</span>
                </div>
                <div className="profiler-item total-item">
                  <span className="prof-label">Total Execution Time:</span>
                  <span className="prof-val total-val">{timings.totalLatencyMs ?? 0} ms</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
