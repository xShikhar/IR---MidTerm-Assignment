# Section 4: Novelty & Unique Contributions: Entity-Lock & Aspect-Aware Context

## 4.1 The Baseline: Decayed Context Bag (S2 / A0) and Failure Analysis

Traditional non-neural conversational search engines typically represent dialogue history as an unweighted or exponentially decayed bag of unigrams. In TurnTrace's initial baseline architecture (evaluated as **S2** and ablation **A0**), context is updated per turn by ingesting high-IDF terms from the user query and the top-retrieved document:
$$W(t) = \text{TFIDF}(t) \cdot \lambda^{\text{age}}$$
Topic continuation is evaluated using a unigram vector cosine similarity rule: if $\cos(\mathbf{q}_k, \mathbf{c}_{k-1}) < 0.26$ and no surface pronouns appear, the engine triggers a topic-shift `RESET`, purging all conversational memory.

### Empirical Failure Modes of the Decayed Bag Baseline
1. **False Topic-Shift Resets (Over-Pruning):** Diagnostic evaluation across 30 development turns demonstrated that the cosine threshold of 0.26 erroneously reset **5 valid follow-up turns** (e.g., *"How long did they spend on the lunar surface?"* or specific topical inquiries lacking pronouns). Because follow-up questions introduce specific, narrow terminology with low lexical overlap against the broad introductory turn, unigram cosine drops below 0.26, causing premature memory erasure.
2. **Vocabulary Drift & Polysemy Contamination (Under-Pruning):** When the engine continues context (`CARRY`), every salient term from earlier aspects remains in the decayed vector for up to 4 turns. For example, in Conversation 14 (Thermodynamics & Information Theory), aspects like *"shannon"* and *"bits"* from Turn 3 persisted into Turn 4 (*"Is entropy always conserved in physical processes?"*), contaminating physical entropy retrieval with information-theoretic terminology.
3. **Passage Stagnation:** Without passage tracking, the top-ranked document from Turn 1 is repeatedly retrieved in Turns 2 and 3 if it has high general topical overlap, suppressing fresh evidence needed for the specific follow-up query.

---

## 4.2 Headline Novelty: Entity-Lock & Aspect-Aware Context Tracking

To resolve these structural limitations without introducing black-box large language models or external neural rerankers, TurnTrace implements **Entity-Lock and Aspect-Aware Context Tracking (ContextState v2)**. This architecture formalizes the linguistic distinction between the **focal subject (Entity)** and the **query perspective (Aspect)**.

```
                    Incoming User Turn Q_k
                             │
                             ▼
     ┌──────────────────────────────────────────────────┐
     │           Decision Detector & Guards             │
     │  - Pronoun / Anaphora Guard ('it', 'its', etc.)  │
     │  - Locked Entity Token Presence Guard            │
     │  - Disjoint Entity Candidate Check (Top-3 Titles)│
     └───────────────────────┬──────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
        [ CARRY ]    [ ENTITY_SWITCH ]    [ RESET ]
            │                │                │
     Hold Locked Entity   Lock New Entity   Purge All Context
     Aspect Replacement   Drop Old Aspects  Fresh State
            │                │                │
            └────────────────┼────────────────┘
                             ▼
     ┌──────────────────────────────────────────────────┐
     │        Hard-Lock Boolean Title Filter            │
     │  - Intersect postings in Title Zone              │
     │  - Fallback to Soft Boost (2.0x) if |C| < 10     │
     └───────────────────────┬──────────────────────────┘
                             │
                             ▼
     ┌──────────────────────────────────────────────────┐
     │        Seen-Passage Penalty (Novelty)            │
     │  - Demote previously displayed docs by (1 - β)   │
     └──────────────────────────────────────────────────┘
```

### 4.2.1 Entity vs. Aspect Definitions
- **Entity Terms ($E$):** The core subject of conversational inquiry (e.g., *"James Webb Space Telescope"*, *"Apollo 11"*, *"Mercury"*). An entity term is defined as a stemmed query term with collection $\text{IDF} \ge 2.50$ that appears in the **title zone** of at least 1 document within the top-3 shallow retrieval results. Once locked, entity terms persist across follow-up turns until an explicit entity switch or topic reset occurs.
- **Aspect Terms ($A$):** The specific property, instrument, sub-topic, or condition being queried about the entity (e.g., *"primary mirror size"*, *"damping factor"*, *"toxicity symptoms"*). Aspect terms are defined as non-stopword query terms with collection $\text{IDF} \ge 2.50$ that are disjoint from the locked entity set.

### 4.2.2 Transition Decision Taxonomy & Multi-Layer Guards
Transition classification replaces the fragile cosine threshold with an explicit entity-disjointness state machine:
- **`CARRY` (Continuation):** The user continues the existing dialogue thread. ContextState keeps the locked entity intact.
  - **Guard 1 (Pronoun/Anaphora):** If the query contains any surface pronoun (`"it"`, `"its"`, `"they"`, `"them"`, `"their"`, `"this"`, `"that"`), the transition is guaranteed to `CARRY`.
  - **Guard 2 (Locked Entity Token):** If the query contains any token belonging to the currently locked entity, the transition is guaranteed to `CARRY`.
  - **Guard 3 (Candidate Qualification):** An entity candidate introduced by the query only triggers an entity switch if it produces title-zone hits in the top 3 retrieval candidates. Pure topical nouns without top-3 title presence default to `CARRY`.
- **`ENTITY_SWITCH` (Disjoint Entity, Partial Overlap):** The user introduces a new, disjoint entity candidate that qualifies with top-3 title hits, but the query retains lexical overlap with preceding conversational context (e.g., transitioning from Apollo 11 to Apollo 13, or comparing PageRank to HITS). The engine updates the locked entity to the new subject while clearing old aspect terms.
- **`RESET` (Disjoint Entity, Zero Overlap):** The user switches to a completely unrelated domain or entity with zero lexical overlap with preceding context (e.g., jumping from Space Telescopes to Renaissance Art). All entity and aspect memory is purged.

### 4.2.3 Aspect Dynamics: Replacement vs. Additive Accumulation
Unlike the legacy decayed bag where aspects accumulate indefinitely:
- **Default Replacement:** On standard `CARRY` follow-ups, incoming aspect terms **replace** prior aspect terms entirely. For example, moving from *"primary mirror size"* to *"infrared instruments"* immediately evicts *"mirror"* and *"size"*, eliminating vocabulary drift.
- **Additive Accumulation:** If the user query contains additive linguistic cues (*"also"*, *"and"*, *"in addition"*, *"as well"*), or under ablation **A2**, aspect terms accumulate with exponential decay ($\lambda_{\text{aspect}} = 0.60$):
$$W_{\text{old\_aspect}} \leftarrow W_{\text{old\_aspect}} \cdot \lambda_{\text{aspect}}, \quad W_{\text{new\_aspect}} = 1.0$$
- **Pure Follow-Up Preservation:** If a query contains pronouns or questions with zero new aspect terms (e.g., *"Where is its orbit located in space?"*), active aspects are preserved without modification.

---

## 4.3 Hard-Lock Boolean Title Filter with Graceful Fallback

To guarantee that conversational retrieval remains strictly centered on the focal entity, TurnTrace enforces a multi-tier title-zone constraint:

### 1. Hard Title Filter Conjunction
For each locked entity term $e \in E$, the engine looks up its title-zone postings list $P_{\text{title}}(e)$. It computes the Boolean intersection across entity terms:
$$\mathcal{C}_{\text{allowed}} = \bigcap_{e \in E} \{d \mid \langle d, \text{tf}_{\text{title}} \rangle \in P_{\text{title}}(e), \text{tf}_{\text{title}} \ge 1\}$$
Passage scoring (BM25 or Cosine) is restricted strictly to documents within $\mathcal{C}_{\text{allowed}}$.

### 2. Candidate Starvation Fallback (`lock.minCandidates = 10`)
If the candidate pool contains fewer than 10 documents ($|\mathcal{C}_{\text{allowed}}| < 10$), enforcing the hard lock would starve the user of results. The engine automatically executes a **graceful fallback**:
- Switches mode to **Soft Boost**.
- Evaluates retrieval across the general corpus.
- Multiplies the title-zone contribution of entity terms by $2.0\times$ (`entityBoost: 2.0`).
- Flags `fallback: true` in the trace inspector for transparent system auditing. Across 70 benchmark turns, the fallback rate is **27.1%** (19 turns), active primarily on highly specific or multi-term compound entities.

---

## 4.4 Seen-Passage Penalty for Novelty Discovery

In multi-turn search, returning the identical passage across consecutive turns frustrates users seeking additional information. TurnTrace introduces a session-isolated `SeenPassageTracker`:
- At each turn, documents displayed in the top-10 ranked results are recorded in the session set $\mathcal{S}_{\text{seen}}$.
- On subsequent turns, if document $d \in \mathcal{S}_{\text{seen}}$ appears in the candidate ranking, its final retrieval score is discounted by the penalty parameter $\beta = 0.30$:
$$\text{Score}'(d) = \text{Score}(d) \cdot (1 - \beta) = \text{Score}(d) \cdot 0.70$$
- **Empirical Trade-Off:** In benchmark evaluation, the seen-passage penalty increases **Novelty@10 from 0.7029 (A3) to 0.8943 (A4)**, discovering 27.2% more unread relevant evidence while preserving top relevance if no alternative document surpasses the threshold.

---

## 4.5 Term-Level Provenance & Unredacted Trace Inspector

TurnTrace's query rewriter constructs an expanded retrieval query while attaching exact provenance to every token:
$$\mathbf{q}_{\text{rewritten}} = \mathbf{q}_{\text{original}} \cup E_{\text{locked}} \cup A_{\text{active}}$$
Every term in the rewritten query carries:
- `role`: `'original'`, `'entity'`, or `'aspect'`
- `sourceTurn`: Dialog turn index where the token originated
- `weight`: Effective scoring weight applied in retrieval

This metadata is rendered in real time in the TurnTrace React frontend, giving judges and users full visibility into every IR decision.

---

## 4.6 Initial Configuration & Untuned Parameter Disclosure

In accordance with strict empirical guidelines, all novelty parameters are currently initialized with baseline values and marked as untuned pending completion of human relevance judging:

| Configuration Key | Initial Value | Status | Description & Rationale |
|:---|:---:|:---:|:---|
| `novelty.entity.minIdf` | `2.50` | `[Untuned Initial]` | Minimum collection IDF for entity candidate eligibility |
| `novelty.entity.topN` | `3` | `[Untuned Initial]` | Retrieval depth inspected for entity title hits |
| `novelty.entity.minTitleHits`| `1` | `[Untuned Initial]` | Minimum title-zone occurrences in top-N to qualify as entity |
| `novelty.aspect.minIdf` | `2.50` | `[Untuned Initial]` | Minimum collection IDF for aspect term eligibility |
| `novelty.aspect.decayLambda`| `0.60` | `[Untuned Initial]` | Exponential decay factor for accumulated aspects |
| `novelty.lock.minCandidates`| `10` | `[Untuned Initial]` | Candidate threshold triggering hard-to-soft fallback |
| `novelty.lock.entityBoost` | `2.0` | `[Untuned Initial]` | Score multiplier for entity terms in soft mode |
| `novelty.seen.penalty` | `0.30` | `[Untuned Initial]` | Demotion factor $(1 - \beta = 0.70)$ for previously seen passages |
| `clarification.margin` | `0.065` | `[Untuned Initial]` | Margin threshold; tuning deferred pending judged qrels |

---

## 4.7 Full System & Novelty Ablation Taxonomy

To isolate the individual contribution of each IR component, TurnTrace defines an exhaustive ablation matrix:

| System / Ablation | Architecture | Entity Lock Mode | Aspect Behavior | Seen Penalty | Description |
|:---|:---|:---:|:---:|:---:|:---|
| **S0** | Raw Query Only | None | None | None | Baseline: Independent turn queries, zero context |
| **S1** | Naive Concat | None | None | None | Concatenation of all previous queries |
| **S2 / A0** | Legacy Bag Baseline | None (Cosine Shift) | Unigram Decay Bag | None | Decayed TF-IDF bag with unigram cosine shift detector |
| **S3** | TurnTrace Full | Hard Lock (Title Zone) | Aspect Replacement | $\beta = 0.30$ | Full system: Headline novelty + Decomposer + Clarifier |
| **S5** | Oracle Reference | N/A | N/A | None | Upper bound: Human gold rewrite queries |
| **A1** | Soft Boost Only | Soft ($2.0\times$) | Aspect Replacement | None | Evaluates soft boosting without Boolean title filter |
| **A2** | Aspect Accumulation | Hard Lock (Title Zone) | Aspect Accumulation | None | Evaluates accumulation vs. replacement |
| **A3** | Headline Novelty Core| Hard Lock (Title Zone) | Aspect Replacement | None | Core novelty: Entity lock + Aspect replacement |
| **A4** | Seen-Penalty Ablation| Hard Lock (Title Zone) | Aspect Replacement | $\beta = 0.30$ | Evaluates impact of seen-passage penalty on Novelty@10 |
| **A5** | Always-Carry Isolation| Hard Lock (Title Zone) | Aspect Replacement | None | Decision ablation: Forces decision to CARRY always |
| **A6** | Always-Reset Isolation| None | None | None | Decision ablation: Forces decision to RESET always |
| **R1** | Champion Lists | Retrieval Efficiency | Champion List Top-R | None | Inverted index efficiency ablation ($r = 50$) |
| **R2** | Index Elimination | Retrieval Efficiency | Low-IDF Pruned | None | Inverted index efficiency ablation ($\text{IDF} \ge 2.50$) |
