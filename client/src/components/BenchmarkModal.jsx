import React from 'react';

export default function BenchmarkModal({
  isOpen,
  onClose,
  conversations,
  onSelectScenario
}) {
  if (!isOpen) return null;

  const domainLabels = {
    cs_ai: { name: 'Computer Science & AI', color: '#6366f1' },
    space_physics: { name: 'Space Exploration', color: '#38bdf8' },
    history_civilization: { name: 'History & Civilization', color: '#f59e0b' },
    biology_medicine: { name: 'Biology & Medicine', color: '#10b981' }
  };

  const scenarioMeta = {
    conv_01: { title: 'Vector Space Model & VSM Mechanics', tag: 'Core IR Principles' },
    conv_02: { title: 'Okapi BM25 & Probabilistic Ranking', tag: 'Core IR Principles' },
    conv_03: { title: 'James Webb Space Telescope (JWST)', tag: 'Anaphora & Aspect Pivot' },
    conv_04: { title: 'Apollo 11 & Lunar Landing Systems', tag: 'Multi-Turn Anaphora' },
    conv_05: { title: 'CRISPR-Cas9 & Gene Editing Ethics', tag: 'Domain Specific' },
    conv_06: { title: 'Penicillin Discovery & Antibiotics', tag: 'Historical Biology' },
    conv_07: { title: 'French Revolution & Reign of Terror', tag: 'Historical Entity Pivot' },
    conv_08: { title: 'Industrial Revolution & Steam Power', tag: 'Historical Technology' },
    conv_09: { title: 'Alan Turing: Imitation Game to Black Holes', tag: 'Topic Shift Challenge' },
    conv_10: { title: 'Space Telescopes to Apollo 11', tag: 'Entity Switch Challenge' },
    conv_11: { title: 'Mercury: Celestial Planet vs Toxic Metal', tag: 'Lexical Polysemy' },
    conv_12: { title: 'Transformers: ML Architecture to Power Grids', tag: 'Lexical Polysemy' },
    conv_13: { title: 'Quantum Computing & Grover Search', tag: 'Compound Comparative' },
    conv_14: { title: 'Entropy: Shannon Information vs Thermodynamics', tag: 'Documented Boundary Case' }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container benchmark-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-badge">Benchmark Scenarios</span>
            <h2 className="modal-title">Pre-Configured Dialogue Trees (14 Conversations)</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p className="benchmark-intro-text">
            Select a benchmark scenario from the CSD358 evaluation collection (70 turns).
            Loading a scenario clears current context and primes the quick-turn prompter so you can execute the conversation turn-by-turn.
          </p>

          <div className="scenarios-grid">
            {conversations.map(c => {
              const info = scenarioMeta[c.id] || { title: c.title || c.id, tag: 'Benchmark' };
              const domInfo = domainLabels[c.domain] || { name: c.domain, color: '#94a3b8' };
              const turns = c.turns || [];

              return (
                <div key={c.id} className="scenario-card">
                  <div className="scenario-card-top">
                    <span className="scenario-domain-pill" style={{ borderColor: domInfo.color, color: domInfo.color }}>
                      {domInfo.name}
                    </span>
                    <span className="scenario-tag-pill">{info.tag}</span>
                  </div>

                  <h4 className="scenario-card-title">{info.title}</h4>
                  <div className="scenario-turn-count">{turns.length} turns in conversation tree</div>

                  <div className="scenario-turns-preview">
                    {turns.slice(0, 3).map((t, tIdx) => (
                      <div key={t.turnId || tIdx} className="turn-preview-line">
                        <span className="turn-num-pill">T{tIdx + 1}</span>
                        <span className="turn-query-text">{t.query}</span>
                      </div>
                    ))}
                    {turns.length > 3 && (
                      <div className="more-turns-hint">+{turns.length - 3} more follow-up turns...</div>
                    )}
                  </div>

                  <button
                    className="btn-select-scenario"
                    onClick={() => {
                      onSelectScenario(c);
                      onClose();
                    }}
                  >
                    Load Scenario ({c.id}) →
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <span className="modal-note">Stratified across 4 domains, topic shifts, polysemy, and boundary conditions</span>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
