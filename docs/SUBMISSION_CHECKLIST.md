# TurnTrace Hackathon Submission Checklist (Track T2)

This checklist mirrors every grading rubric requirement for CSD358 (Information Retrieval Hackathon):

## 1. Submission Links & Metadata
- **Project Name:** TurnTrace: Inspectable Conversational Search Engine
- **Hackathon Track:** Track T2 (Conversational and Agentic Search)
- **Repository URL:** `https://github.com/xShikhar/IR---MidTerm-Assignment`
- **Video Demonstration URL:** `[To be recorded using docs/video-script.md]`
- **Report Document (PDF):** `TurnTrace_Report.pdf` (Compiled, verified at exactly 8 pages matching assignment specifications)

---

## 2. Rubric Compliance Verification (100 Points Total)

### 1. Use of IR Principles (30 Points)
- [x] **Zero Search Wrappers:** No Lucene, Lunr, Elasticsearch, Milvus, Pinecone, or Chroma. Core retrieval implemented 100% in pure ES modules.
- [x] **Lexical Normalization:** Custom tokenizer with positional offsets (`server/src/index/tokenizer.js`), full Martin Porter (1980) 5-step stemmer (`server/src/index/porterStemmer.js`), and SMART stopword elimination (`normalizer.js`).
- [x] **Inverted & Positional Index:** Inverted index with document frequency ($df$), term frequency across `title` and `body` zones, and exact positional offsets (`postings.js`, `builder.js`).
- [x] **SMART `lnc.ltc` Vector Space Model:** Logarithmic TF ($1 + \ln(tf)$), natural collection IDF ($\ln(N/df)$), and Euclidean cosine length normalization (`cosine.js`).
- [x] **Okapi BM25 Ranking:** Probabilistic retrieval model with $k_1 = 1.2$, $b = 0.75$, and length penalty normalization (`bm25.js`).
- [x] **Efficient Top-K Min-Heap:** $O(N \log K)$ selection without full document sorting (`heap.js`).
- [x] **Index Elimination & Champion Lists:** IDF-based term pruning (`indexElimination.js`) and precomputed top-$r$ champion lists per term (`championLists.js`).
- [x] **Boolean Retrieval with DF Ordering:** Conjunctions intersected in order of increasing document frequency (`boolean.js`).
- [x] **Positional Phrase Queries:** Positional postings intersection for exact consecutive bigrams/phrases (`phrase.js`).
- [x] **Reciprocal Rank Fusion:** RRF ($k=60$) and score-sum fusion (`fusion.js`).

### 2. Working System & Inspectability (20 Points)
- [x] **100% Real, Dynamic Implementation:** Zero hard-coded demo results or mock retrieval paths. Every score, posting, and ranking is computed dynamically.
- [x] **Unredacted Per-Turn Trace:** Returned as JSON with every query: raw query, tokens, shift decision & numbers, context terms with provenance, rewritten query, sub-queries, postings used, score breakdowns, fusion rankings, and timings.
- [x] **Clean REST API:** Express API with endpoints `POST /api/chat`, `POST /api/reset`, `GET /api/stats`, `GET /api/health`.
- [x] **React Trace Inspector:** Vite + React frontend dedicated to visualizing the conversational search and per-turn trace drawer.

### 3. Evaluation & Experimental Benchmark (15 Points)
- [x] **Real Judged Dataset:** 14 multi-turn conversations (70 judged turns, exceeding the 40-turn requirement) with pooled relevance judgments (qrels) and gold rewrites across 35,000 passages.
- [x] **Systems S0 through S5:** Direct comparison of Raw Query (S0), Naive Concat (S1), TurnTrace Rewriter (S2), Full System (S3), and Oracle Gold (S5). S4 (unsupported external LLM) removed to preserve 100% academic integrity and offline reproducibility.
- [x] **Systematic Ablations:** `lnc.ltc` vs BM25, Topic-Shift OFF, Exponential Decay OFF ($\lambda=1.0$), Decomposer Fusion OFF.
- [x] **Standard IR Metrics:** P@5, P@10, Recall@20, MRR, nDCG@10, and Clarification Precision.
- [x] **One-Command Reproduction:** `npm run eval` computes all tables, outputs CSV files, and generates an SVG comparison chart.

### 4. Novelty & Conversational Mechanics (10 Points)
- [x] **Index-Driven Decayed Context Vector:** Term weights decayed via $W(t) = \text{TFIDF}(t) \cdot \lambda^{\text{age}}$ with full origin provenance.
- [x] **Dual-Signal Topic-Shift Detector:** Cosine angle between query vector and context vector with pronoun and ellipsis override.
- [x] **Leader/Follower Cluster Clarifier:** Fires on small score margin and bimodal candidate clusters; synthesizes clarifying questions from distinguishing high-IDF terms without firing on high-confidence turns.
- [x] **Multi-Part Decomposer:** Separates comparative queries into Boolean entity constraints and vector sub-queries, fused via RRF.

### 5. Report (10 Points)
- [x] **Complete 7-Chapter Report:** Drafted in `docs/report/` (Problem & Track Relevance, IR Principles with Mermaid diagram, Beyond IR, Novelty, Real Evaluation Tables, Failure Case Analysis, Work Division & AI Disclosure). Fits within 8 pages.

### 6. Video Demonstration Script (10 Points)
- [x] **Timed 6–7 Minute Run-of-Show:** Complete step-by-step cue cards for all 4 team members covering problem, live dialogue with topic shift and ambiguity clarification, live limitation walkthrough, code inspection, and evaluation summary (`docs/video-script.md`).

### 7. Track Relevance (5 Points)
- [x] **Deeply Aligned with Track T2:** Conversational and agentic search driven by transparent, index-derived IR principles.

---

## 3. Reproduction Command Verification

```bash
# Verify from clean state:
git status
npm test
npm run eval
npm run build --workspace=client
```
All commands execute cleanly with zero errors.
