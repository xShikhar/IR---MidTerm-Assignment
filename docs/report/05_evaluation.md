# Section 5: Experimental Evaluation & Empirical Results

> **Status Notice on Benchmark Evaluation:**
> In accordance with academic integrity and rigorous Information Retrieval methodology, the benchmark evaluation protocol relies on human relevance judgments currently in progress across 4 student judges via system-blind pooling sheets (`eval/output/pooling/judge_*.csv`). 
> Relevance metrics (Precision, Recall, MRR, nDCG) will populate automatically upon submission of human qrels. All structural, diagnostic, and novelty metrics reported below reflect live runs executed via `npm run eval`.

---

## 5.1 System Taxonomy & Comparative Evaluation Protocol

TurnTrace evaluates **14 configurations** spanning full conversational systems, novelty ablations, and retrieval efficiency modes across 14 stratified dialogue scenarios (70 turns) and 35,000 Wikipedia passages.

### Table 1: Comparative Evaluation Across Systems & Novelty Ablations (70 Turns)

| System ID | Architecture / Ablation Description | P@5 | P@10 | Recall@20 | MRR | nDCG@10 | Novelty@10 |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **S0** | Raw Query Only (lnc.ltc Cosine Baseline) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9571 |
| **S1** | Naive History Concatenation | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9429 |
| **S2** | TurnTrace Legacy Baseline (Decayed Bag + Cosine Shift) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7414 |
| **S3** | TurnTrace Full Headline (Lock + Aspect + Seen Penalty) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | **0.8943** |
| **S5** | Oracle Gold Rewrite (Theoretical Upper Bound) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9571 |
| **A0** | Ablation: Legacy Decayed Bag (S2 Equivalent) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7414 |
| **A1** | Ablation: Soft Boost ($2.0\times$) + Aspect Replacement | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7029 |
| **A2** | Ablation: Hard Lock + Aspect Accumulation | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7029 |
| **A3** | Ablation: Hard Lock + Aspect Replacement (Headline Core) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7029 |
| **A4** | Ablation: A3 + Seen-Passage Penalty ($\beta = 0.30$) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | **0.8943** |
| **A5** | Ablation: A3 with Forced CARRY (Decision Isolation) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7029 |
| **A6** | Ablation: A3 with Forced RESET (Decision Isolation) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9571 |
| **R1** | Efficiency: Champion Lists ON ($r = 50$, Pre-pruned) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7414 |
| **R2** | Efficiency: Index Elimination ON ($\text{IDF} \ge 2.50$) | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7414 |

---

## 5.2 Subset Breakdown: Legacy Bag (A0) vs. Headline Novelty (A3)

To pinpoint the source of performance differences, we segment the conversational corpus into 4 targeted subsets:

### Table 2: Subset Breakdown: A0 (Legacy Decayed Bag) vs. A3 (Headline Novelty Core)

| Conversational Subset | Turn Count | A0 P@10 | A3 P@10 | A0 nDCG@10 | A3 nDCG@10 | A0 Novelty@10 | A3 Novelty@10 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Turns with $\ge 2$ Aspect Changes** | 38 | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.6120 | **0.5816** |
| **Entity-Switch Turns (Disjoint Entity)** | 2 | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9000 | **0.9500** |
| **Ambiguous Entity Turns** | 2 | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.9500 | 0.8000 |
| **Pronoun / Anaphora Follow-Ups** | 25 | *[Pending]* | *[Pending]* | *[Pending]* | *[Pending]* | 0.7160 | 0.6000 |

- **Hard-Lock Boolean Title Filter Fallback Rate:** Across 70 benchmark turns, the Boolean title-zone conjunction yielded $< 10$ candidates on **19 turns (27.1%)**, successfully activating graceful fallback to soft retrieval with $2.0\times$ entity boosting and preventing candidate starvation.

---

## 5.3 Novelty Discovery vs. Precision Trade-Off (A3 vs. A4)

A major challenge in conversational search is presenting novel passages rather than recirculating identical snippets across turns.

### Table 3: Novelty Discovery Trade-Off (A3 vs. A4)

| Configuration | Seen Penalty ($\beta$) | Novelty@10 | P@10 | Empirical Trade-Off Behavior |
|:---|:---:|:---:|:---:|:---|
| **A3: Headline Novelty Core** | $0.00$ (OFF) | 0.7029 | *[Pending]* | Maximizes raw relevance; permits passage repetition across dialogue turns. |
| **A4: Headline + Seen Penalty** | $0.30$ (ON) | **0.8943** | *[Pending]* | Demotes seen documents by 30%; boosts discovery of novel evidence (+27.2%). |

*Empirical Note:* Applying a 30% score penalty ($(1 - \beta) = 0.70$) to documents viewed in prior turns of the same session encourages the ranker to surface unviewed evidence. If an already-viewed passage has overwhelming relevance, it remains within top-10 despite the penalty.

---

## 5.4 Query Rewrite Fidelity against Reference Queries

Rewrite fidelity evaluates the token-level Jaccard similarity between the system's rewritten query and the human reference gold rewrite (computed post-hoc over stemmed, stopword-free token sets):

### Table 4: Query Rewrite Fidelity (Post-Hoc Metric; Zero Retrieval Leakage)

| System ID | System Description | Mean Jaccard Fidelity | Spearman Rank Correlation with P@10 | Evaluation Nature |
|:---|:---|:---:|:---:|:---|
| **S1** | Naive History Concatenation | 0.5532 | *[Pending qrels]* | Dilutes specific entities with conversational noise |
| **S2** | Legacy Decayed Bag Rewriter | 0.5287 | *[Pending qrels]* | Carries obsolete aspect terms across turns |
| **A3** | Headline Entity Lock + Aspect Replacement | **0.5747** | *[Pending qrels]* | Isolates locked entity and active aspect |
| **S3** | TurnTrace Full Headline | **0.5747** | *[Pending qrels]* | Matches A3 core query rewriting |
| **S5** | Oracle Gold Rewrite Reference | 0.5532 | *[Pending qrels]* | Reference human baseline |

---

## 5.5 Transition Classifier Diagnostic: Legacy Cosine vs. New Decision Rule

### Table 5: Transition Classifier Diagnostic on Dev Split (6 Convs, 30 Turns)

| Transition Classifier | CARRY | RESET | ENTITY_SWITCH | Follow-Ups Rescued from Reset |
|:---|:---:|:---:|:---:|:---:|
| **Legacy Cosine Shift Detector** ($\cos < 0.26$) | 13 | 11 | 0 | — |
| **New Decision Detector** (Entity Lock & Aspect Guards) | **20** | **3** | **1** | **5 turns rescued** |

- **Key Finding:** On development conversations, the legacy cosine detector erroneously triggered RESET on **5 topical follow-ups** lacking surface pronouns because narrow follow-up queries shared insufficient unigram overlap with the introductory turn. The new decision detector correctly preserves entity context via locked entity tokens and pronoun guards.
- **Human Transition Labeling Status:** Currently 0/70 turns labeled in `data/conversations.json` (annotation underway via `eval/output/shift_labeling_sheet.csv`). Precision, Recall, and Confusion Matrix will evaluate upon annotation commit.

---

## 5.6 Documented Failure Case & Boundary Analysis

### Table 6: Documented Failure Case & Boundary Condition Analysis

| Case | Scenario | Turn Query | Observed Failure Mode | Root Cause & IR Lesson |
|:---|:---|:---|:---|:---|
| **Limitation Case** (Vocabulary Drift) | Conv 14 (Thermodynamics) | Turn 4: *"Is entropy always conserved in physical processes?"* | Retained *"shannon"* and *"bits"* from prior turn in Shannon information theory. | Aspect replacement requires distinct lexical cues; polysemous term *"entropy"* bridged two technical domains without triggering an entity switch. |
| **Boundary Case** (Candidate Scarcity) | Specific Multi-Term Entities | Turns where title Boolean AND yields $< 10$ docs. | Hard-lock title filter gracefully falls back to soft retrieval. | Prevents candidate starvation while boosting entity title weights by $2.0\times$. |

---

## 5.7 Statistical Significance Testing Setup (F-06 Protocol)

To prevent p-hacking and guarantee uncompromised statistical testing:
- **Split Separation:** Tuning was conducted strictly on the **Dev split (6 conversations, 30 turns)**.
- **Test Protocol:** Headline significance will be evaluated strictly on the **Test split (8 conversations, 40 turns)** using:
  1. **Deterministic Paired Bootstrap Test:** 2,000 bootstrap resamples with fixed seed (`PRNG seed = 42`).
  2. **Wilcoxon Signed-Rank Test:** Paired non-parametric test handling zero-difference pairs.
  3. **Hypothesis Comparisons:** $H_1: \text{A3} > \text{A0}$ and $H_2: \text{A3} > \text{S0}$ evaluated at $\alpha = 0.05$.
- Output will execute automatically and report empirical $p$-values and 95% confidence intervals once human qrels are committed.
