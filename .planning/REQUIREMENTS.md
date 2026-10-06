# TurnTrace Requirements Traceability Matrix

## 1. Core IR Requirements (30 pts on Rubric)
- [x] **REQ-IR-01 Tokenization & Normalization:** Lowercase, regex tokenization, punctuation removal, stop word removal, Porter stemming (clearly declared as IR morphological normalization).
- [ ] **REQ-IR-02 Inverted Index:** Memory-resident inverted index built offline, serialized to disk, with term dictionary, document frequency ($df_t$), and postings with term frequency ($tf_{t,d}$).
- [ ] **REQ-IR-03 Positional Index:** Postings contain exact word offsets for exact phrase search (`"..."`).
- [ ] **REQ-IR-04 Multi-Zone Indexing:** Separate or flagged title vs body zones with parameterized zone weighting ($Score = g \cdot S_{title} + (1-g) \cdot S_{body}$).
- [ ] **REQ-IR-05 Vector Space Model (SMART lnc.ltc):**
  - Document weight $w_{t,d} = (1 + \ln(tf_{t,d})) \cdot 1 / \sqrt{\sum w_i^2}$.
  - Query weight $w_{t,q} = (1 + \ln(tf_{t,q})) \cdot \ln(N / df_t) / \sqrt{\sum w_i^2}$.
  - Cosine score = $\sum_{t \in q \cap d} w_{t,q} \cdot w_{t,d}$.
- [ ] **REQ-IR-06 BM25 Retrieval:** Okapi BM25 implementation with $k_1 = 1.2$, $b = 0.75$, and length normalization via $L_d / L_{avg}$.
- [ ] **REQ-IR-07 Top-K Binary Min-Heap:** $O(N \log K)$ selection avoiding full document sort.
- [ ] **REQ-IR-08 Index Elimination:** Skip query terms whose IDF is below a threshold.
- [ ] **REQ-IR-09 Champion Lists:** Precomputed top-$r$ postings per term for fast candidate gathering.
- [ ] **REQ-IR-10 Boolean Retrieval:** AND / OR / NOT operations with postings intersection ordered by increasing document frequency ($df$).

## 2. Conversational Layer Requirements (10 pts Novelty + 5 pts Track Relevance)
- [ ] **REQ-CV-01 Context State Vector:** Decayed term-weight vector accumulating previous query terms and top document terms: $w(t) = \text{tfidf}(t) \cdot \lambda^{\text{age}}$.
- [ ] **REQ-CV-02 Topic-Shift Detector:** Cosine similarity between current query and context vector, combined with heuristics (pronoun presence, query length, missing high-IDF terms). Decides `CARRY` vs `RESET`.
- [ ] **REQ-CV-03 Query Rewriter with Provenance:** On `CARRY`, expands query with top-$m$ context terms, annotating each added term with provenance (source turn, IDF, decayed weight).
- [ ] **REQ-CV-04 Sub-Query Decomposer:** Splits multi-part questions into Boolean high-IDF entity constraint sub-queries and vector sub-queries.
- [ ] **REQ-CV-05 Rank Fusion:** Combines sub-query rankings via Reciprocal Rank Fusion ($RRF$) and score-sum fusion.
- [ ] **REQ-CV-06 Cluster-Pruning Clarifier:** Detects bimodal cluster distributions among top candidates; extracts distinguishing high-IDF terms to generate clarifying questions if score margin is tight.
- [ ] **REQ-CV-07 Optional LLM Adapter:** Provider-agnostic optional rewriter interface, caching responses, fully declared, 100% disabled by default.

## 3. Working System & Inspectable Trace (20 pts on Rubric)
- [ ] **REQ-SYS-01 Zero Hard-coding / Mocking:** Every number, posting, score, and ranking is dynamically computed.
- [ ] **REQ-SYS-02 Complete Trace JSON:** Returned with every turn containing: raw query, normalized tokens, shift decision with numeric cosine & signals, context provenance, rewritten query, sub-queries, postings stats, score breakdown, fusion rankings, clarifying questions, and latencies.
- [ ] **REQ-SYS-03 REST API:** Express endpoints for conversational interaction.
- [ ] **REQ-SYS-04 React Trace Inspector:** Clean, minimal UI dedicated to displaying the conversational search and opening the detailed trace inspector drawer.

## 4. Evaluation & Rubric Compliance (15 pts on Rubric)
- [ ] **REQ-EV-01 Real Judged Benchmark:** 14 multi-turn conversations (70+ judged turns) with pooled relevance judgments (qrels) and gold rewrites.
- [ ] **REQ-EV-02 Systems S0 through S5:**
  - S0: Raw query
  - S1: Naive history concatenation
  - S2: TurnTrace rewriter
  - S3: TurnTrace decomposer + RRF
  - S4: Optional LLM rewriter
  - S5: Oracle gold rewrite
- [ ] **REQ-EV-03 Ablation Studies:** BM25 vs `lnc.ltc`, Topic-shift off, Decay off, Fusion off.
- [ ] **REQ-EV-04 Metrics:** P@5, P@10, Recall@20, MRR, nDCG@10, and Clarification Precision.
- [ ] **REQ-EV-05 Automated Export:** Single command `npm run eval` outputs CSV tables and charts.

## 5. Documentation, Report & Video (20 pts on Rubric)
- [ ] **REQ-DOC-01 README:** Setup, execution commands, dataset attribution, architecture.
- [ ] **REQ-DOC-02 7-Chapter Report:** Problem & track relevance, IR theory & implementation mapping (Mermaid diagram), beyond IR, novelty, evaluation results, limitations/failure case, work distribution & AI disclosure.
- [ ] **REQ-DOC-03 Video Run-of-Show:** 5–8 minute timed script with component presentations by all 4 team members and live limitation walkthrough.
- [ ] **REQ-DOC-04 Submission Checklist:** Verification file for final delivery.
