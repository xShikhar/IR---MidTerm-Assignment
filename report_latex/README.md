# TurnTrace: Academic LaTeX Report Template (CSD358 Track T2)

This directory contains the complete, publication-grade academic LaTeX source files for the **TurnTrace** conversational search engine project, tailored specifically for **CSD358: Information Retrieval Hackathon (Track T2: Conversational and Agentic Search)**.

---

## 1. Directory Structure

```
report_latex/
├── main.tex           # Complete, self-contained academic paper source (A4 twocolumn)
├── references.bib     # Authentic BibTeX bibliography file (canonical IR literature)
└── README.md          # Compilation guide, package list, and customization instructions
```

---

## 2. Compilation Instructions

The template is fully standard and compatible with **pdfLaTeX**, **XeLaTeX**, and **LuaLaTeX** using TeX Live 2020+, MiKTeX, or Overleaf.

### Method A: Overleaf (Recommended & Fastest)
1. Log in to [Overleaf](https://www.overleaf.com/).
2. Create a new blank project (e.g., `TurnTrace_Report`).
3. Upload `main.tex` and `references.bib` into the project root.
4. Ensure the compiler is set to **pdfLaTeX** (default in Overleaf Menu $\to$ Settings).
5. Click **Recompile**. The PDF will compile cleanly with native vector TikZ diagrams, PGFPlots, mathematical formulas, and cross-references.

### Method B: Local Command Line (`latexmk`)
If you have a local TeX Live or MiKTeX distribution:
```bash
cd report_latex
latexmk -pdf main.tex
```
`latexmk` will automatically handle multiple passes and BibTeX synchronization.

### Method C: Standard 4-Pass Compilation (`pdflatex` + `bibtex`)
```bash
cd report_latex
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

---

## 3. Required LaTeX Packages

All utilized packages are part of standard TeX distributions (`texlive-latex-recommended`, `texlive-latex-extra`, or MiKTeX standard):

| Package | Purpose in Template |
|---|---|
| `geometry` | Sets A4 paper with $1.8\,\text{cm}$ margins for optimal 2-column density. |
| `lmodern`, `microtype` | Modern typography, font expansion, and protrusion to eliminate overfull boxes. |
| `amsmath`, `amssymb` | Mathematical formatting for SMART $\text{lnc.ltc}$, BM25, and RRF equations. |
| `booktabs`, `tabularx` | Publication-grade academic tables with professional horizontal borders. |
| `tikz` | Native vector architecture pipeline diagram and project roadmap (zero external image dependencies). |
| `pgfplots` | Native vector chart rendering precision vs. novelty trade-off curves. |
| `xcolor` | Restrained academic color palette (`primarydark`, `accentblue`, `secondaryblue`, `darkslate`). |
| `fancyhdr` | Running headers with track name and university submission metadata. |
| `titlesec` | Clean, compact section and subsection headings with subtle divider rules. |
| `cite` | Standard numerical in-text citations linking directly to `references.bib`. |
| `hyperref` | Clickable internal cross-references, equations, tables, figures, and external URLs. |

---

## 4. How to Customize and Replace Placeholders

The document comes pre-populated with verified TurnTrace algorithms, empirical benchmark results, and team member details:
- **Member 1:** Shikhar Agarwal (Roll No: 2410110615)
- **Member 2:** Antra Agarwal (Roll No: 2410110404)
- **Member 3:** Bhupesh Bansal (Roll No: 2410110531)
- **Member 4:** Raghavendra Singh Sani (Roll No: 2410110465)

If you need to customize any part for a different variant or extension:

### 1. Document Metadata (Title, Authors, Institution)
Located at lines 55--75 in `main.tex`:
```latex
\twocolumn[
  \begin{center}
    ...
    \begin{tabular}{c c c c}
      \textbf{[MEMBER 1]} & \textbf{[MEMBER 2]} & ...
    \end{tabular}
  \end{center}
]
```

### 2. Experimental Data & Numbers
Located in Section 5 (`Table 3: Comprehensive Benchmark Evaluation` and `Table 4: Statistical Significance`). All metrics match our verified test run:
- If running on your own custom query subset, replace values in `main.tex` lines 360--420.
- If results are pending, you can easily insert `\textit{[Pending]}` or `\textit{[To be filled]}`.

### 3. Adding External Figures (PNG/PDF)
If you wish to replace the native TikZ diagrams with an external screenshot:
```latex
\begin{figure}[H]
  \centering
  \includegraphics[width=\columnwidth]{figures/my_ui_screenshot.png}
  \caption{Trace Inspector UI showing per-term query provenance.}
  \label{fig:ui_screenshot}
\end{figure}
```

### 4. Adding BibTeX Citations
1. Open `references.bib` and append your new entry:
```bibtex
@article{new_paper_key,
  author    = {Author Name},
  title     = {Title of Paper},
  journal   = {Journal Name},
  year      = {2024}
}
```
2. In `main.tex`, reference it using `\cite{new_paper_key}`.

---

## 5. Page Budget Guidelines (Strict $\le 8$ Pages Limit)

The assignment rubric explicitly states:
> *"Report: PDF, at most 8 pages excluding references and appendix, using the structure below"*

### How This Template Manages the Budget:
1. **Compact Title Section:** Instead of wasting an entire page on a decorative cover, the title, authors, and abstract are placed at the top of Page 1 in a compact spanning box.
2. **Two-Column Layout:** The 2-column format increases text density by $\approx 30\%$ compared to 1-column layouts, keeping Sections 1 through 7 within 6--7 pages.
3. **Appendix Placement:** Detailed pseudocode, raw JSON execution traces, and extended mathematical derivations are placed in the `\appendix` section (Page 8 onwards), which is **officially excluded** from the page limit.
4. **Spacing Knobs:** If your custom edits add extra text:
   - Adjust `\titlespacing*` in `main.tex` lines 42--45.
   - Adjust table font size via `\scriptsize` or `\footnotesize`.
