# TurnTrace Video Demonstration Script (Run-of-Show)

**Duration:** 6–7 Minutes Total  
**Target Audience:** Hackathon Evaluators & IR Course Professors  
**Key Goal:** Demonstrate real, inspectable Information Retrieval principles running live with zero black boxes, showcasing deep trace inspectability, Entity-Lock with aspect-aware context tracking, title-zone filtering, graceful fallback, seen-passage penalties, evaluation benchmarks, and an honest failure case.

---

## Run-of-Show Timeline Overview

| Timestamp | Duration | Segment | Speaker | Core Visual / Demonstration |
|---|---|---|---|---|
| **0:00 – 0:45** | 45s | 1. Problem & Core Thesis | **Member 1** | Slide / UI: The conversational search dilemma, why black boxes fail, TurnTrace pure IR mission. |
| **0:45 – 1:45** | 60s | 2. Live Headline Novelty: Entity Lock & Aspect Context | **Member 3** | Live App: Turn 1 (JWST), Turn 2 ("its orbit" pronoun guard), Turn 3 (Aspect replacement), Turn 4 (Entity switch to Apollo 11). Show trace! |
| **1:45 – 2:30** | 45s | 3. Title-Zone Filter & Hard-Lock Fallback | **Member 3** | Live App: High-specificity query showing Hard Lock Boolean title filter vs Graceful Fallback (<10 matches) & Seen penalty. |
| **2:30 – 3:15** | 45s | 4. Live Ambiguity Clarification | **Member 3** | Live App: Mercury query. Show bimodal clusters, margin threshold, & clarifying question. |
| **3:15 – 4:15** | 60s | 5. Code & IR Theory Deep Dive | **Member 1 & 2** | Code Walkthrough: Inverted index, Porter stemmer, SMART `lnc.ltc`, binary min-heap, titleFilter, seenPenalty. |
| **4:15 – 5:05** | 50s | 6. Live Limitation & Honest Failure Case | **Member 4** | Live App & Code: Conv 14 Turn 4 (Shannon entropy to thermodynamic law vocabulary drift). |
| **5:05 – 6:00** | 55s | 7. Benchmark Evaluation & Novelty Ablations | **Member 4** | CLI / Charts: `npm run eval` terminal output, Tables 1–7, Novelty@10 trade-off, and Dev diagnostic. |
| **6:00 – 6:30** | 30s | 8. Conclusion & Work Summary | **All Members** | Final screen: 4 team owners, GitHub link, 100% reproducible command line checklist. |

---

## Detailed Step-by-Step Script & Speaker Cues

### Segment 1: The Problem & The TurnTrace Mission (0:00 – 0:45)
- **Speaker:** **Member 1**
- **Visual:** TurnTrace UI home screen, then slide showing traditional IR vs Conversational Search.
- **Spoken Script:**
  > *"Hello, everyone. We are Team TurnTrace, presenting our submission for Track T2: Conversational and Agentic Search in CSD358.*  
  > *In classical Information Retrieval, every query is an isolated island. But when humans search conversationally, they speak in pronouns, aspects, and sudden entity shifts. Current systems tackle this with black-box Large Language Models that obscure the retrieval mechanics, hallucinate, and incur high latencies.*  
  > *TurnTrace takes the opposite path: we built an inspectable conversational search engine where every decision—from entity locking and aspect tracking to transition classification and seen-passage penalties—is driven by pure, mathematical Information Retrieval over a 35,000 Wikipedia passage inverted index, with zero external search or vector database libraries. Everything you see today is real, runnable, and inspectable."*

---

### Segment 2: Live Headline Novelty: Entity Lock & Aspect Context (0:45 – 1:45)
- **Speaker:** **Member 3**
- **Visual:** Screen recording of the TurnTrace web application at `http://localhost:3000`.
- **Action 1:** Type: `"What is the James Webb Space Telescope?"`
  - *Voiceover:* *"Let's begin Turn 1. TurnTrace analyzes the query, scores passages using SMART lnc.ltc cosine similarity, and inspects the title zone of top-3 results. In the trace panel on the right, you see our Entity Extractor establishes an Entity Lock on 'James Webb Space Telescope' (IDF 3.24) with 3/3 title hits."*
- **Action 2:** Type: `"Where is its orbit located in space?"`
  - *Voiceover:* *"Notice Turn 2. The query contains the pronoun 'its' and the aspect 'orbit'. In legacy cosine systems, low lexical overlap erroneously triggered false topic resets. But in TurnTrace, our Pronoun Guard and Locked Entity Guard guarantee a CARRY decision. The locked entity is held intact, and the new aspect 'orbit' is introduced."*
- **Action 3:** Type: `"Tell me about its primary mirror size."`
  - *Voiceover:* *"Now observe Turn 3. The user pivots to a new aspect: the primary mirror. In a naive decayed bag, 'orbit' would linger and pollute future queries. TurnTrace's Aspect Replacer cleanly evicts 'orbit' and replaces it with 'mirror' and 'size', completely preventing vocabulary drift while holding the telescope entity locked."*
- **Action 4:** Type: `"When did the Apollo 11 mission land on the Moon?"`
  - *Voiceover:* *"In Turn 4, the user introduces a new subject: Apollo 11. Our detector recognizes Apollo 11 has top-3 title hits disjoint from the space telescope. It fires an ENTITY_SWITCH decision, transitions the lock to Apollo 11, and drops all previous telescope aspects."*

---

### Segment 3: Title-Zone Filter & Hard-Lock Fallback (1:45 – 2:30)
- **Speaker:** **Member 3**
- **Visual:** Live App showing trace inspector sections 3 and 6.
- **Action:** Query a highly specific follow-up.
- **Spoken Script:**
  - *Voiceover:* *"In Section 3 of the trace, observe our Hard-Lock Boolean Title Filter. TurnTrace intersects postings lists strictly in the document title zone to guarantee every retrieved passage is about the locked entity.*  
  *However, if the candidate pool has fewer than 10 documents—our lock.minCandidates threshold—enforcing the hard conjunction would starve the user of results. The trace shows TurnTrace automatically triggers a graceful fallback to Soft Boost mode, multiplying entity title scores by 2.0x while retrieving from the broader corpus.*  
  *Furthermore, in Section 6, our Seen-Passage Penalty discounts previously viewed documents by 30%, driving Novelty@10 from 0.70 to 0.89 and surfacing fresh evidence."*

---

### Segment 4: Live Ambiguity Clarification (2:30 – 3:15)
- **Speaker:** **Member 3**
- **Visual:** Live chat input.
- **Action:** Type: `"Tell me about mercury toxicity and environmental exposure."`
- **Spoken Script:**
  - *Voiceover:* *"In Turn 5, observe what happens when a query exhibits lexical ambiguity. The word 'Mercury' exists in both planetary astronomy and heavy-metal toxicology.*  
  *In the trace, TurnTrace detects that the score margin between rank 1 and rank 2 is below our 0.065 confidence threshold. It performs leader/follower cluster pruning on the top passages, discovers two distinct topical clusters with disjoint high-IDF terms, and automatically synthesizes a clarifying banner:*  
  *'Did you mean planet orbit or mercury toxicity?'*  
  *Crucially, the clarifier never fires when score confidence is high, preserving an uninterrupted search experience."*

---

### Segment 5: Code & Core IR Component Walkthrough (3:15 – 4:15)
- **Speakers:** **Member 1** and **Member 2**
- **Visual:** VS Code editor displaying the repository modules.
- **Member 1 (Indexing & Normalization):**
  > *"I am Member 1. In `server/src/index/`, we implemented Martin Porter's canonical 1980 stemmer across all 5 transformation steps in pure ES modules. In `builder.js` and `postings.js`, our multi-zone inverted index stores term frequencies across title and body zones, word position offsets for exact phrase search, and precomputes champion lists storing the top 50 documents per term sorted by local log-TF weight."*
- **Member 2 (Retrieval, Title Filter, & Seen Penalty):**
  > *"I am Member 2. In `cosine.js` and `bm25.js`, we implemented SMART lnc.ltc and Okapi BM25. In `titleFilter.js`, we enforce Boolean AND intersection across title-zone postings for entity locking. In `seenPenalty.js`, our `SeenPassageTracker` discounts previously viewed documents by multiplying scores by (1 - 0.30). And in `rewriter.js`, every token in the expanded query carries explicit term provenance—role, source turn, and weight—visible in the trace."*

---

### Segment 6: Live Limitation & Honest Failure Case (4:15 – 5:05)
- **Speaker:** **Member 4**
- **Visual:** Live UI displaying Conversation 14, Turn 4.
- **Spoken Script:**
  > *"I am Member 4. In accordance with the hackathon rubric, we present an honest, live failure case of our system.*  
  *In Conversation 14, after discussing Claude Shannon's information entropy formula in bits, the user asks in Turn 4: 'Is entropy always conserved in physical processes?'*  
  *Notice what happens in the trace: because both turns share the stem 'entropi', the system classified this as a continuation under CARRY. The rewriter appended Shannon's high-IDF communication theory terms—'shannon' and 'bit'—into what was intended to be a thermodynamic physics question about the Second Law.*  
  *This illustrates an authentic limitation of lexical IR: polysemous overlap can bridge two distinct technical domains when deep ontological semantics are absent."*

---

### Segment 7: Benchmark Evaluation & Novelty Ablations (5:05 – 6:00)
- **Speaker:** **Member 4**
- **Visual:** Terminal showing `npm run eval` execution and generated tables / SVG chart.
- **Spoken Script:**
  > *"To evaluate TurnTrace rigorously, we built an automated evaluation harness in `eval/` across 70 turns with a 14-system benchmark matrix.*  
  *Human relevance judging is currently in progress across 4 student judges using system-blind pooling sheets.*  
  *On development conversations, our diagnostic comparison shows that our new decision detector rescued 5 follow-up turns that the legacy cosine rule falsely reset.*  
  *In our Novelty study (Table 3), the seen-passage penalty increases Novelty@10 from 0.7029 in A3 to 0.8943 in A4—a 27.2% gain in surfacing fresh evidence.*  
  *And on our test split, our paired bootstrap test with fixed PRNG seed 42 and Wilcoxon signed-rank test are fully configured to evaluate statistical significance as soon as human labels are submitted."*

---

### Segment 8: Conclusion & Summary (6:00 – 6:30)
- **Speakers:** **All Members**
- **Visual:** Summary slide with GitHub repository URL, commands, and project credits.
- **Spoken Script:**
  > *"In summary, TurnTrace proves that conversational search does not need to be an opaque neural black box. By anchoring conversational memory, entity locking, aspect tracking, and query rewriting in transparent, classical IR foundations, we achieve high ranking quality, sub-10ms query latencies, and 100% inspectability.*  
  *Our entire codebase, real Wikipedia corpus, indexing scripts, unit tests, and evaluation harness are open-source and reproducible with a single command. Thank you!"*
