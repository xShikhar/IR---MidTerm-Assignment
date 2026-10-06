# TurnTrace Completion Progress Log

## Phase 0: Baseline
- **Date:** 2026-10-06T20:22Z
- **Status:** PASS
- npm install: clean (145 packages)
- Syntax check: 55 JS files, 0 errors
- npm test: 74/74 pass (54 server + 20 eval)
- Index verified: 35,000 docs, 80,684 vocab terms
- Frozen hashes recorded (9 files)

## Phase 1: Pending Code Fixes
- **Date:** 2026-10-06T20:31Z
- **Status:** PASS
- Decomposer regex: added 'differ from' / 'differs from' / 'contrast with' detection and splitting; 3 tests added.
- Favicon: client/public/favicon.svg created; linked in client/index.html; verified 200 OK via HTTP.
- README wording cleanup: confirmed zero 'rescued' / 'wrongly reset' in README.md; recorded legacy report lines in docs/RESULTS_FOR_REPORT.md.
- Frozen corpus availability: gzipped data/corpus.json (6.50 MB) and data/index.json (18.67 MB) into data/frozen/; created SHA-256 files and scripts/verifyFrozenData.js; added verify:data / unpack:data npm scripts.
- Tests: 77/77 pass (57 server + 20 eval); 56 JS files syntax-clean; Vite client build passes.

## Phase 2: Pool Coverage
- **Date:** 2026-10-06T20:35Z
- **Status:** PASS
- Command: `node server/scripts/generateIncrementalPool.js`
- Frozen master pool: 1,676 records unchanged.
- Incremental pool (A1-A6): 621 deduplicated unique turn-doc rows generated in `eval/output/pooling_incremental/`.
- New rows per system: A1: 146 (20.86%), A2: 224 (32.00%), A3: 253 (36.14%), A4: 295 (42.14%), A5: 222 (31.71%), A6: 91 (13.00%).
- All frozen files verified unchanged. Tests: 77/77 pass.

## Phase 3: Relevance Judging
- **Date:** 2026-10-06T20:41Z
- **Status:** PASS
- Rubric: created `docs/judging_rubric.md` (Grades 0, 1, 2).
- Dry run: 20 stratified rows verified with factual rationales.
- Full judging: 2,297 rows judged in 10 deterministic batches saved to `eval/output/judged_llm/`.
- Self-consistency: 230 rows (10% sample) evaluated in shuffled order: Grade Change Rate = 0.00%, Cohen's Kappa = 1.0.
- Ambiguous entities (conv_11, conv_12): 282 rows; 35 rows (12.4%) filtered to Grade 0 strictly on polysemy sense checking.
- Qrels ingestion: 70/70 turns complete (2,297 judged pairs) ingested into `data/qrels.json`; Grade distribution: Grade 0: 710 (30.9%), Grade 1: 1028 (44.8%), Grade 2: 559 (24.3%).
- Unjudged top-10 fraction: 0.00% across all systems S0-S5 and A0-A6.
- Spot-check: created `eval/output/spot_check_sheet.csv` (100 rows, blank grades), `eval/output/spot_check_key.csv` (reference key), and `server/scripts/evaluateSpotCheck.js`.

## Phase 4: Expected-Action Labeling
- **Date:** 2026-10-06T20:45Z
- **Status:** PASS
- Labeled all 70 turns based strictly on dialogue context; exported to `eval/output/expected_action_llm.csv` and imported into `data/conversations.json`.
- Counts overall (all 70): carry=66, reset=2, entity_switch=2.
- Multi-turn transitions (excluding Turn 1, n=56): DEV (n=24): carry=22, reset=1, entity_switch=1; TEST (n=32): carry=30, reset=1, entity_switch=1.
- DEV decision metrics: Legacy Cosine accuracy=0.5000, macroF1=0.2698 (11 false resets); New Decision Detector accuracy=0.7500, macroF1=0.2857 (false resets reduced to 4).
- Tests: 77/77 pass; frozen files unchanged.

## Phase 5: DEV Tuning
- **Date:** 2026-10-06T20:51Z
- **Status:** PASS
- Specification: created `docs/notes/tuning_plan.md` before sweep.
- Grid sweep on DEV (n=30 turns): 35 evaluations exported to `eval/output/tuning_dev.csv`.
- Results on DEV:
  - DEV A0: P@5=0.5600, MRR=0.6289, nDCG@10=0.4727
  - DEV A3: P@5=0.5600, MRR=0.6033, nDCG@10=0.4061 (Bootstrap p=0.235, Wilcoxon p=0.3869)
  - DEV A4: P@5=0.5467, MRR=0.6114, nDCG@10=0.4127 (Bootstrap p=0.280, Wilcoxon p=0.5373)
- Clarifier evaluation on DEV: Cluster clarifier fired on 23/30 turns (76.7% FP rate) vs trivial baseline 7/30 (23.3%); failed to beat trivial baseline. Clarifier disabled by default (`CONFIG.conversation.clarifier.enabled = false`) and kept reachable via options flag.
- Final parameters committed; zero further parameter changes permitted. Tests: 77/77 pass.

## Phase 6: TEST Run — Exactly Once
- **Date:** 2026-10-06T21:04Z
- **Status:** PASS
- Command: `npm run eval -- --split=test` executed exactly once with frozen parameters.
- Outputs saved under `eval/output/test_final/` (11 artifacts including 8 CSVs and 3 SVGs).
- TEST Headline results (n=40 turns):
  - S0: P@5=0.8350, P@10=0.7975, Recall@20=0.4775, MRR=0.9500, nDCG@10=0.6732, Novelty@10=0.9250
  - S1: P@5=0.9400, P@10=0.9425, Recall@20=0.6058, MRR=0.9446, nDCG@10=0.6572, Novelty@10=0.4500
  - S2: P@5=0.8900, P@10=0.8650, Recall@20=0.5424, MRR=0.9875, nDCG@10=0.6875, Novelty@10=0.8175
  - S5: P@5=0.9950, P@10=0.9925, Recall@20=0.5986, MRR=1.0000, nDCG@10=0.7723, Novelty@10=0.7125
  - A0: P@5=0.8900, P@10=0.8650, Recall@20=0.5424, MRR=0.9875, nDCG@10=0.6875, Novelty@10=0.8175
  - A1: P@5=0.9550, P@10=0.9325, Recall@20=0.5926, MRR=1.0000, nDCG@10=0.6974, Novelty@10=0.6975
  - A2: P@5=0.8700, P@10=0.8475, Recall@20=0.5200, MRR=0.8775, nDCG@10=0.5959, Novelty@10=0.5250
  - A3: P@5=0.9150, P@10=0.8800, Recall@20=0.5274, MRR=0.9563, nDCG@10=0.6317, Novelty@10=0.6250
  - A4: P@5=0.9050, P@10=0.8325, Recall@20=0.4834, MRR=0.9563, nDCG@10=0.6324, Novelty@10=0.7600
  - A5: P@5=0.9500, P@10=0.9400, Recall@20=0.5235, MRR=0.9500, nDCG@10=0.6589, Novelty@10=0.5850
  - A6: P@5=0.8300, P@10=0.7825, Recall@20=0.4330, MRR=0.9187, nDCG@10=0.6577, Novelty@10=0.9275
  - R1: P@5=0.8100, P@10=0.7025, Recall@20=0.4033, MRR=0.9363, nDCG@10=0.5229, Novelty@10=0.5900
  - R2: P@5=0.9100, P@10=0.8750, Recall@20=0.5267, MRR=0.9563, nDCG@10=0.6308, Novelty@10=0.6275
- A3 vs A0: P@5 (+0.0250), P@10 (+0.0150), Recall@20 (-0.0150), MRR (-0.0313), nDCG@10 (-0.0558, Bootstrap p=0.1325, 95% CI [-0.1342, 0.0129], Wilcoxon p=0.2358, W=187, nonZero=31, n=40). Neither difference is statistically significant at alpha=0.05.
- Decision Metrics on TEST (n=32 multi-turn transitions):
  - Legacy Cosine Rule: Accuracy=0.6563, Macro-F1=0.3179 (11 false resets)
  - New Decision Detector: Accuracy=0.8438, Macro-F1=0.4152 (false resets reduced to 4)
- Clarifier on TEST: Cluster clarifier fired on 35/40 turns (87.5% FP rate) vs trivial baseline 6/40 (15.0%), corroborating DEV decision to keep clarifier disabled by default.
- Top 5 worst A3-vs-A0 turns automatically extracted into `worst_turns_a3_vs_a0.csv`.
- Visualizations exported: `metrics_chart.svg`, `retrieval_tradeoffs.svg`, `novelty_tradeoff.svg`.
- Frozen hashes verified unchanged. Tests: 77/77 pass. Zero further code or config changes.

## Phase 7: README and Results
- **Date:** 2026-10-06T21:11Z
- **Status:** PASS
- README.md: updated with honest Status Table, final TEST results table, DEV tuning diagnostics, rigorous A3-vs-A0 comparison, decision metrics table, clarifier evaluation findings, judging methodology and self-consistency statistics, comprehensive empirical limitations, and verified reproducibility commands.
- docs/RESULTS_FOR_REPORT.md: created comprehensive single source of truth containing every empirical table, number, plot path, failure analysis case, best demo case, and exact command.
- Zero changes to docs/report/* or docs/video-script.md. Tests: 77/77 pass.


