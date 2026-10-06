/**
 * @file client/src/App.jsx
 * @description TurnTrace React Frontend.
 * Exposes conversational retrieval dialogue alongside an unredacted
 * per-turn Information Retrieval Trace Inspector, interactive scoring models,
 * benchmark scenario players, and mathematical score decompositions.
 */

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ControlsRibbon from './components/ControlsRibbon';
import ChatPanel from './components/ChatPanel';
import TraceInspector from './components/TraceInspector';
import StatsModal from './components/StatsModal';
import ScoreModal from './components/ScoreModal';
import BenchmarkModal from './components/BenchmarkModal';

const DEFAULT_QUICK_PROMPTS = [
  'What is the James Webb Space Telescope?',
  'Where is its orbit located in space?',
  'Tell me about its primary mirror size.',
  'What instruments does it carry for infrared astronomy?',
  'Compare NIRCam and MIRI instruments.'
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTrace, setActiveTrace] = useState(null);
  const [stats, setStats] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  // Modals
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [inspectDoc, setInspectDoc] = useState(null);

  // Retrieval Engine Controls
  const [model, setModel] = useState('cosine');
  const [lockMode, setLockMode] = useState('hard');
  const [applySeenPenalty, setApplySeenPenalty] = useState(true);
  const [useChampionLists, setUseChampionLists] = useState(false);
  const [applyIndexElimination, setApplyIndexElimination] = useState(false);

  // Scenario Player State
  const [activeScenario, setActiveScenario] = useState(null);

  const sessionId = 'live_demo_session';

  // Load initial health, stats, and benchmark conversations
  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => {
        setStats(d);
        setIsOnline(true);
      })
      .catch(err => {
        console.warn('Backend /api/stats unavailable:', err);
        setIsOnline(false);
      });

    fetch('/api/conversations')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setConversations(d);
        }
      })
      .catch(err => {
        console.warn('Backend /api/conversations unavailable:', err);
      });
  }, []);

  // Compute next scenario turn suggestion
  const userTurnsCount = messages.filter(m => m.role === 'user').length;
  const scenarioNextTurn = activeScenario?.turns && activeScenario.turns[userTurnsCount]
    ? activeScenario.turns[userTurnsCount]
    : null;

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
        body: JSON.stringify({
          query: q,
          sessionId,
          model,
          lockMode,
          applySeenPenalty,
          useChampionLists,
          applyIndexElimination
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status HTTP ${res.status}`);
      }

      const data = await res.json();
      const engineMessage = {
        role: 'engine',
        results: data.results || [],
        trace: data.trace || null
      };

      setMessages(prev => [...prev, engineMessage]);
      if (data.trace) {
        setActiveTrace(data.trace);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'engine',
          results: [],
          trace: null,
          error: `Error communicating with retrieval engine: ${err.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isRescoring, setIsRescoring] = useState(false);

  const handleRescoreLastTurn = async () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg || isLoading || isRescoring) return;

    setIsRescoring(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: lastUserMsg.content,
          sessionId,
          model,
          lockMode,
          applySeenPenalty,
          useChampionLists,
          applyIndexElimination
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => {
        const next = [...prev];
        let lastEngineIdx = -1;
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'engine') {
            lastEngineIdx = i;
            break;
          }
        }
        const engineMessage = {
          role: 'engine',
          results: data.results || [],
          trace: data.trace || null
        };
        if (lastEngineIdx !== -1) {
          next[lastEngineIdx] = engineMessage;
        } else {
          next.push(engineMessage);
        }
        return next;
      });

      if (data.trace) {
        setActiveTrace(data.trace);
      }
    } catch (err) {
      console.warn('Re-score failed:', err);
    } finally {
      setIsRescoring(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    } catch (e) {
      console.warn('Reset request failed:', e);
    }
    setMessages([]);
    setActiveTrace(null);
    setActiveScenario(null);
  };

  const handleSelectScenario = async (scenario) => {
    await handleReset();
    setActiveScenario(scenario);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        stats={stats}
        isOnline={isOnline}
        onOpenBenchmarks={() => setIsBenchmarkOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onResetSession={handleReset}
        activeScenario={activeScenario}
      />

      {/* Retrieval Controls Ribbon */}
      <ControlsRibbon
        model={model}
        setModel={setModel}
        lockMode={lockMode}
        setLockMode={setLockMode}
        applySeenPenalty={applySeenPenalty}
        setApplySeenPenalty={setApplySeenPenalty}
        useChampionLists={useChampionLists}
        setUseChampionLists={setUseChampionLists}
        applyIndexElimination={applyIndexElimination}
        setApplyIndexElimination={setApplyIndexElimination}
        onRescoreLastTurn={handleRescoreLastTurn}
        hasActiveResults={messages.length > 0}
        isRescoring={isRescoring}
      />

      {/* Main Split Layout */}
      <div className="main-content">
        {/* Left: Chat & Results Pane */}
        <ChatPanel
          messages={messages}
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          onSend={handleSend}
          onInspectScore={doc => setInspectDoc(doc)}
          onSelectTurnTrace={tr => setActiveTrace(tr)}
          quickPrompts={DEFAULT_QUICK_PROMPTS}
          activeScenario={activeScenario}
          scenarioNextTurn={scenarioNextTurn}
        />

        {/* Right: Trace Inspector Pane */}
        <TraceInspector trace={activeTrace} />
      </div>

      {/* Modals */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
      />

      <ScoreModal
        isOpen={Boolean(inspectDoc)}
        onClose={() => setInspectDoc(null)}
        doc={inspectDoc}
      />

      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        conversations={conversations}
        onSelectScenario={handleSelectScenario}
      />
    </div>
  );
}
