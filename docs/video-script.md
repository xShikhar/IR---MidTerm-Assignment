# TurnTrace Video Demonstration Script (Run-of-Show)

**Duration:** 6–7 Minutes Total  
**Target Audience:** Hackathon Evaluators & IR Course Professors  
**Key Goal:** Demonstrate real, inspectable Information Retrieval principles running live with zero black boxes, showcasing deep trace inspectability, anaphora resolution, topic-shift handling, ambiguity clarification, evaluation benchmarks, and an honest failure case.

---

## Run-of-Show Timeline Overview

| Timestamp | Duration | Segment | Speaker | Core Visual / Demonstration |
|---|---|---|---|---|
| **0:00 – 0:50** | 50s | 1. Problem & Core Thesis | **Member 1** | Slide / UI: The conversational search dilemma, why black boxes fail, TurnTrace pure IR mission. |
| **0:50 – 2:05** | 75s | 2. Live Session: Anaphora & Topic Shift | **Member 3** | Live App: Turn 1 (Vector space), Turn 2 ("in it"), Turn 3 (Topic shift to Black holes). Show trace! |
| **2:05 – 3:00** | 55s | 3. Live Ambiguity Clarification | **Member 3** | Live App: Mercury / Transformers query. Show bimodal clusters & clarifying question. |
| **3:00 – 4:05** | 65s | 4. Code & IR Theory Deep Dive | **Member 1 & 2** | Code Walkthrough: Inverted index, Porter stemmer, SMART `lnc.ltc`, binary min-heap, RRF. |
| **4:05 – 5:00** | 55s | 5. Live Limitation & Honest Failure Case | **Member 4** | Live App & Code: Conv 14 Turn 4 (Shannon entropy to thermodynamic law vocabulary drift). |
| **5:00 – 6:00** | 60s | 6. Benchmark Evaluation & Ablations | **Member 4** | CLI / Charts: `npm run eval` terminal output, Tables 1–3, Topic-shift ablation proof. |
| **6:00 – 6:30** | 30s | 7. Conclusion & Work Summary | **All Members** | Final screen: 4 team owners, GitHub link, 100% reproducible command line checklist. |

---

## Detailed Step-by-Step Script & Speaker Cues

### Segment 1: The Problem & The TurnTrace Mission (0:00 – 0:50)
- **Speaker:** **Member 1**
- **Visual:** TurnTrace UI home screen, then slide showing traditional IR vs Conversational Search.
- **Spoken Script:**
  > *"Hello, everyone. We are Team TurnTrace, presenting our submission for Track T2: Conversational and Agentic Search in CSD358.*  
  > *In classical Information Retrieval, every query is an isolated island. But when humans search conversationally, they speak in pronouns, fragments, and sudden topic shifts. Current solutions tackle this with black-box Large Language Models that obscure the retrieval mechanics and hallucinate.*  
  > *TurnTrace takes the opposite path: we built a fully conversational, inspectable search engine where every decision—from anaphora expansion to topic-shift detection and ambiguity clarification—is driven by pure, mathematical Information Retrieval over a 35,000 passage inverted index, with zero external search or vector database libraries. Everything you see today is real, runnable, and inspectable."*

---

### Segment 2: Live End-to-End Session (Anaphora & Topic Shift) (0:50 – 2:05)
- **Speaker:** **Member 3**
- **Visual:** Screen recording of the TurnTrace web application at `http://localhost:3000`.
- **Action 1:** Type: `"What is the vector space model in information retrieval?"`
  - *Voiceover:* *"Let's begin Turn 1. TurnTrace tokenizes, applies Martin Porter's 1980 stemmer, and scores passages using SMART lnc.ltc cosine similarity. In the trace panel on the right, you see exact millisecond latencies, term weights, and collection IDF statistics."*
- **Action 2:** Type: `"How does term frequency weighting work in it?"`
  - *Voiceover:* *"Notice Turn 2. The query contains the pronoun 'it' and no entity names. Look at the trace inspector: our Topic-Shift Detector computes the cosine angle between the query and our decayed context vector. Because of strong anaphora, it issues a CARRY decision. The query rewriter expands the query with our highest-weight decayed context stems—'vector', 'space', and 'model'—resolving the coreference natively."*
- **Action 3:** Type: `"What is the event horizon of a black hole?"`
  - *Voiceover:* *"Now, watch Turn 3. We make a sudden, cross-domain topic shift from computer science to astrophysics. Our detector calculates a cosine similarity of zero between astrophysics and our CS context vector, with zero pronouns. It issues a RESET decision, purges the decayed context vector, and retrieves pure black hole physics passages without any obsolete vocabulary pollution."*

---

### Segment 3: Live Ambiguity Clarification (2:05 – 3:00)
- **Speaker:** **Member 3**
- **Visual:** Live chat input.
- **Action:** Type: `"Tell me about mercury toxicity and environmental exposure."`
- **Spoken Script:**
  - *Voiceover:* *"In Turn 4, observe what happens when a query exhibits lexical ambiguity. The word 'Mercury' exists in both planetary astronomy and heavy-metal toxicology.*  
  *In the trace, TurnTrace detects that the score margin between rank 1 and rank 2 is below our 0.065 confidence threshold. It performs leader/follower cluster pruning on the top passages, discovers two distinct topical clusters with disjoint high-IDF terms, and automatically synthesizes a clarifying banner:*  
  *'Did you mean planet orbit or mercury toxicity?'*  
  *Crucially, as specified in our rubric, the clarifier never fires when score confidence is high."*

---

### Segment 4: Code & Core IR Component Walkthrough (3:00 – 4:05)
- **Speakers:** **Member 1** and **Member 2**
- **Visual:** VS Code editor displaying the repository modules.
- **Member 1 (Indexing):**
  > *"I am Member 1, responsible for indexing and data. In `server/src/index/`, we implemented Martin Porter's canonical 1980 stemmer across all 5 transformation steps in pure ES modules. In `builder.js` and `postings.js`, our inverted index stores term frequencies across title and body zones, word position offsets for exact phrase search, and precomputes champion lists storing the top 50 documents per term sorted by local log-TF weight."*
- **Member 2 (Retrieval & Scoring):**
  > *"I am Member 2, responsible for scoring and retrieval. In `cosine.js`, we implemented SMART lnc.ltc cosine similarity: logarithmic TF for documents and queries, collection IDF, and Euclidean length normalization. In `heap.js`, we select top-K documents using a binary min-heap in O(N log K) time. In `boolean.js`, multi-term conjunctions are intersected strictly in order of increasing document frequency to minimize intermediate memory. And in `fusion.js`, our decomposer combines sub-queries using Cormack et al.'s Reciprocal Rank Fusion."*

---

### Segment 5: Live Limitation & Honest Failure Case (4:05 – 5:00)
- **Speaker:** **Member 4**
- **Visual:** Live UI displaying Conversation 14, Turn 4.
- **Spoken Script:**
  > *"I am Member 4. In accordance with the hackathon rubric, we present an honest, live failure case of our system.*  
  *In Conversation 14, after discussing Claude Shannon's information entropy formula in bits, the user asks in Turn 4: 'Is entropy always conserved in physical processes?'*  
  *Notice what happens in the trace: because both turns share the stem 'entropi', the cosine similarity remained above the threshold, triggering a CARRY decision. The rewriter appended Shannon's high-IDF communication theory terms—'bit' and 'formula'—into what was intended to be a thermodynamic physics question about the Second Law.*  
  *This illustrates an authentic limitation of unigram term-overlap rewriters: polysemous overlap can induce vocabulary drift when deep ontological semantics are absent."*

---

### Segment 6: Benchmark Evaluation & Ablation Results (5:00 – 6:00)
- **Speaker:** **Member 4**
- **Visual:** Terminal showing `npm run eval` execution and generated tables / SVG chart.
- **Spoken Script:**
  > *"To evaluate TurnTrace rigorously, we built an automated evaluation harness in `eval/` across 70 judged turns with pooled relevance judgments.*  
  *In Table 1, our core rewriter S2 achieves 0.8852 nDCG@10, vastly outperforming naive history concatenation S1 (0.7349).*  
  *Look at Table 3 on Topic-Shift turns: naive concatenation collapses to 0.6693 nDCG@10 due to history pollution, while TurnTrace maintains 0.9856 by properly resetting context.*  
  *Furthermore, in our ablation study (Table 2), turning the topic-shift detector OFF drops nDCG from 0.8852 to 0.7907, proving the empirical power of our IR topic-shift formulation."*

---

### Segment 7: Conclusion & Summary (6:00 – 6:30)
- **Speakers:** **All Members**
- **Visual:** Summary slide with GitHub repository URL, commands, and project credits.
- **Spoken Script:**
  > *"In summary, TurnTrace proves that conversational and agentic search does not need to be an opaque neural black box. By anchoring conversational memory, topic detection, and query rewriting in transparent, classical IR foundations, we achieve high ranking quality, sub-10ms query latencies, and 100% inspectability.*  
  *Our entire codebase, data preparation scripts, tests, and evaluation harness are open-source and reproducible with a single command. Thank you!"*
