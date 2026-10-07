# TurnTrace Video Demonstration Script (Run-of-Show)

**Total Target Duration:** Exactly 6:45 (405 Seconds) | Allowed Range: 5:00 – 8:00 Minutes  
**Track:** CSD358 Information Retrieval Hackathon — Track T2 (Conversational & Agentic Search)  
**Format:** 100% Live Demo & Code/Trace Walkthrough (No Slides)  
**System Evaluated:** TurnTrace Conversational Search Engine (100% Classical IR, Zero Runtime LLMs)  

---

## 1. Segment Timing & Master Schedule Table

| Segment | Start – End | Duration | Speaker | Focus & Demonstration Artifact |
|:---:|:---:|:---:|:---:|---|
| **1** | 0:00 – 0:50 | 50s | **Member 1** [Member Name] | Problem Statement, Track T2 Alignment, Architectural Mission |
| **2** | 0:50 – 1:50 | 60s | **Member 1** [Member Name] | Offline Inverted Index, Morphological Pipeline & **Collection Stats Modal** |
| **3** | 1:50 – 3:00 | 70s | **Member 2** [Member Name] | SMART `lnc.ltc` vs BM25, **Controls Ribbon**, **Live Rescore** & **Mathematical Score Modal** |
| **4** | 3:00 – 4:25 | 85s | **Member 3** [Member Name] | Live Dialogue: **Benchmark Modal**, Entity Lock, **4-Tab Trace Inspector**, Aspect Eviction, RRF, Phrases & **Topic Shift** |
| **5** | 4:25 – 5:10 | 45s | **Member 3** [Member Name] | Live Architectural Limitation & Polysemy Boundary (`conv_11` Mercury / `conv_14` Entropy) |
| **6** | 5:10 – 6:20 | 70s | **Member 4** [Member Name] | Benchmark Evaluation, Significance Tests, Novelty Trade-Offs & AI-Label Declaration |
| **7** | 6:20 – 6:45 | 25s | **All Members** | Rehearsed Summary, Open-Source GitHub Repository & 1-Command Reproduction |
| **Total** | **0:00 – 6:45** | **405s** | **4 Members** | **Full Compliance with 5–8 Minute Constraint** |

---

## 2. Rehearsal Checklist (Pre-Recording Setup)

Execute these exact steps before recording the video:

1. **Clean Dependencies & Build Verification:**
   ```bash
   npm install
   npm run verify:data
   npm test
   ```
   *(Ensure all 83 unit/integration tests pass across server and eval workspaces).*

2. **Launch Application Daemons:**
   ```bash
   npm run dev
   ```
   - Express REST API running at: `http://localhost:3001`
   - Vite React Trace Inspector running at: `http://localhost:3000`

3. **Browser Window Setup:**
   - Open Google Chrome (or Chromium browser) at 1080p (1920×1080) resolution.
   - **Tab 1:** `http://localhost:3000` (TurnTrace Web UI, zoom level at 100% or 110% for crisp display).
   - **Tab 2:** `eval/output/test_final/retrieval_tradeoffs.svg` (Ready to show the P@10 vs Novelty@10 trade-off scatter plot).

4. **Terminal Setup:**
   - Font size: `16pt` or `18pt` monospace font (Consolas, Menlo, or JetBrains Mono).
   - Clear terminal buffer (`clear` / `cls`).
   - Prepared command: `npm run eval -- --split=test` ready to execute.

5. **VS Code Workspace:**
   - Tabs pinned:
     - `server/src/index/builder.js`
     - `server/src/retrieval/cosine.js`
     - `server/src/conversation/contextState.js`
     - `eval/src/systemsRunner.js`

---

## 3. Segment-by-Segment Script & Spoken Action Cues

### Segment 1: Problem & Track T2 Alignment (0:00 – 0:50 | 50s)
- **Speaker:** **Member 1** `[Member name placeholder]`
- **Screen:** Live browser on `http://localhost:3000` showing the clean TurnTrace UI, search bar, controls ribbon, and unredacted execution trace drawer on the right.
- **Actions:** Click search input, point cursor to the unredacted execution trace drawer on the right.
- **Spoken Script:**
  > *"Hello, everyone. We are Team TurnTrace, presenting our project for Track T2: Conversational and Agentic Search in the CSD358 Information Retrieval Hackathon.*  
  > *In classical search, queries are treated as independent one-shot events. But in conversational search, users issue follow-ups using ambiguous pronouns like 'its', refer to implicit properties like 'primary mirror size', and abruptly pivot between entities.*  
  > *Most modern conversational systems address this by slapping a black-box Large Language Model on top, introducing ungrounded hallucinations, opaque rankings, and multi-second latencies.*  
  > *TurnTrace takes a radically different approach: we built an inspectable conversational search engine where conversational context tracking, entity locking, aspect replacement, and query decomposition are driven purely by collection statistics over a 35,000 Wikipedia passage inverted index. No LLM or neural embedding is used at runtime. Every decision is 100% transparent and inspectable in real time."*

---

### Segment 2: Indexing, Morphological Analysis & Collection Stats Modal (0:50 – 1:50 | 60s)
- **Speaker:** **Member 1** `[Member name placeholder]`
- **Screen:** Split screen between VS Code (`server/src/index/builder.js`) and live UI (`http://localhost:3000`).
- **Exact Code Locations Shown:**
  - File: `server/src/index/builder.js`, Function: `buildIndex()`
  - File: `server/src/index/postings.js`, Function: `PostingsList.add()`
  - File: `server/src/index/porterStemmer.js`, Function: `stem()`
- **UI Feature Demonstrated:**
  - In the top navigation bar, click the **"Collection Stats"** button.
  - The **Collection Statistics Modal (`StatsModal`)** opens on screen:
    - Point to **Total Passages: 35,000** authentic Wikipedia sections.
    - Point to **Vocabulary Size: 80,684** distinct stemmed terms.
    - Point to **Total Postings: 1,489,533** inverted index entries.
    - Point to the **4 balanced domains**: Computer Science & AI (9,222 passages), Space Exploration (9,266), History (9,081), and Biology & Medicine (7,431).
  - Close the modal.
- **Command to Run / Show:**
  ```bash
  npm run verify:data
  ```
- **3 Plain-Language Talking Points:**
  1. **Multi-Zone Collection Indexing:** 35,000 Wikipedia passages indexed with separate title ($0.35$) and body ($0.65$) zones, computing exact document lengths and Euclidean norms offline.
  2. **First-Principles Text Pipeline:** Canonical Martin Porter (1980) 5-step morphological stemmer and SMART 174 stopword list implemented in pure ES modules with zero third-party search libraries.
  3. **Positional Postings & Precomputed Champions:** Postings lists strictly sorted by `docId` store exact word offsets for phrase verification, plus top-$r=50$ champion lists for fast candidate generation.
- **Spoken Script:**
  > *"I am Member 1, responsible for indexing and data preprocessing. In `server/src/index/builder.js`, our engine constructs a multi-zone inverted index mapping 80,684 unique vocabulary terms across 35,000 documents.*  
  > *In `porterStemmer.js`, we implemented the full 1980 Porter stemmer from first principles, correctly stripping morphological suffixes like 'ing', 'ational', and 'izer'.*  
  > *Every postings entry in `postings.js` records document frequencies ($df$), term frequencies ($tf$), and token positions. We also precompute Champion Lists caching the top 50 documents per term.*  
  > *In the UI, clicking 'Collection Stats' shows our collection breakdown: 35,000 passages and 1.48 million postings balanced across Computer Science, Space Physics, History, and Biology.*  
  > *When we run `npm run verify:data`, the SHA-256 hashes of our corpus and index match the frozen specification down to the exact byte."*

---

### Segment 3: Dual Scoring, Controls Ribbon, Rescore & Mathematical Score Breakdown (1:50 – 3:00 | 70s)
- **Speaker:** **Member 2** `[Member name placeholder]`
- **Screen:** Live UI at `http://localhost:3000` showing the Controls Ribbon, switching briefly to VS Code (`server/src/retrieval/cosine.js`).
- **Exact Code Locations Shown:**
  - File: `server/src/retrieval/cosine.js`, Function: `scoreCosineLncLtc()`
  - File: `server/src/retrieval/bm25.js`, Function: `scoreBM25()`
  - File: `server/src/retrieval/boolean.js`, Function: `evaluateBooleanAnd()`
  - File: `server/src/retrieval/fusion.js`, Function: `reciprocalRankFusion()`
- **UI Features Demonstrated:**
  1. **Interactive Controls Ribbon:**
     - Point out the **Scoring Model switch**: Click between **"SMART lnc.ltc Cosine"** and **"Okapi BM25"**.
     - Point out the **Entity Lock Mode switch**: Toggle between **"Hard Lock (Title Zone)"** and **"Soft Boost (2.0×)"**.
     - Point out the **Seen Passage Penalty chip**: Toggle **"Novelty Active (β=0.30)"** vs disabled.
     - Point out the **Efficiency Pruning chips**: Toggle **"Champion Lists (r=50)"** and **"Index Elimination (IDF ≥ 2.50)"**.
  2. **Live Rescore Button:**
     - Switch the scoring model from Cosine to BM25, and click the **"Rescore Last Turn"** button. Show how the top documents and scores update dynamically without retyping the query!
  3. **Mathematical Score Breakdown Modal (`ScoreModal`):**
     - Click the score badge / inspect icon on Result Card `#1` (`doc_01716`).
     - The modal opens showing the exact applied mathematical equation:
       - If BM25: Okapi BM25 equation with $k_1 = 1.2, b = 0.75, avgdl = 83.58$.
       - If Cosine: SMART `lnc.ltc` equation with $\sum w_{t,q} \cdot w_{t,d} / (\|D\|_2 \cdot \|Q\|_2)$.
       - Per-term contribution table: Query Term, TF in Doc, BM25 IDF, saturation factor, and net score product.
     - Close the modal.
- **Spoken Script:**
  > *"I am Member 2, responsible for the retrieval and scoring engine. In `cosine.js`, we implement the classic Salton & Buckley SMART `lnc.ltc` vector space model with logarithmic TF and Euclidean length normalization, alongside Okapi BM25 in `bm25.js`.*  
  > *Our interactive Controls Ribbon lets users dynamically toggle between SMART Cosine and Okapi BM25, switch between Hard Title-Zone Lock and Soft 2.0x Boosting, toggle Seen-Passage Novelty, and activate Ablation R1 Champion Lists.*  
  > *When we change a parameter and click 'Rescore Last Turn', the engine instantly re-ranks the candidates online in under 5 milliseconds.*  
  > *Furthermore, clicking 'Inspect Score' on any result card pops open our mathematical score breakdown modal. It displays the exact retrieval equation applied and a full per-term decomposition—showing term frequency in document, collection IDF, saturation term, and final product—proving our first-principles math directly on screen."*

---

### Segment 4: Live Conversational Dialogue & 4-Tab Trace Inspector (3:00 – 4:25 | 85s)
- **Speaker:** **Member 3** `[Member name placeholder]`
- **Screen:** Fullscreen browser UI at `http://localhost:3000`. Live conversational search session.
- **UI Features Demonstrated:**
  1. **Benchmark Scenarios Modal (`BenchmarkModal`):**
     - Click **"Benchmark Scenarios"** in Navbar.
     - Show the grid of 14 pre-configured conversations tagged by challenge type (*Anaphora*, *Topic Shift*, *Polysemy*, *Comparative*).
     - Click **"James Webb Space Telescope (JWST)" (`conv_03`)** to load the dialogue into the prompt bar.
  2. **Turn 1 (Initial Entity Establishment):**
     - Click / execute Turn 1: `"What is the James Webb Space Telescope?"`
     - Point to top result `doc_01716` ("James Webb Space Telescope - Section 3", score: 0.4117).
     - Open **Trace Tab 1 (State & Decision):**
       - Decision Badge: `CARRY` (Turn 1 init).
       - Locked Entity: `jame` (IDF: 4.12), `webb` (IDF: 5.55), `space` (IDF: 3.45), `telescop` (IDF: 4.60).
       - Title Candidates: 100 matching title-zone documents; Hard Filter active.
  3. **Turn 2 (Pronoun Anaphora & Token Provenance):**
     - Click / execute Turn 2: `"Where is its orbit located in space?"`
     - Open **Trace Tab 1 (State & Decision):**
       - Pronoun Guard catches `'its'` $\implies$ Decision: `CARRY`.
     - Switch to **Trace Tab 2 (Rewriter & Phrase):**
       - Show the rewritten query with color-coded provenance pills:
         - **Green pills:** Original query terms (`orbit`, `locat`).
         - **Cyan pills:** Carried entity tokens (`jame`, `webb`, `telescop`) appended deterministically from the entity lock.
  4. **Turn 3 (Aspect Eviction vs Accumulation & Seen-Passage Penalty):**
     - Click / execute Turn 3: `"Tell me about its primary mirror size."`
     - Trace **Tab 1:** Point out Aspect Replacement: previous aspects (`orbit`, `locat`) are evicted and replaced with (`primari`, `mirror`, `size`), preventing vocabulary drift!
     - Switch to **Trace Tab 4 (Novelty & Profiler):**
       - Point out **Seen Passage Penalty**: Passage `doc_01716` from Turn 1 received a 30% discount penalty ($\beta=0.30$, multiplier $0.70$), promoting fresh, unseen passages to the top!
       - Point out the **Latency Profiler**: Microsecond breakdown across Tokenization (0.1ms), Decision Detection (0.2ms), Rewriting (0.2ms), and Candidate Retrieval (2.1ms).
  5. **Turn 4 (Multi-Part Query Decomposer & Positional Phrase):**
     - Execute comparative query: `"How does transformer self-attention differ from recurrent neural networks?"` (`conv_02`, Turn 4).
     - Trace **Tab 2:** Point out Query Decomposer: identifies comparative pattern, extracts clauses `"transformer self-attention"` and `"recurrent neural networks"`, runs Boolean sub-queries, and merges rankings with Reciprocal Rank Fusion ($k=60$).
     - Execute quoted phrase: `"\"quantum supremacy\""` (`conv_01`, Turn 4) $\to$ Trace confirms exact positional postings intersection at distance 1.
  6. **Turn 5 (Topic Shift / Entity Switch):**
     - Execute: `"What were the key achievements of the Apollo 11 lunar landing?"` (`conv_04`, Turn 1).
     - Trace **Tab 1:** Decision Detector triggers `ENTITY_SWITCH` / `RESET` $\to$ clears the JWST entity lock, establishes Apollo 11 lock, proving context resets cleanly without topic bleed.
  7. **Session Isolation:**
     - Click the **"New Conversation"** button in Navbar to demonstrate generating a fresh `sessionId` and wiping session history.
- **Spoken Script:**
  > *"I am Member 3, presenting TurnTrace running live on our benchmark dialogues.*  
  > *In Navbar, clicking 'Benchmark Scenarios' displays all 14 evaluated conversations. Let's load the James Webb Space Telescope conversation.*  
  > *In Turn 1, we ask: 'What is the James Webb Space Telescope?' Look at Tab 1 of the Trace Inspector: the engine extracts high-IDF title terms to lock 'James', 'Webb', 'Space', and 'Telescope', isolating 100 title candidates.*  
  > *In Turn 2: 'Where is its orbit located in space?' Our Pronoun Guard catches 'its' and issues a CARRY decision. Switching to Tab 2 shows the rewritten query with color-coded provenance pills: green for original terms, and cyan for carried entity tokens.*  
  > *In Turn 3: 'Tell me about its primary mirror size.' Unlike naive concatenation which accumulates tokens forever, our Aspect Replacer evicts 'orbit' and establishes 'mirror' and 'size'.*  
  > *In Tab 4, our Seen-Passage Tracker penalizes doc_01716 from Turn 1 by 30%, surfacing novel evidence. Tab 4 also gives a microsecond latency breakdown.*  
  > *When we ask comparative queries like 'transformer self-attention differ from recurrent neural networks', Tab 2 demonstrates our multi-part query decomposer splitting clauses and fusing with Reciprocal Rank Fusion.*  
  > *Finally, when we pivot to Apollo 11, our Decision Detector triggers an ENTITY_SWITCH, cleanly resetting context without topic bleed. And 'New Conversation' guarantees tab session isolation."*

---

### Segment 5: Live Architectural Limitation & Lexical Polysemy Boundary (4:25 – 5:10 | 45s)
- **Speaker:** **Member 3** `[Member name placeholder]`
- **Screen:** Browser UI on `http://localhost:3000` executing the failure turn, then opening Trace Tab 1 and Tab 3.
- **Turn Action:**
  - Type / click: `"Tell me about mercury toxicity and environmental exposure."` (Conversation `conv_11`, Turn 4, after 3 turns discussing Mercury the planet).
  - Trace Display: Show `shiftDecision`: `CARRY`, `lockedEntity`: `mercuri`, `titleFilter`: Matches both astronomical and chemical passages.
- **Spoken Script:**
  > *"In accordance with the hackathon rubric, we believe in rigorous academic transparency and now demonstrate an authentic limitation of classical lexical IR.*  
  > *In Conversation 11, after three turns exploring Mercury the planet's solar orbit and surface craters, Turn 4 asks: 'Tell me about mercury toxicity and environmental exposure.'*  
  > *Look at Tab 1 of the trace: because the query contains the stem 'mercuri', our locked entity guard classifies this as a CARRY continuation. While aspect replacement successfully replaces 'orbit' with 'toxic' and 'environment', both 'Mercury (planet)' and 'Mercury (element)' share the exact same title stem 'mercuri'.*  
  > *Without an external semantic ontology or runtime LLM, a pure inverted index cannot distinguish lexical polysemy when the surface stem is identical. We document this failure boundary openly in our evaluation and report."*

---

### Segment 6: Benchmark Evaluation, Statistical Significance & Declarations (5:10 – 6:20 | 70s)
- **Speaker:** **Member 4** `[Member name placeholder]`
- **Screen:** Terminal running `npm run eval -- --split=test`, followed by switching to Browser Tab 2 showing `retrieval_tradeoffs.svg`.
- **Exact Code Locations Shown:**
  - File: `eval/src/systemsRunner.js`, Function: `evaluateSession()`
  - File: `eval/src/significance.js`, Function: `runSignificanceTests()`
  - File: `eval/src/metrics.js`, Function: `computeNdcgAtK()`
- **Command to Run:**
  ```bash
  npm run eval -- --split=test
  ```
- **Exact Numbers from `eval/output/test_final/`:**
  - **S0 (Raw Query Baseline):** P@10 = 0.7975, MRR = 0.9500, nDCG@10 = 0.6732, Novelty@10 = 0.9250
  - **S1 (Naive Concatenation):** P@10 = 0.9425, nDCG@10 = 0.6572, Novelty@10 = 0.4500 (Drastic -51% collapse in novelty!)
  - **S2 / A0 (Legacy Bag Baseline):** P@10 = 0.8650, MRR = 0.9875, nDCG@10 = 0.6875, Novelty@10 = 0.8175
  - **A3 (Headline Novelty Core):** P@10 = 0.8800, MRR = 0.9563, nDCG@10 = 0.6317, Novelty@10 = 0.6250
  - **A4 (A3 + Seen Penalty $\beta=0.30$):** Novelty@10 lifts to **0.7600** (+21.6% relative gain in new evidence)
  - **Statistical Tests (A3 vs A0):** Paired Bootstrap $p=0.1325$, Wilcoxon $p=0.2358$ (Not statistically significant at $\alpha=0.05$, proving an honest trade-off between strict entity lock vs broad background recall).
  - **Transition Classification:** Macro-F1 lifts from 0.3179 (legacy cosine rule) to **0.4152** (our decision detector), with accuracy rising from 65.63% to **84.38%** (reducing false resets from 11 down to 4).
- **Important Ethical Declaration:**
  - Relevance judgments in `data/qrels.json` (2,297 pairs) are LLM-generated under our fixed deterministic rubric; conversation transitions are AI-labeled.
  - Human validation is pending; blind human spot-check infrastructure is established in `eval/output/spot_check_sheet.csv`.
- **Spoken Script:**
  > *"I am Member 4, and I led the evaluation framework. Running `npm run eval -- --split=test` evaluates 13 distinct systems across all 40 turns of our test benchmark in under 6 seconds.*  
  > *Our results in `systems_comparison.csv` reveal crucial IR insights: naive concatenation S1 achieves high precision (0.9425) but collapses Novelty@10 down to 0.4500 by continuously re-retrieving the same passages.*  
  > *Our headline system A3 maintains high top-rank precision (P@5 = 0.9150) while strictly restricting topic drift. When we apply the seen penalty in A4, Novelty@10 increases from 0.6250 to 0.7600—a 21.6% relative boost in discovering fresh passages, as visualized in our retrieval trade-off plot.*  
  > *Our paired bootstrap ($p=0.1325$) and Wilcoxon ($p=0.2358$) tests confirm that A3 vs A0 represents an intentional trade-off between strict entity focus and broad background recall.*  
  > *In classification, our new decision detector cuts false resets from 11 down to 4, lifting accuracy from 65.6% to 84.4%.*  
  > *We transparently declare: all 2,297 relevance judgments are LLM-generated under our fixed rubric. Independent human validation is pending, and we have provided a 100-row blind spot-check sheet in `spot_check_sheet.csv`."*

---

### Segment 7: Summary, Repository & Deliverables (6:20 – 6:45 | 25s)
- **Speakers:** **All Members**
- **Screen:** Clean summary screen showing the GitHub repository URL, final report PDF, and reproduction commands.
- **Spoken Script:**
  > *"In summary, TurnTrace proves that conversational search can be built on rigorous, inspectable classical IR foundations without relying on opaque cloud APIs.*  
  > *Our entire system—from the 35,000-passage index and Porter stemmer to the interactive trace inspector and evaluation suite—is open-source, fully documented in our report, and reproducible with one command. Thank you!"*

---

## 4. Verification of Commands Mentioned in Script

All commands in this script have been verified locally by the team:
- `npm run verify:data` $\implies$ **PASS** (Matches both SHA-256 checksums in 1.8s)
- `npm test` $\implies$ **PASS** (83/83 tests pass across server and eval)
- `npm run eval -- --split=test` $\implies$ **PASS** (13 systems evaluated in 5.6s)
- `npm run dev` $\implies$ **PASS** (API on port 3001, Vite UI on port 3000)
- End-to-end chat turn $\implies$ **PASS** (Sub-10ms response with complete unredacted trace)
