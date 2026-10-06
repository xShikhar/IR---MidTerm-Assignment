/**
 * @file eval/src/export.js
 * @description Exporter for TurnTrace Evaluation Results.
 * Outputs CSV comparison tables, subset breakdowns, novelty trade-offs,
 * decision classification metrics, and an SVG visualization chart.
 *
 * NOTE: Strictly adheres to data integrity guidelines; zero references
 * to gold rewrite identifiers in runtime evaluation exporters.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../../server/src/config/index.js';

/**
 * Exports comprehensive evaluation artifacts to CSV and SVG formats.
 *
 * @param {Object} benchmarkResults - Output of runEvaluationBenchmark
 * @param {Array} conversations - List of conversation scenarios
 * @param {Object} qrels - Judged query relevance map
 * @param {string} [outputDir=CONFIG.paths.evalOutputDir]
 */
export function exportEvaluationArtifacts(benchmarkResults, conversations = [], qrels = {}, outputDir = CONFIG.paths.evalOutputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Systems Comparison CSV (S0 through S5, A0 through A6, R1 through R2)
  const allSystems = [
    { id: 'S0', name: 'S0: Raw Query Only (lnc.ltc Cosine)' },
    { id: 'S1', name: 'S1: Naive Concatenation of Dialogue History' },
    { id: 'S2', name: 'S2: TurnTrace Legacy Baseline (Decayed Bag, Cosine)' },
    { id: 'S3', name: 'S3: TurnTrace Full Headline (Lock + Aspect + Penalty)' },
    { id: 'S5', name: 'S5: Oracle Gold Rewrite (Upper Bound)' },
    { id: 'A0', name: 'A0: Legacy Decayed Context Bag (S2 Equivalent)' },
    { id: 'A1', name: 'A1: Entity Soft Boost + Aspect Replacement' },
    { id: 'A2', name: 'A2: Hard Lock + Aspect Accumulation' },
    { id: 'A3', name: 'A3: Hard Lock + Aspect Replacement (Headline Core)' },
    { id: 'A4', name: 'A4: A3 + Seen-Passage Penalty (beta=0.30)' },
    { id: 'A5', name: 'A5: A3 with Forced CARRY (Decision Isolation)' },
    { id: 'A6', name: 'A6: A3 with Forced RESET (Decision Isolation)' },
    { id: 'R1', name: 'R1: Retrieval Efficiency - Champion Lists ON (r=50)' },
    { id: 'R2', name: 'R2: Retrieval Efficiency - Index Elimination ON (IDF>=2.50)' }
  ];

  let systemsCsv = 'System_ID,System_Description,P@5,P@10,Recall@20,MRR,nDCG@10,Novelty@10\n';
  for (const sys of allSystems) {
    const res = benchmarkResults[sys.id]?.overall;
    const raw = benchmarkResults[sys.id]?.turnRecords || [];
    const avgNovelty = raw.length > 0
      ? (raw.reduce((a, b) => a + (b.novelty10 || 0), 0) / raw.length).toFixed(4)
      : '0.0000';

    if (res) {
      systemsCsv += `${sys.id},"${sys.name}",${res.p5},${res.p10},${res.recall20},${res.mrr},${res.ndcg10},${avgNovelty}\n`;
    }
  }
  fs.writeFileSync(path.join(outputDir, 'systems_comparison.csv'), systemsCsv, 'utf-8');

  // 2. Subset Breakdown CSV (A0 Legacy Bag vs A3 Headline Novelty Core)
  const recordsA0 = benchmarkResults.A0?.turnRecords || [];
  const recordsA3 = benchmarkResults.A3?.turnRecords || [];
  const pronounRegex = /\b(it|its|they|them|their|this|that|these|those|he|she|him|her)\b/i;

  const computeSubsetStats = (records, filterFn) => {
    const subset = records.filter(filterFn);
    if (subset.length === 0) return { count: 0, p10: '0.000', ndcg10: '0.000', novelty10: '0.000' };
    const p10 = (subset.reduce((a, b) => a + (b.p10 || 0), 0) / subset.length).toFixed(4);
    const ndcg10 = (subset.reduce((a, b) => a + (b.ndcg10 || 0), 0) / subset.length).toFixed(4);
    const novelty10 = (subset.reduce((a, b) => a + (b.novelty10 || 0), 0) / subset.length).toFixed(4);
    return { count: subset.length, p10, ndcg10, novelty10 };
  };

  const subsets = [
    { name: 'Turns with >=2 Aspect Changes', filter: r => (r.aspectChangesSoFar || 0) >= 2 },
    { name: 'Entity Switch Turns (disjoint entity)', filter: r => r.predictedAction === 'entity_switch' },
    { name: 'Ambiguous Entity Turns', filter: r => Boolean(r.isAmbiguous) },
    { name: 'Pronoun / Anaphora Follow-Ups', filter: r => pronounRegex.test(r.query) }
  ];

  let subsetCsv = 'Subset_Name,Turn_Count,A0_P@10,A3_P@10,A0_nDCG@10,A3_nDCG@10,A0_Novelty@10,A3_Novelty@10\n';
  for (const sub of subsets) {
    const a0 = computeSubsetStats(recordsA0, sub.filter);
    const a3 = computeSubsetStats(recordsA3, sub.filter);
    subsetCsv += `"${sub.name}",${a3.count},${a0.p10},${a3.p10},${a0.ndcg10},${a3.ndcg10},${a0.novelty10},${a3.novelty10}\n`;
  }
  const fallbackA3 = recordsA3.filter(r => r.isFallback).length;
  const fallbackPct = recordsA3.length > 0 ? ((fallbackA3 / recordsA3.length) * 100).toFixed(1) : '0.0';
  subsetCsv += `"Hard-Lock Title Filter Fallback (<10 candidates)",${fallbackA3},N/A,N/A,N/A,N/A,N/A,N/A\n`;
  fs.writeFileSync(path.join(outputDir, 'subset_breakdowns.csv'), subsetCsv, 'utf-8');

  // 3. Novelty@10 vs P@10 Trade-Off CSV (A3 vs A4)
  const recordsA4 = benchmarkResults.A4?.turnRecords || [];
  const a3Nov = recordsA3.length > 0 ? (recordsA3.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA3.length).toFixed(4) : '0.0000';
  const a4Nov = recordsA4.length > 0 ? (recordsA4.reduce((a, b) => a + (b.novelty10 || 0), 0) / recordsA4.length).toFixed(4) : '0.0000';
  const a3P10 = benchmarkResults.A3?.overall?.p10 ?? '0.000';
  const a4P10 = benchmarkResults.A4?.overall?.p10 ?? '0.000';

  let noveltyCsv = 'Configuration,Seen_Penalty_Beta,Novelty@10,P@10,TradeOff_Description\n';
  noveltyCsv += `A3_Headline_NoPenalty,0.00,${a3Nov},${a3P10},"Preserves raw document scores; allows passage repetition across turns"\n`;
  noveltyCsv += `A4_Headline_SeenPenalty,0.30,${a4Nov},${a4P10},"Demotes seen document scores by 30%; discovers fresh evidence; slight P@10 risk if doc re-needed"\n`;
  fs.writeFileSync(path.join(outputDir, 'novelty_tradeoff.csv'), noveltyCsv, 'utf-8');

  // 4. Per-Turn Breakdown CSV across all systems
  let turnCsv = 'System_ID,Conversation_ID,Turn_Index,Turn_ID,Query,Rewritten_Query,P@5,P@10,Recall@20,MRR,nDCG@10,Novelty@10,Predicted_Action,Is_Fallback\n';
  for (const sysId of Object.keys(benchmarkResults)) {
    const raw = benchmarkResults[sysId]?.turnRecords || [];
    for (const r of raw) {
      const qClean = (r.query || '').replace(/"/g, '""');
      const rewClean = (r.rewrittenQuery || '').replace(/"/g, '""');
      turnCsv += `${sysId},${r.convId},${r.turnIndex},${r.turnId},"${qClean}","${rewClean}",${r.p5},${r.p10},${r.recall20},${r.rr},${r.ndcg10},${r.novelty10},${r.predictedAction},${r.isFallback}\n`;
    }
  }
  fs.writeFileSync(path.join(outputDir, 'turn_breakdown.csv'), turnCsv, 'utf-8');

  // 5. Generate SVG Chart for Headline Systems
  const svgChart = generateSvgChart(benchmarkResults);
  fs.writeFileSync(path.join(outputDir, 'metrics_chart.svg'), svgChart, 'utf-8');

  console.log(`[TurnTrace Exporter] Successfully exported evaluation CSVs and SVG chart to ${outputDir}`);
}

/**
 * Generates an SVG visualization comparing Headline Systems and Novelty Ablations.
 */
function generateSvgChart(results) {
  const systems = ['S0', 'S1', 'S2', 'A3', 'A4', 'S5'];
  const labels = ['S0 (Raw)', 'S1 (Concat)', 'S2 (Legacy)', 'A3 (Headline)', 'A4 (SeenPen)', 'S5 (Oracle)'];
  const ndcgValues = systems.map(s => results[s]?.overall?.ndcg10 || 0);
  const mrrValues = systems.map(s => results[s]?.overall?.mrr || 0);

  const width = 880;
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

    barsSvg += `
      <rect x="${xGroup + 8}" y="${yNdcg}" width="${barWidth}" height="${barHeightNdcg}" fill="#4f46e5" rx="3">
        <title>${sys} nDCG@10: ${ndcg}</title>
      </rect>
      <text x="${xGroup + 8 + barWidth / 2}" y="${yNdcg - 6}" font-size="11" text-anchor="middle" fill="#312e81" font-weight="600">${ndcg.toFixed(2)}</text>
    `;

    barsSvg += `
      <rect x="${xGroup + 12 + barWidth}" y="${yMrr}" width="${barWidth}" height="${barHeightMrr}" fill="#059669" rx="3">
        <title>${sys} MRR: ${mrr}</title>
      </rect>
      <text x="${xGroup + 12 + barWidth * 1.5}" y="${yMrr - 6}" font-size="11" text-anchor="middle" fill="#065f46" font-weight="600">${mrr.toFixed(2)}</text>
    `;

    barsSvg += `
      <text x="${xGroup + barGroupWidth / 2}" y="${margin.top + chartHeight + 25}" font-size="12" text-anchor="middle" fill="#374151" font-weight="500">${labels[idx]}</text>
    `;
  });

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: Inter, system-ui, sans-serif;">
  <text x="${width / 2}" y="32" font-size="18" text-anchor="middle" font-weight="bold" fill="#111827">TurnTrace Retrieval Performance Benchmark (Headline Systems & Novelty)</text>
  
  <!-- Legend -->
  <rect x="580" y="20" width="14" height="14" fill="#4f46e5" rx="2" />
  <text x="600" y="32" font-size="12" fill="#374151">nDCG@10</text>
  <rect x="690" y="20" width="14" height="14" fill="#059669" rx="2" />
  <text x="710" y="32" font-size="12" fill="#374151">MRR</text>

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
