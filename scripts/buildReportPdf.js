import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to load SVGs
function loadSvg(relPath) {
  const p = path.join(rootDir, relPath);
  if (fs.existsSync(p)) {
    return fs.readFileSync(p, 'utf8');
  }
  return '';
}

// Convert markdown tables to clean HTML tables
function markdownTableToHtml(mdTable) {
  const lines = mdTable.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return '';

  const headerLine = lines[0];
  const alignLine = lines[1];
  const bodyLines = lines.slice(2);

  const parseCells = (line) => {
    const raw = line.replace(/^\|/, '').replace(/\|$/, '');
    return raw.split('|').map(c => c.trim());
  };

  const headers = parseCells(headerLine);
  const aligns = parseCells(alignLine).map(c => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });

  let html = '<div class="table-container"><table><thead><tr>';
  headers.forEach((h, i) => {
    const align = aligns[i] || 'left';
    html += `<th style="text-align: ${align}">${formatInline(h)}</th>`;
  });
  html += '</tr></thead><tbody>';

  bodyLines.forEach(row => {
    const cells = parseCells(row);
    html += '<tr>';
    cells.forEach((c, i) => {
      const align = aligns[i] || 'left';
      html += `<td style="text-align: ${align}">${formatInline(c)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

// Inline formatting (bold, italic, code, math)
function formatInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\$([^\$]+)\$/g, '<span class="math">$1</span>');
}

// Vector Pipeline Diagram SVG
const PIPELINE_SVG = `
<div class="pipeline-card" style="margin: 8px 0; page-break-inside: avoid; break-inside: avoid;">
<svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-height: 185px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
    </marker>
  </defs>
  <!-- Offline Indexing Track -->
  <rect x="5" y="5" width="790" height="82" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="3"/>
  <text x="18" y="22" font-size="9.5" font-weight="700" fill="#475569">STAGE 1: OFFLINE PREPROCESSING & MULTI-ZONE INDEXING</text>
  
  <rect x="18" y="32" width="140" height="42" rx="5" fill="#ffffff" stroke="#6366f1" stroke-width="1.2"/>
  <text x="88" y="50" font-size="9" font-weight="700" text-anchor="middle" fill="#1e1b4b">Wikipedia Corpus</text>
  <text x="88" y="64" font-size="7.5" text-anchor="middle" fill="#64748b">35k Passages (4 Domains)</text>

  <line x1="158" y1="53" x2="188" y2="53" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="188" y="32" width="150" height="42" rx="5" fill="#ffffff" stroke="#6366f1" stroke-width="1.2"/>
  <text x="263" y="50" font-size="9" font-weight="700" text-anchor="middle" fill="#1e1b4b">Lexical Analysis</text>
  <text x="263" y="64" font-size="7.5" text-anchor="middle" fill="#64748b">Porter (1980) + Positional Offsets</text>

  <line x1="338" y1="53" x2="368" y2="53" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="368" y="32" width="165" height="42" rx="5" fill="#ffffff" stroke="#6366f1" stroke-width="1.2"/>
  <text x="450" y="50" font-size="9" font-weight="700" text-anchor="middle" fill="#1e1b4b">Multi-Zone Postings</text>
  <text x="450" y="64" font-size="7.5" text-anchor="middle" fill="#64748b">Title (0.35) & Body (0.65) DF</text>

  <line x1="533" y1="53" x2="563" y2="53" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="563" y="32" width="220" height="42" rx="5" fill="#ffffff" stroke="#6366f1" stroke-width="1.2"/>
  <text x="673" y="50" font-size="9" font-weight="700" text-anchor="middle" fill="#1e1b4b">Index Statistics & Pruning</text>
  <text x="673" y="64" font-size="7.5" text-anchor="middle" fill="#64748b">Euclidean Norms, BM25 L_avg, Top-r Champs</text>

  <!-- Online Retrieval Track -->
  <rect x="5" y="98" width="790" height="92" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="3"/>
  <text x="18" y="115" font-size="9.5" font-weight="700" fill="#475569">STAGE 2: ONLINE CONVERSATIONAL RETRIEVAL & TRACE ASSEMBLY</text>

  <rect x="18" y="125" width="135" height="52" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
  <text x="85" y="144" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">Query Turn Q_k</text>
  <text x="85" y="157" font-size="7.5" text-anchor="middle" fill="#64748b">Pronouns & Ellipsis</text>
  <text x="85" y="169" font-size="7" text-anchor="middle" fill="#0369a1">Dialogue History Vector</text>

  <line x1="153" y1="151" x2="180" y2="151" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="180" y="125" width="170" height="52" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
  <text x="265" y="144" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">Decision Detector</text>
  <text x="265" y="157" font-size="7.5" text-anchor="middle" fill="#64748b">Entity Lock vs Aspect State</text>
  <text x="265" y="169" font-size="7" text-anchor="middle" fill="#0369a1">CARRY | ENTITY_SWITCH | RESET</text>

  <line x1="350" y1="151" x2="378" y2="151" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="378" y="125" width="165" height="52" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
  <text x="460" y="144" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">Hard-Lock Title Filter</text>
  <text x="460" y="157" font-size="7.5" text-anchor="middle" fill="#64748b">Boolean Intersection in Title Zone</text>
  <text x="460" y="169" font-size="7" text-anchor="middle" fill="#0369a1">Fallback: 2.0x Soft Boost if |C| &lt; 10</text>

  <line x1="543" y1="151" x2="570" y2="151" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="570" y="125" width="130" height="52" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
  <text x="635" y="144" font-size="9" font-weight="700" text-anchor="middle" fill="#0f172a">Core Scoring</text>
  <text x="635" y="157" font-size="7.5" text-anchor="middle" fill="#64748b">lnc.ltc / Okapi BM25</text>
  <text x="635" y="169" font-size="7" text-anchor="middle" fill="#0369a1">Heap Top-K + RRF Fusion</text>

  <line x1="700" y1="151" x2="720" y2="151" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="720" y="125" width="70" height="52" rx="5" fill="#4f46e5" stroke="#4338ca" stroke-width="1.2"/>
  <text x="755" y="144" font-size="8.5" font-weight="700" text-anchor="middle" fill="#ffffff">Results</text>
  <text x="755" y="157" font-size="7" text-anchor="middle" fill="#e0e7ff">Seen Penalty</text>
  <text x="755" y="169" font-size="6.5" text-anchor="middle" fill="#c7d2fe">&lt;10ms Trace</text>
</svg>
<div style="font-size: 6.8pt; color: #64748b; text-align: center; margin-top: 2px;">Figure 1: Full Architectural Pipeline of TurnTrace from Offline Multi-Zone Indexing to Online Conversational Retrieval.</div>
</div>
`;

// Vector Decision State Machine SVG
const DECISION_SVG = `
<div class="decision-card" style="margin: 6px 0; page-break-inside: avoid; break-inside: avoid;">
<svg viewBox="0 0 760 125" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-height: 115px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <rect x="5" y="5" width="750" height="115" rx="5" fill="#f8fafc" stroke="#cbd5e1"/>
  
  <rect x="15" y="16" width="190" height="34" rx="4" fill="#ffffff" stroke="#4f46e5" stroke-width="1.2"/>
  <text x="110" y="31" font-size="8.5" font-weight="700" text-anchor="middle" fill="#1e1b4b">Incoming User Turn Q_k</text>
  <text x="110" y="43" font-size="7" text-anchor="middle" fill="#64748b">Pronoun, Entity & Overlap Extraction</text>

  <line x1="205" y1="33" x2="235" y2="33" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <rect x="235" y="12" width="225" height="42" rx="4" fill="#ffffff" stroke="#4f46e5" stroke-width="1.2"/>
  <text x="347" y="27" font-size="8.5" font-weight="700" text-anchor="middle" fill="#1e1b4b">Guarded Decision Detector</text>
  <text x="347" y="39" font-size="7" text-anchor="middle" fill="#64748b">G1: Pronoun / Anaphora ('it', 'its') -> CARRY</text>
  <text x="347" y="49" font-size="7" text-anchor="middle" fill="#64748b">G2: Locked Entity Stem In Query -> CARRY</text>

  <line x1="460" y1="33" x2="490" y2="33" stroke="#475569" stroke-width="1.2" marker-end="url(#arrow)"/>

  <!-- Three Outgoing Branches -->
  <rect x="490" y="10" width="80" height="28" rx="3" fill="#ecfdf5" stroke="#059669" stroke-width="1"/>
  <text x="530" y="22" font-size="7.5" font-weight="700" text-anchor="middle" fill="#065f46">CARRY</text>
  <text x="530" y="33" font-size="6.5" text-anchor="middle" fill="#047857">Aspect Replace</text>

  <rect x="490" y="44" width="80" height="28" rx="3" fill="#fffbeb" stroke="#d97706" stroke-width="1"/>
  <text x="530" y="56" font-size="7.5" font-weight="700" text-anchor="middle" fill="#92400e">SWITCH</text>
  <text x="530" y="67" font-size="6.5" text-anchor="middle" fill="#b45309">Update Entity</text>

  <rect x="490" y="78" width="80" height="28" rx="3" fill="#fef2f2" stroke="#dc2626" stroke-width="1"/>
  <text x="530" y="90" font-size="7.5" font-weight="700" text-anchor="middle" fill="#991b1b">RESET</text>
  <text x="530" y="101" font-size="6.5" text-anchor="middle" fill="#b91c1c">Purge Context</text>

  <line x1="570" y1="24" x2="600" y2="24" stroke="#475569" stroke-width="1" marker-end="url(#arrow)"/>
  <line x1="570" y1="58" x2="600" y2="58" stroke="#475569" stroke-width="1" marker-end="url(#arrow)"/>
  <line x1="570" y1="92" x2="600" y2="92" stroke="#475569" stroke-width="1" marker-end="url(#arrow)"/>

  <rect x="600" y="14" width="145" height="92" rx="4" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
  <text x="672" y="32" font-size="8" font-weight="700" text-anchor="middle" fill="#0f172a">Constraint Execution</text>
  <text x="672" y="47" font-size="7" text-anchor="middle" fill="#334155">• Hard Title Intersect</text>
  <text x="672" y="60" font-size="7" text-anchor="middle" fill="#334155">• Fallback if |C| &lt; 10</text>
  <text x="672" y="73" font-size="7" text-anchor="middle" fill="#334155">• Seen Penalty (beta=0.30)</text>
  <text x="672" y="86" font-size="7" text-anchor="middle" fill="#0369a1">+21.6% Novelty Discovery</text>
</svg>
<div style="font-size: 6.8pt; color: #64748b; text-align: center; margin-top: 1px;">Figure 2: Guarded Decision Detector and Transition Taxonomy (CARRY, ENTITY_SWITCH, RESET).</div>
</div>
`;

// Clean markdown parser with diagram interception
function parseMarkdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let tableBuffer = [];
  let inCode = false;
  let codeBuffer = [];
  let codeLang = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCode) {
        if (codeLang === 'mermaid') {
          html += PIPELINE_SVG;
        } else if (codeBuffer.some(l => l.includes('Incoming User Turn') || l.includes('Decision Detector'))) {
          html += DECISION_SVG;
        } else {
          html += `<pre><code>${codeBuffer.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        }
        codeBuffer = [];
        inCode = false;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        if (inTable) { html += markdownTableToHtml(tableBuffer.join('\n')); tableBuffer = []; inTable = false; }
        codeLang = line.replace('```', '').trim();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Table line
    if (line.trim().startsWith('|')) {
      if (inList) { html += '</ul>'; inList = false; }
      inTable = true;
      tableBuffer.push(line);
      continue;
    } else if (inTable) {
      html += markdownTableToHtml(tableBuffer.join('\n'));
      tableBuffer = [];
      inTable = false;
    }

    // Unordered List
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      const content = line.trim().substring(2);
      html += `<li>${formatInline(content)}</li>`;
      continue;
    } else if (inList && !line.trim().startsWith('- ') && !line.trim().startsWith('* ') && line.trim() !== '') {
      html += '</ul>';
      inList = false;
    }

    // Ordered List
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<div class="ordered-item"><span class="item-num">${numMatch[1]}.</span> <span>${formatInline(numMatch[2])}</span></div>`;
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      html += `<h1>${formatInline(line.substring(2))}</h1>`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${formatInline(line.substring(3))}</h2>`;
      continue;
    }
    if (line.startsWith('### ')) {
      html += `<h3>${formatInline(line.substring(4))}</h3>`;
      continue;
    }
    if (line.startsWith('#### ')) {
      html += `<h4>${formatInline(line.substring(5))}</h4>`;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      html += `<blockquote>${formatInline(line.substring(2))}</blockquote>`;
      continue;
    }

    // Horizontal Rule
    if (line.trim() === '---') {
      html += `<hr class="section-divider" />`;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }

    // Paragraph
    html += `<p>${formatInline(line)}</p>`;
  }

  if (inList) html += '</ul>';
  if (inTable) html += markdownTableToHtml(tableBuffer.join('\n'));
  return html;
}

// Build complete HTML report document
export function buildReportHtml() {
  const ch1 = fs.readFileSync(path.join(rootDir, 'docs/report/01_problem_and_track.md'), 'utf8');
  const ch2 = fs.readFileSync(path.join(rootDir, 'docs/report/02_use_of_ir_principles.md'), 'utf8');
  const ch3 = fs.readFileSync(path.join(rootDir, 'docs/report/03_beyond_ir.md'), 'utf8');
  const ch4 = fs.readFileSync(path.join(rootDir, 'docs/report/04_novelty.md'), 'utf8');
  const ch5 = fs.readFileSync(path.join(rootDir, 'docs/report/05_evaluation.md'), 'utf8');
  const ch6 = fs.readFileSync(path.join(rootDir, 'docs/report/06_limitations_and_roadmap.md'), 'utf8');
  const ch7 = fs.readFileSync(path.join(rootDir, 'docs/report/07_work_division_and_ai_declaration.md'), 'utf8');

  // Load SVG charts
  const metricsSvg = loadSvg('eval/output/test_final/metrics_chart.svg');
  const tradeoffsSvg = loadSvg('eval/output/test_final/retrieval_tradeoffs.svg');

  const css = `
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 11mm 12mm;
      @bottom-right {
        content: "Page " counter(page);
        font-size: 7pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      @bottom-left {
        content: "TurnTrace: Inspectable Conversational Search Engine — CSD358 Track T2";
        font-size: 7pt;
        color: #64748b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 7.7pt;
      line-height: 1.26;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    .report-header {
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 5px;
      margin-bottom: 6px;
    }

    .course-badge {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #4f46e5;
      margin-bottom: 2px;
    }

    .report-title {
      font-size: 14pt;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 2px 0;
      line-height: 1.15;
    }

    .report-subtitle {
      font-size: 8.5pt;
      color: #475569;
      font-weight: 500;
      margin: 0 0 4px 0;
    }

    .authors-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 7.2pt;
      color: #334155;
      background: #f8fafc;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .abstract-box {
      background: #eef2ff;
      border-left: 3px solid #4f46e5;
      padding: 5px 8px;
      margin: 6px 0 8px 0;
      border-radius: 0 4px 4px 0;
      font-size: 7.4pt;
      line-height: 1.25;
      color: #1e1b4b;
    }

    .abstract-title {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 6.8pt;
      color: #4338ca;
      margin-bottom: 1px;
    }

    h1 {
      font-size: 9.5pt;
      font-weight: 800;
      color: #1e1b4b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 2px;
      margin: 8px 0 3px 0;
      page-break-after: avoid;
      break-after: avoid;
    }

    h2 {
      font-size: 8.5pt;
      font-weight: 700;
      color: #312e81;
      margin: 6px 0 2px 0;
      page-break-after: avoid;
      break-after: avoid;
    }

    h3 {
      font-size: 7.8pt;
      font-weight: 700;
      color: #4338ca;
      margin: 5px 0 2px 0;
      page-break-after: avoid;
      break-after: avoid;
    }

    p {
      margin: 0 0 3.5px 0;
      text-align: justify;
    }

    ul {
      margin: 2px 0 3.5px 0;
      padding-left: 14px;
    }

    li {
      margin-bottom: 1px;
    }

    .ordered-item {
      display: flex;
      gap: 5px;
      margin-bottom: 1.5px;
    }

    .item-num {
      font-weight: 700;
      color: #4f46e5;
      min-width: 12px;
    }

    blockquote {
      margin: 3px 0;
      padding: 3px 6px;
      background: #f1f5f9;
      border-left: 2.5px solid #64748b;
      font-style: italic;
      color: #334155;
      font-size: 7.2pt;
      border-radius: 0 3px 3px 0;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 6.8pt;
      background: #f1f5f9;
      padding: 1px 2px;
      border-radius: 2px;
      color: #0f172a;
      border: 1px solid #e2e8f0;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 5px 7px;
      border-radius: 4px;
      font-size: 6.5pt;
      line-height: 1.18;
      overflow-x: auto;
      margin: 3px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    pre code {
      background: transparent;
      color: inherit;
      border: none;
      padding: 0;
    }

    .math {
      font-family: "Cambria Math", "Latin Modern Math", serif;
      font-style: italic;
    }

    .table-container {
      margin: 3px 0 5px 0;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 6.8pt;
      line-height: 1.15;
    }

    th {
      background: #eef2ff;
      color: #1e1b4b;
      font-weight: 700;
      border-top: 1px solid #c7d2fe;
      border-bottom: 1.5px solid #6366f1;
      padding: 2.5px 4px;
    }

    td {
      padding: 2px 4px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin: 5px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .chart-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px;
      text-align: center;
    }

    .chart-caption {
      font-size: 6.2pt;
      font-weight: 600;
      color: #64748b;
      margin-top: 1px;
    }

    .svg-wrapper svg {
      max-width: 100%;
      height: auto;
      max-height: 120px;
    }

    .section-divider {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 5px 0;
    }
  `;

  // Render chapters to HTML
  const parsed1 = parseMarkdownToHtml(ch1);
  const parsed2 = parseMarkdownToHtml(ch2);
  const parsed3 = parseMarkdownToHtml(ch3);
  const parsed4 = parseMarkdownToHtml(ch4);
  const parsed5 = parseMarkdownToHtml(ch5);
  const parsed6 = parseMarkdownToHtml(ch6);
  const parsed7 = parseMarkdownToHtml(ch7);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TurnTrace Final Project Report (CSD358 Track T2)</title>
  <style>${css}</style>
</head>
<body>

  <header class="report-header">
    <div class="course-badge">CSD358: Information Retrieval — Midsem Hackathon Assignment (Track T2: Conversational and Agentic Search)</div>
    <h1 class="report-title">TurnTrace: Inspectable Conversational Search Engine with Decoupled Entity-Lock and Aspect Tracking</h1>
    <div class="report-subtitle">A First-Principles Information Retrieval Architecture Operating Strictly Over Inverted Index Statistics</div>
    
    <div class="authors-meta">
      <div><strong>Team Allocation:</strong> Member 1 (Indexing), Member 2 (Scoring & Fusion), Member 3 (Conversational Tracking), Member 4 (Evaluation & UI)</div>
      <div><strong>Corpus:</strong> 35,000 Wikipedia Passages (4 Domains)</div>
      <div><strong>Benchmark:</strong> 14 Multi-Turn Scenarios (70 Turns, 2,297 Judged Pairs)</div>
      <div><strong>Submission:</strong> October 2026</div>
    </div>
  </header>

  <div class="abstract-box">
    <div class="abstract-title">Executive Abstract</div>
    Traditional conversational search systems frequently delegate dialogue reasoning to opaque neural black boxes, obscuring retrieval mechanics and introducing unpredictable hallucinations. In this work, we present <strong>TurnTrace</strong>, an inspectable conversational search engine built exclusively from first-principles Information Retrieval algorithms with zero external LLM or vector database dependencies. TurnTrace models conversational discourse by decoupling core focal subjects (<strong>Entity Lock</strong> via multi-zone Boolean title filtering) from investigative perspectives (<strong>Aspect Tracking</strong> with exponential decay and automatic replacement). On a frozen 35,000-passage multi-domain Wikipedia collection and 70 benchmark turns judged across 2,297 query-passage pairs with 0% unjudged fraction, TurnTrace achieves top-tier shallow precision (<strong>P@5 = 0.9150</strong>, <strong>P@10 = 0.8800</strong>) and statistical accuracy of <strong>84.38%</strong> on dialogue transition classification. Our novelty mechanism—an inter-turn seen-passage penalty ($\beta=0.30$)—yields a <strong>+21.6% relative gain in novel evidence discovery</strong> (Novelty@10 from 0.6250 to 0.7600). We expose every mathematical token weight, positional phrase check, and candidate accumulator in an unredacted interactive Trace Inspector operating at sub-10ms query latencies.
  </div>

  <main>
    ${parsed1}
    ${parsed2}
    ${parsed3}
    ${parsed4}

    ${parsed5}

    <div class="chart-grid">
      <div class="chart-card">
        <div class="svg-wrapper">${tradeoffsSvg}</div>
        <div class="chart-caption">Figure 3: Retrieval Precision (P@10) vs Novel Passage Discovery (Novelty@10) Across All 13 Evaluated Systems on TEST Split.</div>
      </div>
      <div class="chart-card">
        <div class="svg-wrapper">${metricsSvg}</div>
        <div class="chart-caption">Figure 4: Graded Ranking Quality (nDCG@10) and Mean Reciprocal Rank (MRR) for Headline Systems on TEST Split.</div>
      </div>
    </div>

    ${parsed6}
    ${parsed7}

    <section class="references-section" style="margin-top: 10px; page-break-inside: avoid; break-inside: avoid;">
      <h1>References & Academic Citations</h1>
      <ul style="font-size: 7.2pt; line-height: 1.25;">
        <li>Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval. <em>Information Processing & Management</em>, 24(5), 513-523.</li>
        <li>Robertson, S., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. <em>Foundations and Trends in Information Retrieval</em>, 3(4), 333-389.</li>
        <li>Porter, M. F. (1980). An algorithm for suffix stripping. <em>Program: Electronic Library and Information Systems</em>, 14(3), 130-137.</li>
        <li>Cormack, G. V., Clarke, C. L., & Buettcher, S. (2009). Reciprocal rank fusion outperforms Condorcet and individual machine learning methods. In <em>Proceedings of ACM SIGIR</em> (pp. 758-759).</li>
        <li>Radlinski, F., & Craswell, N. (2017). A theoretical framework for conversational search. In <em>Proceedings of ACM CHIIR</em> (pp. 117-126).</li>
        <li>Dalton, J., Xiong, C., Kumar, V., & Callan, J. (2020). CAsT 2019: The Conversational Assistance Track Overview. In <em>TREC 2019 Proceedings</em>.</li>
        <li>Manning, C. D., Raghavan, P., & Schütze, H. (2008). <em>Introduction to Information Retrieval</em>. Cambridge University Press.</li>
      </ul>
    </section>
  </main>

</body>
</html>`;

  return fullHtml;
}

// Main execution function
export function generatePdf() {
  const htmlContent = buildReportHtml();
  const htmlPath = path.join(rootDir, 'docs/report/report.html');
  const pdfDocsPath = path.join(rootDir, 'docs/report/TurnTrace_Report.pdf');
  const pdfRootPath = path.join(rootDir, 'TurnTrace_Report.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log(`Generated HTML report at: ${htmlPath} (${htmlContent.length} bytes)`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Chrome not found at: ${chromePath}`);
  }

  const htmlUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  console.log('Printing PDF via Chrome headless...');
  execFileSync(chromePath, [
    '--headless',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    '--print-to-pdf=' + pdfDocsPath,
    htmlUrl
  ]);

  console.log(`PDF successfully created at: ${pdfDocsPath} (${fs.statSync(pdfDocsPath).size} bytes)`);

  // Copy to root
  fs.copyFileSync(pdfDocsPath, pdfRootPath);
  console.log(`Copied PDF to root: ${pdfRootPath}`);

  // Count pages by parsing PDF byte stream
  const pdfBytes = fs.readFileSync(pdfDocsPath);
  const pdfText = pdfBytes.toString('latin1');
  const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 0;
  console.log(`Total PDF Page Count: ${pageCount} pages`);

  return { htmlPath, pdfDocsPath, pdfRootPath, pageCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const res = generatePdf();
    console.log(`Report compilation complete! Pages: ${res.pageCount} (Limit: <= 8 pages)`);
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
}
