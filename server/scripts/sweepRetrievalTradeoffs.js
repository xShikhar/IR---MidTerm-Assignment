/**
 * @file server/scripts/sweepRetrievalTradeoffs.js
 * @description Benchmarks retrieval efficiency trade-offs:
 * 1. Index Elimination sweeps at minIdf in {2.50, 3.50, 4.50} with >=2 terms kept.
 * 2. Champion Lists sweeps at r in {50, 100, 250, 500, 1000}.
 * Measures overlap@10 vs exhaustive default and latency (rankings only, zero qrels).
 * Exports eval/output/retrieval_tradeoffs.svg.
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { loadIndex } from '../src/index/serializer.js';
import { executeRetrieval } from '../src/retrieval/engine.js';
import { analyze } from '../src/index/normalizer.js';
import { eliminateLowIdfTerms } from '../src/retrieval/indexElimination.js';
import { CONFIG } from '../src/config/index.js';

const index = loadIndex(CONFIG.paths.indexFile);
const convs = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf8'));

// Flatten all 70 turns
const allTurns = [];
for (const c of convs) {
  for (const t of c.turns) {
    allTurns.push({
      turnKey: `${c.id}_${t.turnId}`,
      query: t.query
    });
  }
}

console.log(`[Sweep] Loaded ${allTurns.length} turns across ${convs.length} conversations.`);

// 1. Compute exhaustive baseline rankings and latency
const exhaustiveRankings = new Map();
let totalExhaustiveTime = 0;

for (const turn of allTurns) {
  const t0 = performance.now();
  const res = executeRetrieval(turn.query, index, {
    topK: 10,
    applyIndexElimination: false,
    useChampionLists: false,
    model: 'cosine'
  });
  totalExhaustiveTime += (performance.now() - t0);
  exhaustiveRankings.set(turn.turnKey, res.results.map(r => r.docId));
}

const baselineLatencyMs = totalExhaustiveTime / allTurns.length;
console.log(`[Sweep] Baseline Exhaustive Latency: ${baselineLatencyMs.toFixed(3)} ms/query (Overlap@10: 100%)\n`);

// Helper for overlap@10
function computeOverlap(testRankings) {
  let totalOverlap = 0;
  for (const turn of allTurns) {
    const baseIds = new Set(exhaustiveRankings.get(turn.turnKey));
    const testIds = testRankings.get(turn.turnKey);
    let common = 0;
    for (const d of testIds) {
      if (baseIds.has(d)) common++;
    }
    totalOverlap += common / 10;
  }
  return (totalOverlap / allTurns.length) * 100;
}

// -------------------------------------------------------------------------
// 1. INDEX ELIMINATION SWEEP
// -------------------------------------------------------------------------
const idfThresholds = [2.50, 3.50, 4.50];
const elimResults = [];

console.log('=== PART 1.1: INDEX ELIMINATION SWEEP (minKeep >= 2) ===');
for (const threshold of idfThresholds) {
  let prunedTermsCount = 0;
  let totalTermsCount = 0;
  const testRankings = new Map();
  let totalTime = 0;

  for (const turn of allTurns) {
    const terms = analyze(turn.query, true);
    totalTermsCount += terms.length;
    const elim = eliminateLowIdfTerms(terms, index.dictionary, threshold, 2);
    prunedTermsCount += elim.eliminatedTerms.length;

    const t0 = performance.now();
    const res = executeRetrieval(turn.query, index, {
      topK: 10,
      applyIndexElimination: true,
      minIdf: threshold,
      useChampionLists: false,
      model: 'cosine'
    });
    totalTime += (performance.now() - t0);
    testRankings.set(turn.turnKey, res.results.map(r => r.docId));
  }

  const overlap = computeOverlap(testRankings);
  const latencyMs = totalTime / allTurns.length;
  elimResults.push({
    threshold,
    prunedTerms: prunedTermsCount,
    prunedPct: ((prunedTermsCount / totalTermsCount) * 100).toFixed(1),
    overlap: Number(overlap.toFixed(2)),
    latencyMs: Number(latencyMs.toFixed(3))
  });

  console.log(`minIdf >= ${threshold.toFixed(2)}: Pruned ${prunedTermsCount}/${totalTermsCount} terms (${((prunedTermsCount/totalTermsCount)*100).toFixed(1)}%) | Overlap@10: ${overlap.toFixed(2)}% | Latency: ${latencyMs.toFixed(3)} ms`);
}

// -------------------------------------------------------------------------
// 2. CHAMPION LISTS SWEEP
// -------------------------------------------------------------------------
const rValues = [50, 100, 250, 500, 1000];
const champResults = [];

console.log('\n=== PART 1.2: CHAMPION LISTS SWEEP (r in {50, 100, 250, 500, 1000}) ===');
for (const r of rValues) {
  const testRankings = new Map();
  let totalTime = 0;

  for (const turn of allTurns) {
    const t0 = performance.now();
    const res = executeRetrieval(turn.query, index, {
      topK: 10,
      applyIndexElimination: false,
      useChampionLists: true,
      topR: r,
      model: 'cosine'
    });
    totalTime += (performance.now() - t0);
    testRankings.set(turn.turnKey, res.results.map(r => r.docId));
  }

  const overlap = computeOverlap(testRankings);
  const latencyMs = totalTime / allTurns.length;
  champResults.push({
    r,
    overlap: Number(overlap.toFixed(2)),
    latencyMs: Number(latencyMs.toFixed(3))
  });

  console.log(`r = ${r}: Overlap@10: ${overlap.toFixed(2)}% | Latency: ${latencyMs.toFixed(3)} ms`);
}

// -------------------------------------------------------------------------
// 3. EXPORT SVG PLOT (eval/output/retrieval_tradeoffs.svg)
// -------------------------------------------------------------------------
const svgWidth = 800;
const svgHeight = 450;
const margin = { top: 60, right: 180, bottom: 60, left: 70 };
const plotWidth = svgWidth - margin.left - margin.right;
const plotHeight = svgHeight - margin.top - margin.bottom;

// Compute data bounds for plotting
const allPoints = [
  { name: 'Exhaustive (Default)', overlap: 100, latency: baselineLatencyMs, type: 'baseline' },
  ...elimResults.map(e => ({ name: `Elim idf>=${e.threshold}`, overlap: e.overlap, latency: e.latencyMs, type: 'elim' })),
  ...champResults.map(c => ({ name: `Champ r=${c.r}`, overlap: c.overlap, latency: c.latencyMs, type: 'champ' }))
];

const minLat = 0;
const maxLat = Math.max(...allPoints.map(p => p.latency)) * 1.2;
const minOverlap = 40;
const maxOverlap = 105;

function scaleX(lat) {
  return margin.left + ((lat - minLat) / (maxLat - minLat)) * plotWidth;
}
function scaleY(ov) {
  return margin.top + plotHeight - ((ov - minOverlap) / (maxOverlap - minOverlap)) * plotHeight;
}

// Generate champion polyline
const champPoints = champResults.map(c => `${scaleX(c.latencyMs).toFixed(1)},${scaleY(c.overlap).toFixed(1)}`).join(' ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Title -->
  <text x="${svgWidth / 2}" y="32" font-size="18" font-weight="700" fill="#f8fafc" text-anchor="middle">Retrieval Efficiency Trade-off: Overlap@10 vs. Query Latency</text>
  <text x="${svgWidth / 2}" y="50" font-size="12" fill="#94a3b8" text-anchor="middle">Exhaustive baseline vs. Champion Lists (r sweep) and Index Elimination (IDF sweep) across 70 turns</text>

  <!-- Axes Grid -->
  <g stroke="#334155" stroke-width="1" stroke-dasharray="3 3">
    ${[50, 60, 70, 80, 90, 100].map(yVal => `
      <line x1="${margin.left}" y1="${scaleY(yVal)}" x2="${margin.left + plotWidth}" y2="${scaleY(yVal)}" />
      <text x="${margin.left - 10}" y="${scaleY(yVal) + 4}" font-size="11" fill="#64748b" text-anchor="end">${yVal}%</text>
    `).join('')}
  </g>

  <!-- Axes lines -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#64748b" stroke-width="2" />
  <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" stroke="#64748b" stroke-width="2" />

  <!-- Axis Labels -->
  <text x="${margin.left + plotWidth / 2}" y="${svgHeight - 15}" font-size="13" font-weight="600" fill="#cbd5e1" text-anchor="middle">Latency (ms / query)</text>
  <text x="20" y="${margin.top + plotHeight / 2}" font-size="13" font-weight="600" fill="#cbd5e1" text-anchor="middle" transform="rotate(-90 20 ${margin.top + plotHeight / 2})">Overlap@10 vs. Exhaustive (%)</text>

  <!-- Champion Lists Line -->
  <polyline fill="none" stroke="#38bdf8" stroke-width="2.5" points="${champPoints}" />

  <!-- Data Points: Champion Lists -->
  ${champResults.map(c => `
    <circle cx="${scaleX(c.latencyMs)}" cy="${scaleY(c.overlap)}" r="6" fill="#38bdf8" stroke="#0f172a" stroke-width="2" />
    <text x="${scaleX(c.latencyMs) + 8}" y="${scaleY(c.overlap) - 6}" font-size="10" fill="#7dd3fc" font-weight="600">r=${c.r}</text>
  `).join('')}

  <!-- Data Points: Index Elimination -->
  ${elimResults.map(e => `
    <rect x="${scaleX(e.latencyMs) - 5}" y="${scaleY(e.overlap) - 5}" width="10" height="10" fill="#f59e0b" stroke="#0f172a" stroke-width="2" />
    <text x="${scaleX(e.latencyMs) + 8}" y="${scaleY(e.overlap) + 12}" font-size="10" fill="#fbbf24" font-weight="600">idf≥${e.threshold}</text>
  `).join('')}

  <!-- Data Point: Exhaustive Default -->
  <circle cx="${scaleX(baselineLatencyMs)}" cy="${scaleY(100)}" r="7" fill="#10b981" stroke="#f8fafc" stroke-width="2" />
  <text x="${scaleX(baselineLatencyMs) + 10}" y="${scaleY(100) + 4}" font-size="11" fill="#34d399" font-weight="700">Exhaustive Default</text>

  <!-- Legend -->
  <g transform="translate(${svgWidth - margin.right + 20}, ${margin.top})">
    <rect x="0" y="0" width="150" height="130" fill="#1e293b" rx="6" stroke="#334155" />
    <text x="12" y="22" font-size="12" font-weight="700" fill="#f8fafc">Configuration</text>
    
    <circle cx="20" cy="45" r="5" fill="#10b981" stroke="#f8fafc" stroke-width="1.5" />
    <text x="32" y="49" font-size="11" fill="#e2e8f0">Exhaustive (100%)</text>
    
    <circle cx="20" cy="75" r="5" fill="#38bdf8" />
    <text x="32" y="79" font-size="11" fill="#e2e8f0">Champion (r sweep)</text>
    
    <rect x="15" y="99" width="10" height="10" fill="#f59e0b" />
    <text x="32" y="108" font-size="11" fill="#e2e8f0">Index Elim (IDF)</text>
  </g>
</svg>`;

const outSvgPath = path.join(CONFIG.paths.evalOutputDir, 'retrieval_tradeoffs.svg');
fs.writeFileSync(outSvgPath, svg, 'utf8');
console.log(`\n[Sweep] Successfully exported trade-off SVG plot to ${outSvgPath}`);

export { elimResults, champResults, baselineLatencyMs };
