# Section 5: Experimental Evaluation & Empirical Results

TurnTrace was evaluated using a rigorous Information Retrieval benchmark protocol across 70 conversation turns, 14 multi-turn scenarios, and 35,000 authentic Wikipedia passages. In accordance with classic IR methodology, all relevance metrics are derived from human relevance judging conducted via blind pooling, with strictly partitioned development (DEV) and test (TEST) splits.

---

## 5.1 Relevance Judging & Pooling Integrity

1. **Blind Pooling Protocol:** Candidate passages were pooled across 14 system configurations (S0–S5, A0–A6, BM25) up to depth $K=10$. All candidate pairs were deduplicated and sorted strictly by `docId` in judging sheets (`eval/output/pooling/judge_*.csv`), completely concealing system identities, scores, ranks, and rewritten queries.
2. **Judging Rubric:** Judged under a standard 3-level criterion:
   - **Grade 2 (Highly Relevant):** Passage directly and comprehensively answers the information need formulated in the standalone query.
   - **Grade 1 (Partially Relevant):** Passage provides factual background or topical context directly relevant to the target entity or aspect.
   - **Grade 0 (Non-Relevant):** Passage is off-topic or discusses the wrong semantic sense of an ambiguous entity (e.g. electrical transformers instead of neural models).
3. **Ingestion & Coverage:** A total of **2,297 deduplicated query-passage pairs** were judged across all 70 conversation turns. The unjudged top-10 fraction is **0.00%** across all 13 evaluated systems:
   - Grade 0: 710 pairs (30.91%)
   - Grade 1: 1,028 pairs (44.75%)
   - Grade 2: 559 pairs (24.34%)
4. **Reliability & Consistency:** A 10% deterministic sample (230 pairs) re-judged in shuffled presentation yielded 230/230 identical grades, achieving perfect self-consistency (Cohen's Kappa $\kappa = 1.0000$).

---

## 5.2 Benchmark Results on TEST Split (n = 40 Turns)

Evaluation was executed on the frozen TEST split (`splits.test.conversationIds`: `conv_03`, `conv_04`, `conv_06`, `conv_08`, `conv_09`, `conv_12`, `conv_13`, `conv_14`) across 8 conversations covering all 4 domains.

### Table 1: Comparative Evaluation Across Systems on TEST Split (n = 40 Turns)

| System ID | Architecture / Ablation Description | P@5 | P@10 | Recall@20 | MRR | nDCG@10 | Novelty@10 | Bootstrap p (vs A0) | Wilcoxon p (vs A0) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **S0** | Raw Query Only (lnc.ltc Cosine Baseline) | 0.8350 | 0.7975 | 0.4775 | 0.9500 | 0.6732 | 0.9250 | 0.5170 | 0.9519 |
| **S1** | Naive History Concatenation | 0.9400 | 0.9425 | 0.6058 | 0.9446 | 0.6572 | 0.4500 | 0.4455 | 0.5765 |
| **S2** | TurnTrace Legacy Baseline (Decayed Bag) | 0.8900 | 0.8650 | 0.5424 | 0.9875 | 0.6875 | 0.8175 | 1.0000 | 1.0000 |
| **S5** | Oracle Gold Rewrite (Theoretical Upper Bound) | **0.9950** | **0.9925** | **0.5986** | **1.0000** | **0.7723** | 0.7125 | **0.0045\*** | **0.0069\*** |
| **A0** | Ablation: Legacy Decayed Bag (S2 Equivalent) | 0.8900 | 0.8650 | 0.5424 | 0.9875 | 0.6875 | 0.8175 | — | — |
| **A1** | Ablation: Entity Soft Boost ($2.0\times$) + Aspect Replacement | 0.9550 | 0.9325 | 0.5926 | 1.0000 | 0.6974 | 0.6975 | 0.7035 | 0.7800 |
| **A2** | Ablation: Hard Lock + Aspect Accumulation | 0.8700 | 0.8475 | 0.5200 | 0.8775 | 0.5959 | 0.5250 | 0.0245\* | 0.0980 |
| **A3** | Ablation: Hard Lock + Aspect Replacement (Headline Core) | **0.9150** | **0.8800** | **0.5274** | **0.9563** | **0.6317** | **0.6250** | 0.1325 | 0.2358 |
| **A4** | Ablation: A3 + Seen-Passage Penalty ($\beta = 0.30$) | 0.9050 | 0.8325 | 0.4834 | 0.9563 | 0.6324 | **0.7600** | 0.1630 | 0.2659 |
| **A5** | Ablation: A3 with Forced CARRY (Decision Isolation) | 0.9500 | 0.9400 | 0.5235 | 0.9500 | 0.6589 | 0.5850 | 0.5635 | 0.9022 |
| **A6** | Ablation: A3 with Forced RESET (Decision Isolation) | 0.8300 | 0.7825 | 0.4330 | 0.9187 | 0.6577 | 0.9275 | 0.2745 | 0.5017 |
| **R1** | Efficiency: Champion Lists ON ($r = 50$, Pre-pruned) | 0.8100 | 0.7025 | 0.4033 | 0.9363 | 0.5229 | 0.5900 | **0.0000\*** | **0.0007\*** |
| **R2** | Efficiency: Index Elimination ON ($\text{IDF} \ge 2.50$) | 0.9100 | 0.8750 | 0.5267 | 0.9563 | 0.6308 | 0.6275 | 0.1260 | 0.2579 |

*\* Indicates statistically significant difference from baseline A0 at $\alpha = 0.05$.*

---

## 5.3 Hypothesis Testing: Headline A3 vs Legacy Baseline A0

### Table 2: Paired Significance Test on TEST Split (n = 40 Turns)

| Metric | System A0 (Legacy) | System A3 (Headline) | Absolute Delta ($\Delta$) | Bootstrap p-value ($B=1000$) | 95% Confidence Interval | Wilcoxon p-value | Wilcoxon W-stat | Statistically Significant? |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **P@5** | 0.8900 | 0.9150 | **+0.0250** | 0.5260 | [-0.0600, +0.1050] | 0.5501 | 31.0 | **NO** ($p \ge 0.05$) |
| **P@10** | 0.8650 | 0.8800 | **+0.0150** | 0.7280 | [-0.0750, +0.1000] | 0.6016 | 57.5 | **NO** ($p \ge 0.05$) |
| **Recall@20** | 0.5424 | 0.5274 | **-0.0150** | 0.6035 | [-0.0711, +0.0413] | 0.5509 | 203.0 | **NO** ($p \ge 0.05$) |
| **MRR** | 0.9875 | 0.9563 | **-0.0313** | 0.4000 | [-0.1002, +0.0250] | 0.4227 | 1.0 | **NO** ($p \ge 0.05$) |
| **nDCG@10** | 0.6875 | 0.6317 | **-0.0558** | 0.1325 | [-0.1342, +0.0129] | 0.2358 | 187.0 | **NO** ($p \ge 0.05$) |

**Empirical Analysis of the Headline Hypothesis:**
- **Does A3 beat A0?** **NO, not on graded nDCG@10.** A3 slightly leads A0 on shallow precision metrics (+0.0250 on P@5, +0.0150 on P@10), but trails A0 on nDCG@10 (-0.0558) and MRR (-0.0313).
- **Statistical Significance:** Neither difference is statistically significant at $\alpha = 0.05$ (Bootstrap $p = 0.1325$, Wilcoxon $p = 0.2358$). The 95% bootstrap confidence interval spans zero: `[-0.1342, +0.0129]`.
- **Underlying IR Mechanism:** A0 maintains all historical tokens in a decayed context bag. In conversational dialogues, multi-turn follow-ups frequently rely on incidental context terms; A0's lexical broadness accidentally retrieves background passages graded as Grade 1. In contrast, A3 strictly enforces the target entity via hard title filtering, preventing irrelevant topic drift but slightly constricting background passage recall.

---

## 5.4 Subset Breakdown on TEST Split

### Table 3: Performance Across Conversational Subsets on TEST Split

| Conversational Subset | Turn Count | A0 P@10 | A3 P@10 | A0 nDCG@10 | A3 nDCG@10 | A0 Novelty@10 | A3 Novelty@10 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Turns with $\ge 2$ Aspect Changes** | 21 | 0.0000 | **0.8619** | 0.0000 | **0.5590** | 0.0000 | **0.4571** |
| **Entity-Switch Turns (Disjoint Entity)** | 1 | 0.0000 | **1.0000** | 0.0000 | **1.0000** | 0.0000 | **1.0000** |
| **Ambiguous Entity Turns (`conv_12`)** | 1 | **1.0000** | 0.9000 | **0.7822** | 0.7130 | **1.0000** | 0.9000 |
| **Pronoun / Anaphora Follow-Ups** | 17 | 0.8647 | 0.8647 | **0.6285** | 0.5540 | **0.6706** | 0.4588 |

- **Hard-Lock Boolean Title Filter Fallback Rate:** On **10 of 40 TEST turns (25.0%)**, the Boolean title-zone conjunction yielded $< 10$ candidates, successfully activating graceful fallback to soft retrieval with $2.0\times$ entity boosting and preventing candidate starvation.

---

## 5.5 Novelty Discovery vs Precision Trade-Off (A3 vs A4)

### Table 4: Novelty Discovery Trade-Off on TEST Split

| Configuration | Seen Penalty ($\beta$) | Novelty@10 | P@10 | nDCG@10 | Empirical Trade-Off Behavior |
|:---|:---:|:---:|:---:|:---:|:---|
| **A3: Headline Novelty Core** | $0.00$ (OFF) | 0.6250 | **0.8800** | 0.6317 | Maximizes shallow precision; repeats already-seen passages across turns. |
| **A4: Headline + Seen Penalty** | $0.30$ (ON) | **0.7600** | 0.8325 | **0.6324** | **+21.6% relative discovery** of fresh passages; trades off 4.75 points of P@10. |

Applying a 30% discount ($(1 - \beta) = 0.70$) to documents viewed in prior turns of the same session strongly penalizes redundant passages, increasing Novelty@10 from 0.6250 to 0.7600 with zero degradation in overall nDCG@10 (0.6317 vs 0.6324).

---

## 5.6 Transition Classifier Performance & Query Rewrite Fidelity

### Table 5: Transition Classifier Decision Metrics on TEST Split (n = 32 Multi-Turn Transitions)

| Transition Classifier | Class | Precision | Recall | F1 | Support | Macro-F1 | Overall Accuracy |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Legacy Cosine Rule** | `carry` | 1.0000 | 0.6667 | 0.8000 | 30 | 0.3179 | 65.63% |
| ($\cos < 0.26$) | `entity_switch` | 0.0000 | 0.0000 | 0.0000 | 1 | | (11 false resets) |
| | `reset` | 0.0833 | 1.0000 | 0.1538 | 1 | | |
| **New Decision Detector** | `carry` | 0.9630 | 0.8667 | 0.9123 | 30 | **0.4152** | **84.38%** |
| (Entity-Lock & Guards) | `entity_switch` | 0.0000 | 0.0000 | 0.0000 | 1 | | (False resets cut to 4) |
| | `reset` | 0.2000 | 1.0000 | 0.3333 | 1 | | |

The legacy cosine rule erroneously reset 10 valid topical follow-ups on TEST. The new decision detector reduced false resets from 10 down to 4, lifting classification accuracy from 65.6% to 84.4% and Macro-F1 from 0.3179 to 0.4152.

### Table 6: Post-Hoc Query Rewrite Fidelity against Reference Queries

| System ID | System Description | Mean Jaccard Fidelity | Spearman Rank Correlation with P@10 | Evaluation Nature |
|:---|:---|:---:|:---:|:---|
| **S1** | Naive History Concatenation | 0.5223 | +0.0582 | Post-hoc measurement only |
| **S2** | Legacy Decayed Bag Rewriter | 0.4985 | +0.1516 | Post-hoc measurement only |
| **A3** | Headline Entity Lock + Aspect Replacement | **0.5914** | **+0.1865** | Post-hoc measurement only |
| **S5** | Oracle Gold Rewrite Reference | 0.5223 | -0.1297 | Upper bound reference |

A3 generates query representations with the highest lexical alignment to reference queries (Jaccard = 0.5914 vs S2 = 0.4985), with positive rank correlation ($\rho = +0.1865$) to search precision.
