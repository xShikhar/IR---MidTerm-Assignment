/**
 * @file eval/src/export.js
 * @description Exporter for TurnTrace Evaluation Results.
 * Outputs CSV comparison tables, per-turn breakdown CSVs, and an SVG visualization chart.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Exports evaluation results to CSV files and an SVG visualization chart.
 *
 * @param {Object} benchmarkResults - Output of runEvaluationBenchmark
 * @param {string} [outputDir=CONFIG.paths.evalOutputDir]
 */
export function exportEvaluationArtifacts(benchmarkResults, outputDir = CONFIG.paths.evalOutputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Systems Comparison CSV (S0 through S5)
  const mainSystems = [
    { id: 'S0', name: 'S0: Raw Query Only (No Context)' },
    { id: 'S1', name: 'S1: Naive Concatenation of All History' },
    { id: 'S2', name: 'S2: TurnTrace Rewriter (Decayed Context, Cosine)' },
    { id: 'S3', name: 'S3: TurnTrace Full (Rewriter + Decompose + RRF)' },
    { id: 'S5', name: 'S5: Oracle Gold Rewrite' }
  ];

  let systemsCsv = 'System_ID,System_Description,P@5,P@10,Recall@20,MRR,nDCG@10\n';
  for (const sys of mainSystems) {
    const res = benchmarkResults[sys.id]?.overall;
    if (res) {
      systemsCsv += `${sys.id},"${sys.name}",${res.p5},${res.p10},${res.recall20},${res.mrr},${res.ndcg10}\n`;
    }
  }
  fs.writeFileSync(path.join(outputDir, 'systems_comparison.csv'), systemsCsv, 'utf-8');

  // 2. Ablations Comparison CSV
  const ablations = [
    { id: 'S2', name: 'S2 Baseline (lnc.ltc Cosine, Decay on, Shift on)' },
    { id: 'A1', name: 'Ablation A1: Okapi BM25 Scoring Model' },
    { id: 'A2', name: 'Ablation A2: Topic-Shift Detector OFF' },
    { id: 'A3', name: 'Ablation A3: Exponential Context Decay OFF (lambda=1.0)' },
    { id: 'A4', name: 'Ablation A4: Decomposer Rank Fusion OFF' },
    { id: 'R1', name: 'Ablation R1: Champion Lists ON' },
    { id: 'R2', name: 'Ablation R2: Index Elimination ON' }
  ];

  let ablationsCsv = 'Ablation_ID,Configuration,P@5,P@10,Recall@20,MRR,nDCG@10\n';
  for (const abl of ablations) {
    const res = benchmarkResults[abl.id]?.overall;
    if (res) {
      ablationsCsv += `${abl.id},"${abl.name}",${res.p5},${res.p10},${res.recall20},${res.mrr},${res.ndcg10}\n`;
    }
  }
  fs.writeFileSync(path.join(outputDir, 'ablations_comparison.csv'), ablationsCsv, 'utf-8');

  // 3. Cohort Breakdown CSV: Turn 1 vs Later Turns vs Topic-Shift Turns
  let cohortCsv = 'System_ID,Cohort,Turn_Count,P@5,P@10,Recall@20,MRR,nDCG@10\n';
  for (const sys of ['S0', 'S1', 'S2', 'S3', 'S5']) {
    const data = benchmarkResults[sys];
    if (data) {
      cohortCsv += `${sys},Turn 1 Only,${data.turn1Only.count},${data.turn1Only.p5},${data.turn1Only.p10},${data.turn1Only.recall20},${data.turn1Only.mrr},${data.turn1Only.ndcg10}\n`;
      cohortCsv += `${sys},Later Turns (2+),${data.laterTurns.count},${data.laterTurns.p5},${data.laterTurns.p10},${data.laterTurns.recall20},${data.laterTurns.mrr},${data.laterTurns.ndcg10}\n`;
      cohortCsv += `${sys},Topic-Shift Turns,${data.topicShiftTurns.count},${data.topicShiftTurns.p5},${data.topicShiftTurns.p10},${data.topicShiftTurns.recall20},${data.topicShiftTurns.mrr},${data.topicShiftTurns.ndcg10}\n`;
    }
  }
  fs.writeFileSync(path.join(outputDir, 'turn_breakdown.csv'), cohortCsv, 'utf-8');

  // 4. Generate SVG Metrics Chart
  const svgChart = generateSvgChart(benchmarkResults);
  fs.writeFileSync(path.join(outputDir, 'metrics_chart.svg'), svgChart, 'utf-8');

  console.log(`[TurnTrace Exporter] Successfully exported evaluation CSVs and SVG chart to ${outputDir}`);
}

/**
 * Generates an SVG bar chart comparing nDCG@10 and MRR across systems S0 through S5.
 */
function generateSvgChart(results) {
  const systems = ['S0', 'S1', 'S2', 'S3', 'S5'];
  const labels = ['S0 (Raw)', 'S1 (Concat)', 'S2 (Rewriter)', 'S3 (TurnTrace)', 'S5 (Oracle)'];
  const ndcgValues = systems.map(s => results[s]?.overall.ndcg10 || 0);
  const mrrValues = systems.map(s => results[s]?.overall.mrr || 0);

  const width = 800;
  const height = 450;
  const margin = { top: 60, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const barGroupWidth = chartWidth / systems.length;
  const barWidth = barGroupWidth * 0.35;

  let barsSvg = '';

  systems.forEach((sys, idx) => {
    const xGroup = margin.left + idx * barGroupWidth;
    const ndcg = ndcgValues[idx];
    const mrr = mrrValues[idx];

    const barHeightNdcg = ndcg * chartHeight;
    const yNdcg = margin.top + chartHeight - barHeightNdcg;

    const barHeightMrr = mrr * chartHeight;
    const yMrr = margin.top + chartHeight - barHeightMrr;

    // nDCG bar (Indigo)
    barsSvg += `
      <rect x="${xGroup + 10}" y="${yNdcg}" width="${barWidth}" height="${barHeightNdcg}" fill="#4f46e5" rx="3">
        <title>${sys} nDCG@10: ${ndcg}</title>
      </rect>
      <text x="${xGroup + 10 + barWidth / 2}" y="${yNdcg - 6}" font-size="11" text-anchor="middle" fill="#312e81" font-weight="600">${ndcg.toFixed(2)}</text>
    `;

    // MRR bar (Emerald)
    barsSvg += `
      <rect x="${xGroup + 15 + barWidth}" y="${yMrr}" width="${barWidth}" height="${barHeightMrr}" fill="#059669" rx="3">
        <title>${sys} MRR: ${mrr}</title>
      </rect>
      <text x="${xGroup + 15 + barWidth * 1.5}" y="${yMrr - 6}" font-size="11" text-anchor="middle" fill="#065f46" font-weight="600">${mrr.toFixed(2)}</text>
    `;

    // System X-axis label
    barsSvg += `
      <text x="${xGroup + barGroupWidth / 2}" y="${margin.top + chartHeight + 25}" font-size="12" text-anchor="middle" fill="#374151" font-weight="500">${labels[idx]}</text>
    `;
  });

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: Inter, system-ui, sans-serif;">
  <text x="${width / 2}" y="32" font-size="18" text-anchor="middle" font-weight="bold" fill="#111827">TurnTrace Retrieval Performance Benchmark (70 Judged Turns)</text>
  
  <!-- Legend -->
  <rect x="520" y="20" width="14" height="14" fill="#4f46e5" rx="2" />
  <text x="540" y="32" font-size="12" fill="#374151">nDCG@10</text>
  <rect x="630" y="20" width="14" height="14" fill="#059669" rx="2" />
  <text x="650" y="32" font-size="12" fill="#374151">MRR</text>

  <!-- Y-Axis Gridlines -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${width - margin.right}" y2="${margin.top}" stroke="#e5e7eb" stroke-dasharray="4" />
  <text x="${margin.left - 10}" y="${margin.top + 4}" font-size="11" text-anchor="end" fill="#6b7280">1.0</text>
  
  <line x1="${margin.left}" y1="${margin.top + chartHeight * 0.25}" x2="${width - margin.right}" y2="${margin.top + chartHeight * 0.25}" stroke="#e5e7eb" stroke-dasharray="4" />
  <text x="${margin.left - 10}" y="${margin.top + chartHeight * 0.25 + 4}" font-size="11" text-anchor="end" fill="#6b7280">0.75</text>

  <line x1="${margin.left}" y1="${margin.top + chartHeight * 0.5}" x2="${width - margin.right}" y2="${margin.top + chartHeight * 0.5}" stroke="#e5e7eb" stroke-dasharray="4" />
  <text x="${margin.left - 10}" y="${margin.top + chartHeight * 0.5 + 4}" font-size="11" text-anchor="end" fill="#6b7280">0.50</text>

  <line x1="${margin.left}" y1="${margin.top + chartHeight * 0.75}" x2="${width - margin.right}" y2="${margin.top + chartHeight * 0.75}" stroke="#e5e7eb" stroke-dasharray="4" />
  <text x="${margin.left - 10}" y="${margin.top + chartHeight * 0.75 + 4}" font-size="11" text-anchor="end" fill="#6b7280">0.25</text>

  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#9ca3af" stroke-width="1.5" />
  <text x="${margin.left - 10}" y="${margin.top + chartHeight + 4}" font-size="11" text-anchor="end" fill="#6b7280">0.0</text>

  <!-- Bars -->
  ${barsSvg}
</svg>
  `.trim();
}
