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
export function exportEvaluationArtifacts(benchmarkResults, conversations = [], qrels = {}, outputDir = CONFIG.paths.evalOutputDir, extraData = {}) {
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

  let systemsCsv = 'System_ID,System_Description,P@5,P@10,Recall@20,MRR,nDCG@10,Novelty@10,Bootstrap_p_vs_A0,Wilcoxon_p_vs_A0,Sample_Size_n\n';
  const sigMap = extraData.systemSignificanceMap || {};

  for (const sys of allSystems) {
    const res = benchmarkResults[sys.id]?.overall;
    const raw = benchmarkResults[sys.id]?.turnRecords || [];
    const avgNovelty = raw.length > 0
      ? (raw.reduce((a, b) => a + (b.novelty10 || 0), 0) / raw.length).toFixed(4)
      : '0.0000';
    const sigInfo = sigMap[sys.id] || { bootP: '-', wilcP: '-', n: raw.length };

    if (res) {
      systemsCsv += `${sys.id},"${sys.name}",${res.p5},${res.p10},${res.recall20},${res.mrr},${res.ndcg10},${avgNovelty},${sigInfo.bootP},${sigInfo.wilcP},${sigInfo.n}\n`;
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

  // 5. Significance Tests CSV
  if (Array.isArray(extraData.significanceRows) && extraData.significanceRows.length > 0) {
    let sigCsv = 'Comparison,Metric,Delta,Bootstrap_pValue,95_CI_Lower,95_CI_Upper,Wilcoxon_pValue,W_stat,NonZero_Pairs,Sample_Size_n,Is_Significant\n';
    for (const row of extraData.significanceRows) {
      sigCsv += `"${row.comparison}","${row.metric}",${row.delta},${row.bootstrapP},${row.ciLower},${row.ciUpper},${row.wilcoxonP},${row.wStat},${row.nonZeroPairs},${row.n},${row.isSignificant}\n`;
    }
    fs.writeFileSync(path.join(outputDir, 'significance_tests.csv'), sigCsv, 'utf-8');
  }

  // 6. Decision Metrics CSV
  if (Array.isArray(extraData.decisionRows) && extraData.decisionRows.length > 0) {
    let decCsv = 'Detector,Class,Precision,Recall,F1,Support,Macro_F1,Accuracy\n';
    for (const r of extraData.decisionRows) {
      decCsv += `"${r.detector}","${r.cls}",${r.precision},${r.recall},${r.f1},${r.support},${r.macroF1},${r.accuracy}\n`;
    }
    fs.writeFileSync(path.join(outputDir, 'decision_metrics.csv'), decCsv, 'utf-8');
  }

  // 7. Clarifier Metrics CSV
  if (Array.isArray(extraData.clarifierRows) && extraData.clarifierRows.length > 0) {
    let clarCsv = 'Method,Total_Turns,Fired_Count,Fired_Pct,False_Positive_Rate,Description\n';
    for (const r of extraData.clarifierRows) {
      clarCsv += `"${r.method}",${r.totalTurns},${r.firedCount},${r.firedPct},${r.fpRate},"${r.description}"\n`;
    }
    fs.writeFileSync(path.join(outputDir, 'clarifier_metrics.csv'), clarCsv, 'utf-8');
  }

  // 8. 5 Worst A3-vs-A0 Turns CSV
  if (Array.isArray(extraData.worstTurns) && extraData.worstTurns.length > 0) {
    let worstCsv = 'Rank,Turn_Key,Conversation_ID,Turn_ID,Query,A0_nDCG10,A3_nDCG10,Delta_nDCG10,Failure_Mode,Root_Cause\n';
    for (const w of extraData.worstTurns) {
      const qClean = (w.query || '').replace(/"/g, '""');
      const failClean = (w.failureMode || '').replace(/"/g, '""');
      const rootClean = (w.rootCause || '').replace(/"/g, '""');
      worstCsv += `${w.rank},"${w.turnKey}","${w.convId}",${w.turnId},"${qClean}",${w.a0Ndcg10},${w.a3Ndcg10},${w.deltaNdcg10},"${failClean}","${rootClean}"\n`;
    }
    fs.writeFileSync(path.join(outputDir, 'worst_turns_a3_vs_a0.csv'), worstCsv, 'utf-8');
  }

  // 9. Generate SVG Charts
  const svgMetricsChart = generateSvgChart(benchmarkResults);
  fs.writeFileSync(path.join(outputDir, 'metrics_chart.svg'), svgMetricsChart, 'utf-8');

  const svgRetrievalTradeoffs = generateRetrievalTradeoffsSvg(benchmarkResults);
  fs.writeFileSync(path.join(outputDir, 'retrieval_tradeoffs.svg'), svgRetrievalTradeoffs, 'utf-8');

  const svgNoveltyTradeoff = generateNoveltyTradeoffSvg(recordsA3, recordsA4, a3Nov, a4Nov, a3P10, a4P10);
  fs.writeFileSync(path.join(outputDir, 'novelty_tradeoff.svg'), svgNoveltyTradeoff, 'utf-8');

  console.log(`[TurnTrace Exporter] Successfully exported evaluation CSVs and SVG charts to ${outputDir}`);
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

/**
 * Generates an SVG scatter/bubble plot for Retrieval Trade-Offs (P@10 vs Novelty@10).
 */
function generateRetrievalTradeoffsSvg(results) {
  const systems = ['S0', 'S1', 'S2', 'S5', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'R1', 'R2'];
  const width = 880;
  const height = 500;
  const margin = { top: 60, right: 60, bottom: 60, left: 70 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  let pointsSvg = '';

  systems.forEach(sysId => {
    const raw = results[sysId]?.turnRecords || [];
    const avgNov = raw.length > 0 ? raw.reduce((a, b) => a + (b.novelty10 || 0), 0) / raw.length : 0;
    const p10 = results[sysId]?.overall?.p10 || 0;
    const ndcg = results[sysId]?.overall?.ndcg10 || 0;

    // Coordinate mapping: Novelty [0.5, 1.0] -> X; P@10 [0.0, 1.0] -> Y
    const xNorm = Math.max(0, Math.min(1, (avgNov - 0.50) / 0.50));
    const cx = margin.left + xNorm * chartW;
    const cy = margin.top + chartH - (p10 * chartH);

    // Color code by system family
    let fill = '#6366f1';
    if (sysId.startsWith('S')) fill = '#475569';
    if (sysId === 'S5') fill = '#10b981';
    if (sysId === 'A3') fill = '#2563eb';
    if (sysId === 'A4') fill = '#7c3aed';
    if (sysId.startsWith('R')) fill = '#f59e0b';

    pointsSvg += `
      <g>
        <circle cx="${cx}" cy="${cy}" r="9" fill="${fill}" fill-opacity="0.85" stroke="#ffffff" stroke-width="2">
          <title>${sysId}: Novelty=${avgNov.toFixed(3)}, P@10=${p10.toFixed(3)}, nDCG@10=${ndcg.toFixed(3)}</title>
        </circle>
        <text x="${cx}" y="${cy - 13}" font-size="11" font-weight="600" text-anchor="middle" fill="#1e293b">${sysId}</text>
      </g>
    `;
  });

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: Inter, system-ui, sans-serif;">
  <text x="${width / 2}" y="32" font-size="18" text-anchor="middle" font-weight="bold" fill="#111827">Retrieval Trade-Offs: Precision@10 vs. Novelty@10 Discovery</text>
  
  <!-- Axes and Grid -->
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartH}" stroke="#9ca3af" stroke-width="1.5" />
  <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#9ca3af" stroke-width="1.5" />

  <!-- Y-Axis labels (P@10) -->
  <text x="${margin.left - 45}" y="${margin.top + chartH / 2}" font-size="13" font-weight="600" fill="#374151" transform="rotate(-90 ${margin.left - 45} ${margin.top + chartH / 2})" text-anchor="middle">Precision@10</text>
  <text x="${margin.left - 10}" y="${margin.top + 5}" font-size="11" text-anchor="end" fill="#6b7280">1.0</text>
  <text x="${margin.left - 10}" y="${margin.top + chartH * 0.5 + 5}" font-size="11" text-anchor="end" fill="#6b7280">0.5</text>
  <text x="${margin.left - 10}" y="${margin.top + chartH + 5}" font-size="11" text-anchor="end" fill="#6b7280">0.0</text>

  <!-- X-Axis labels (Novelty@10) -->
  <text x="${margin.left + chartW / 2}" y="${margin.top + chartH + 45}" font-size="13" font-weight="600" fill="#374151" text-anchor="middle">Novelty@10 (Fresh Passages Ratio)</text>
  <text x="${margin.left}" y="${margin.top + chartH + 20}" font-size="11" text-anchor="middle" fill="#6b7280">0.50</text>
  <text x="${margin.left + chartW * 0.5}" y="${margin.top + chartH + 20}" font-size="11" text-anchor="middle" fill="#6b7280">0.75</text>
  <text x="${margin.left + chartW}" y="${margin.top + chartH + 20}" font-size="11" text-anchor="middle" fill="#6b7280">1.00</text>

  <!-- Horizontal Gridlines -->
  <line x1="${margin.left}" y1="${margin.top + chartH * 0.25}" x2="${margin.left + chartW}" y2="${margin.top + chartH * 0.25}" stroke="#f1f5f9" stroke-dasharray="3" />
  <line x1="${margin.left}" y1="${margin.top + chartH * 0.50}" x2="${margin.left + chartW}" y2="${margin.top + chartH * 0.50}" stroke="#f1f5f9" stroke-dasharray="3" />
  <line x1="${margin.left}" y1="${margin.top + chartH * 0.75}" x2="${margin.left + chartW}" y2="${margin.top + chartH * 0.75}" stroke="#f1f5f9" stroke-dasharray="3" />

  <!-- Data Points -->
  ${pointsSvg}
</svg>
  `.trim();
}

/**
 * Generates an SVG bar chart visualizing the Novelty vs Precision Trade-Off (A3 vs A4).
 */
function generateNoveltyTradeoffSvg(recordsA3, recordsA4, a3Nov, a4Nov, a3P10, a4P10) {
  const width = 720;
  const height = 380;
  const margin = { top: 60, right: 40, bottom: 60, left: 60 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;

  const novA3Num = parseFloat(a3Nov) || 0;
  const novA4Num = parseFloat(a4Nov) || 0;
  const p10A3Num = parseFloat(a3P10) || 0;
  const p10A4Num = parseFloat(a4P10) || 0;

  return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: Inter, system-ui, sans-serif;">
  <text x="${width / 2}" y="32" font-size="18" text-anchor="middle" font-weight="bold" fill="#111827">Seen-Passage Penalty Trade-Off: A3 (Beta=0) vs. A4 (Beta=0.30)</text>

  <!-- Group A3 -->
  <g transform="translate(${margin.left + chartW * 0.15}, 0)">
    <text x="80" y="${margin.top + chartH + 25}" font-size="13" font-weight="600" text-anchor="middle" fill="#1e293b">A3: Headline (No Penalty)</text>
    <!-- Novelty Bar -->
    <rect x="20" y="${margin.top + chartH - (novA3Num * chartH)}" width="50" height="${novA3Num * chartH}" fill="#3b82f6" rx="4" />
    <text x="45" y="${margin.top + chartH - (novA3Num * chartH) - 8}" font-size="11" font-weight="600" text-anchor="middle" fill="#1e40af">${novA3Num.toFixed(3)}</text>
    <text x="45" y="${margin.top + chartH + 42}" font-size="10" text-anchor="middle" fill="#64748b">Novelty@10</text>
    <!-- P@10 Bar -->
    <rect x="90" y="${margin.top + chartH - (p10A3Num * chartH)}" width="50" height="${p10A3Num * chartH}" fill="#10b981" rx="4" />
    <text x="115" y="${margin.top + chartH - (p10A3Num * chartH) - 8}" font-size="11" font-weight="600" text-anchor="middle" fill="#065f46">${p10A3Num.toFixed(3)}</text>
    <text x="115" y="${margin.top + chartH + 42}" font-size="10" text-anchor="middle" fill="#64748b">P@10</text>
  </g>

  <!-- Group A4 -->
  <g transform="translate(${margin.left + chartW * 0.58}, 0)">
    <text x="80" y="${margin.top + chartH + 25}" font-size="13" font-weight="600" text-anchor="middle" fill="#1e293b">A4: Seen-Penalty (Beta=0.30)</text>
    <!-- Novelty Bar -->
    <rect x="20" y="${margin.top + chartH - (novA4Num * chartH)}" width="50" height="${novA4Num * chartH}" fill="#8b5cf6" rx="4" />
    <text x="45" y="${margin.top + chartH - (novA4Num * chartH) - 8}" font-size="11" font-weight="600" text-anchor="middle" fill="#5b21b6">${novA4Num.toFixed(3)}</text>
    <text x="45" y="${margin.top + chartH + 42}" font-size="10" text-anchor="middle" fill="#64748b">Novelty@10</text>
    <!-- P@10 Bar -->
    <rect x="90" y="${margin.top + chartH - (p10A4Num * chartH)}" width="50" height="${p10A4Num * chartH}" fill="#10b981" rx="4" />
    <text x="115" y="${margin.top + chartH - (p10A4Num * chartH) - 8}" font-size="11" font-weight="600" text-anchor="middle" fill="#065f46">${p10A4Num.toFixed(3)}</text>
    <text x="115" y="${margin.top + chartH + 42}" font-size="10" text-anchor="middle" fill="#64748b">P@10</text>
  </g>

  <!-- Y-Axis Baseline -->
  <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#9ca3af" stroke-width="1.5" />
</svg>
  `.trim();
}
