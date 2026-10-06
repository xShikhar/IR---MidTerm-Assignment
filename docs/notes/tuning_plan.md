# TurnTrace Phase 5: DEV Tuning Plan & Search Space Specification

**Document ID:** `TT-NOTE-2026-10-06-02`  
**Date:** 2026-10-06  
**Status:** Pre-Sweep Specification (Defined Before Running Tuning)  
**Evaluation Target:** DEV Split Only (6 conversations, 30 dialogue turns)  
**Primary Metric:** $\text{nDCG}@10$  
**Secondary Diagnostics:** $\text{P}@5$, $\text{MRR}$  

---

## 1. Principles & Safeguards

1. **Strict Data Separation:** All parameter grid sweeps are executed strictly on the 6 development conversations (`data/splits.json`). The 8 TEST conversations are held out and untouched until the final, one-shot Phase 6 evaluation.
2. **Compact Search Space:** Because DEV contains 30 turns, large parameter grids risk overfitting. We define compact, principled, 2-to-3 point grids around classical Information Retrieval standards.
3. **Reproducibility:** All sweep runs use fixed seeds and deterministic candidate retrieval over the frozen inverted index (`data/index.json`) and judged qrels (`data/qrels.json`).

---

## 2. Parameter Tuning Space

| Parameter | Configuration Path | Baseline | Candidate Grid Values | Theoretical Rationale |
|---|---|:---:|:---:|---|
| `entity.minIdf` | `CONFIG.novelty.entity.minIdf` | `2.50` | `[2.20, 2.50, 2.80]` | Minimum collection IDF threshold for a term to qualify as an entity anchor. |
| `entity.minTitleHits` | `CONFIG.novelty.entity.minTitleHits` | `1` | `[1, 2]` | Minimum title-zone hits in top retrieval results required to lock an entity candidate. |
| `lock.minCandidates` | `CONFIG.novelty.lock.minCandidates` | `10` | `[5, 10, 15]` | Minimum candidate count from hard title-zone filter before triggering graceful soft fallback. |
| `lock.entityBoost` | `CONFIG.novelty.lock.entityBoost` | `2.0` | `[1.5, 2.0, 2.5]` | Multiplicative score boost applied during soft entity fallback or soft-lock mode. |
| `aspect.decayLambda` | `CONFIG.novelty.aspect.decayLambda` | `0.75` | `[0.60, 0.75, 0.90]` | Exponential decay factor for accumulated aspect terms across conversational turns. |
| `seen.penalty` | `CONFIG.novelty.seen.penalty` | `0.30` | `[0.20, 0.30, 0.40]` | Discount penalty $\beta$ subtracted from normalized relevance scores of previously surfaced passages. |

---

## 3. Evaluation Protocol

1. **Baseline Configurations:**
   - **A0:** Legacy Decayed Context Bag (S2 baseline).
   - **A3:** Headline Novelty Core (Hard Title Filter + Aspect Replacement, without seen penalty).
   - **A4:** Headline Novelty Full (A3 + Seen-Passage Penalty).
2. **Sweep Strategy:**
   - Coordinate sweep: Evaluate baseline and adjacent grid variations for each parameter on DEV.
   - For every grid point, record DEV $\text{nDCG}@10$, $\text{P}@5$, and $\text{MRR}$ across all 30 turns.
   - Save full grid results table to `eval/output/tuning_dev.csv`.
3. **Significance Testing:**
   - Paired bootstrap test (1,000 resamples, fixed seed 42) comparing optimal A3 vs A0, and A4 vs A0 on DEV.
   - Wilcoxon signed-rank test comparing paired turn scores on DEV.
4. **Final Selection Rule:**
   - Select configuration maximizing DEV $\text{nDCG}@10$.
   - In case of a tie or marginal difference ($\Delta \text{nDCG} < 0.005$), retain simpler baseline configuration to avoid overfitting.
