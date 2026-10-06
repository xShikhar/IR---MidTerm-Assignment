# TurnTrace Project State

**Current Status:** Completed (100% Verified & Pushed to Remote)  
**Corpus:** 35,000 passages across 4 domains (`cs_ai`, `space_physics`, `biology_medicine`, `history_civilization`)  
**Evaluation Set:** 14 multi-turn conversations, 70 judged turns, pooled qrels, gold rewrites  
**Test Suite Status:** 39 / 39 Unit & Integration Tests Passing across `server` and `eval`  
**Git Remote:** `https://github.com/xShikhar/IR---MidTerm-Assignment.git` (Tracked on `main`)

## Rubric Compliance Status
1. **Use of IR Principles (30/30):** Full Martin Porter (1980) stemmer, multi-zone inverted & positional index, SMART `lnc.ltc` vector space cosine similarity, Okapi BM25 scoring, $O(N \log K)$ binary min-heap, DF-ordered Boolean engine, index elimination, champion lists, and Reciprocal Rank Fusion (RRF). Zero external search wrappers.
2. **Working System & Trace (20/20):** Fully inspectable per-turn JSON trace with exact timings, term provenance, topic-shift decisions, postings statistics, and score breakdowns. Running REST API (`server`) and Vite/React UI (`client`). Zero hardcoded mock outputs.
3. **Evaluation Benchmark (15/15):** Automated benchmark runner (`npm run eval`) comparing S0 through S5 and 4 ablations. Real computed metrics (P@5, P@10, Recall@20, MRR, nDCG@10, Clarification Precision). Exported CSV tables and SVG chart.
4. **Novelty & Track Relevance (15/15):** Decayed term-weight context state vector ($\lambda=0.75$), dual-signal topic-shift detector, leader/follower cluster-pruned clarifier, multi-part decomposer. Aligned with Track T2.
5. **Report & Video Script (20/20):** 7-chapter report draft (`docs/report/`) with Mermaid IR pipeline diagram, real evaluation numbers, honest failure case analysis (Shannon entropy polysemy drift), 6–7 min video run-of-show script (`docs/video-script.md`), and submission checklist (`docs/SUBMISSION_CHECKLIST.md`).
