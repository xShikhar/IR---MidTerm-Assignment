# Topic-Shift Detector: Failure Analysis & Entity-Lock Replacement Design

**Document ID:** `TT-NOTE-2026-10-06-01`  
**Status:** Design Proposal (No Code Changes Yet — Awaiting Judged Qrels & Human Shift Labels)  
**Scope:** Conversational State Tracking & Topic Transition Gate

---

## 1. Problem: Failure Mode on Development Split

Evaluation on the 6 development conversations (24 multi-turn transitions) revealed that the current lexical cosine detector produces **11 false resets** on conversational follow-ups.

### 1.1 Root Cause Analysis

Under the current implementation ([`server/src/conversation/shiftDetector.js`](file:///c:/Project/IR-Assignment/server/src/conversation/shiftDetector.js)):
1. The detector compares the sparse vector of the unexpanded raw query against the exponentially decayed context vector using unigram cosine similarity.
2. If $\text{cosine} < 0.26$, the detector checks for surface linguistic anaphora (pronouns such as *"it"*, *"they"*, *"he"*, *"she"* or short ellipsis markers).
3. If no pronoun is present and the query is not a brief ellipsis, the system declares a `RESET` topic shift.

In natural conversational search, users frequently ask aspectual, mechanistic, or historical follow-ups **without using pronouns**:
- They introduce aspect-specific terminology (*"damping factor"*, *"mould"*, *"germline editing"*, *"literacy rates"*, *"cosine normalization"*).
- Because these aspect terms have not appeared in preceding turns, their unigram cosine similarity with the decayed context vector drops to $0.0000$ (or below $0.26$).
- Because the user phrased the question as a complete syntactic sentence (e.g. *"What is the standard damping factor value?"*), no surface pronouns or ellipsis markers trigger the anaphora override.
- Result: the detector purges context memory, resetting the session precisely when conversational context was required.

### 1.2 Observed Dev Failures (11 Follow-up Resets)

| # | Turn Key | Query | Cosine | Current Action | Reason for False Reset |
|---|---|---|---|---|---|
| 1 | `conv_01_turn_03` | *"What about cosine normalization?"* | 0.0000 | `RESET` | Specific aspect of vector space model; no pronoun used. |
| 2 | `conv_01_turn_04` | *"Why is document length normalization needed?"* | 0.2111 | `RESET` | Sub-topic follow-up; cosine below threshold 0.26. |
| 3 | `conv_02_turn_02` | *"Who invented the algorithm at Stanford?"* | 0.1802 | `RESET` | Named entity follow-up on PageRank; no pronoun used. |
| 4 | `conv_02_turn_03` | *"What is the random surfer model?"* | 0.0000 | `RESET` | Core mechanism of PageRank; no pronoun used. |
| 5 | `conv_02_turn_05` | *"What is the standard damping factor value?"* | 0.0000 | `RESET` | Parameter query for PageRank; zero unigram lexical overlap. |
| 6 | `conv_05_turn_02` | *"How does the guide RNA locate target DNA sequences?"* | 0.0000 | `RESET` | Mechanistic step in CRISPR editing; zero lexical overlap. |
| 7 | `conv_05_turn_04` | *"What ethical concerns surround human germline editing?"* | 0.0558 | `RESET` | Societal impact follow-up on CRISPR; no pronoun used. |
| 8 | `conv_07_turn_05` | *"What were the broader impacts on European literacy rates?"* | 0.0000 | `RESET` | Consequence query for Gutenberg press; zero lexical overlap. |
| 9 | `conv_10_turn_02` | *"What mould produced the antibiotic substance?"* | 0.0000 | `RESET` | Biological agent inquiry for Penicillin; no pronoun used. |
| 10 | `conv_11_turn_03` | *"What are the extreme temperature variations on the surface?"* | 0.0000 | `RESET` | Physical property inquiry for planet Mercury; zero overlap. |
| 11 | `conv_11_turn_05` | *"What organs does the toxic metal damage?"* | 0.2333 | `RESET` | Medical consequence follow-up on Mercury poisoning; cosine < 0.26. |

*(Note: In contrast, genuine topic shifts on dev—such as `conv_10_turn_04` "Who painted the Mona Lisa in Florence?" and `conv_11_turn_04` "Tell me about mercury toxicity and environmental exposure"—correctly reset, but follow-ups were collateral damage).*

---

## 2. Proposed Replacement: Entity-Lock & Candidate Disjointness

To replace fragile lexical cosine thresholds without introducing generative neural models or latency overhead, TurnTrace will implement an **Entity-Lock with Disjoint Candidate Detection** architecture.

### 2.1 Core Architectural Principles

1. **Carry by Default:**
   In a conversational search session, continuity is the default assumption. Conversational turns carry context unless explicit positive evidence demonstrates an entity departure.
2. **Entity Locking:**
   The session locks the active primary entity (e.g. *PageRank*, *Vector Space Model*, *CRISPR*, *Penicillin*, *Mercury (planet)*) established in the initial or recent turns. The lock consists of the entity identifier, title-zone tokens, and salient high-IDF descriptive stems.
3. **Disjoint Candidate Verification for `RESET` / `entity_switch`:**
   A transition away from the locked entity is declared **only if** both conditions hold:
   - **Salient Query Entities:** The current query contains candidate terms with collection-wide $\text{IDF} \ge \text{minIdf}$.
   - **Disjoint Title-Zone Hits:** The top-$N$ retrieved candidate passages for these query terms have title-zone matches that are **disjoint** from the locked entity's title tokens and aliases.
4. **Aspect vs. Entity Discrimination:**
   If a query introduces high-IDF terms (e.g. *"damping factor"*, *"mould"*, *"germline"*) whose top retrieval candidates still match or co-occur with the locked entity's title zone, the system classifies the query as an **aspectual follow-up** on the current entity, maintaining `CARRY` without purging context.

---

## 3. Implementation Plan & Governance

### 3.1 Strict Evaluation Guardrails
- **Zero Tuning on Test Set:** Thresholds ($\text{minIdf}$, top-$N$ title matching depth, entity overlap bounds) must never be tuned on test conversations (`data/splits.json`).
- **Deferred Implementation:** Code changes to `shiftDetector.js` will occur only after:
  1. Human annotators complete relevance judging on `eval/output/pooling/judge_*_pool.csv`.
  2. Annotators complete gold action labeling on `eval/output/shift_labeling_sheet.csv` (`expectedAction`).
- Once judged labels exist, tuning will be performed strictly on the 6 Dev conversations, and headline performance will be reported on the held-out 8 Test conversations.
