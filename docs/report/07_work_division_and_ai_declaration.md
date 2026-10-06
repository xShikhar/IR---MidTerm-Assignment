# Section 7: Work Division & AI-Use Declaration

## 7.1 Team Ownership Matrix (Equal 4-Member Distribution)

| Member | Assigned Component | Key Deliverables & Implemented Modules | Video Presentation Focus |
|---|---|---|---|
| **Member 1** | **Indexing, Data & Preprocessing** | - Corpus acquisition & multi-domain structuring from Wikipedia (`prepareCorpus.js`)<br>- Lexical tokenizer & positional tracking (`tokenizer.js`)<br>- Martin Porter (1980) 5-step stemmer (`porterStemmer.js`)<br>- Multi-zone inverted index & postings (`postings.js`, `builder.js`)<br>- Precomputed champion lists (`championLists.js`)<br>- Disk serializer & stats (`serializer.js`, `buildIndex.js`)<br>- Unit tests (`server/test/index.test.js`) | Offline indexing pipeline, multi-zone tokenization, positional postings, and champion lists. |
| **Member 2** | **Retrieval, Scoring & Fusion Engine** | - SMART `lnc.ltc` vector space cosine engine (`cosine.js`)<br>- Okapi BM25 scoring model (`bm25.js`)<br>- Binary min-heap top-K selector (`heap.js`)<br>- Index elimination IDF pruner (`indexElimination.js`)<br>- Boolean engine with DF-ordered intersection (`boolean.js`)<br>- Positional phrase query processor (`phrase.js`)<br>- Reciprocal Rank Fusion & Score-Sum (`fusion.js`)<br>- Unit tests (`server/test/retrieval.test.js`) | Scoring equations, Euclidean length normalization vs BM25, DF-ordered Boolean intersection, and RRF. |
| **Member 3** | **Conversational Layer & Tracking** | - Decayed term-weight context state vector (`contextState.js`)<br>- Topic-shift detector with anaphora heuristics (`shiftDetector.js`)<br>- Index-driven query rewriter with provenance (`rewriter.js`)<br>- Multi-part query decomposer (`decomposer.js`)<br>- Leader/follower cluster clarifier (`clarifier.js`)<br>- Unit tests (`server/test/conversation.test.js`) | Conversational memory, exponential decay formula, cosine topic-shift detection, and cluster-pruned clarifier. |
| **Member 4** | **Evaluation, API & Trace Inspector UI** | - Qrels loader & pooling sheet generator (`qrelsLoader.js`, `generatePoolingSheet.js`)<br>- IR metrics engine: P@k, Recall, MRR, nDCG (`metrics.js`)<br>- Benchmark runner across systems S0–S3, S5 and ablations A1–A6 (`systemsRunner.js`)<br>- Paired bootstrap & Wilcoxon significance testing (`significance.js`)<br>- CSV tables & SVG chart generator (`export.js`)<br>- Express REST API & session manager (`server.js`)<br>- Central trace assembly engine (`traceAssembly.js`)<br>- React + Vite Trace Inspector interface (`client/src`)<br>- Integration tests (`server/test/api.test.js`, `eval/test/metrics.test.js`) | Evaluation benchmark results, ablation study findings, live interactive trace walkthrough, and failure case. |

---

## 7.2 Corpus Provenance & Data Sources

The 35,000-passage multi-domain evaluation corpus was constructed exclusively from authentic English Wikipedia articles across four balanced domains:
1. **Computer Science & Artificial Intelligence** (8,750 passages)
2. **Physics & Space Exploration** (8,750 passages)
3. **History & Inventions** (8,750 passages)
4. **Biology & Medicine** (8,750 passages)

**Data Collection Sources:**
- **Primary Live Source:** Wikipedia Action API (`https://en.wikipedia.org/w/api.php`) via automated hierarchical category crawling, extracts querying, and section-level chunking into passages of 80–180 words.
- **Offline Snapshot Source:** The Hugging Face `wikimedia/wikipedia` snapshot (`20231101.en`) used for bulk fallback text extraction.

---

## 7.3 AI-Use Declaration

In accordance with academic integrity guidelines, we declare the extent and nature of AI assistance used in this project:

1. **Permitted AI Assistance Utilized:**
   - **Antigravity IDE:** Utilized as an intelligent developer environment to assist with code syntax scaffolding, boilerplate typing, drafting initial unit test assertions, and structuring markdown documentation templates.
2. **Strict Elimination of External Models & Black-Box Services:**
   - Zero external generative models, neural embeddings, or cloud API endpoints are utilized in TurnTrace. System S4 was eliminated from the benchmark to preserve 100% offline reproducibility and eliminate any external dependency or data leakage.
   - All query rewriting, conversational tracking, and ambiguity clarification logic operates deterministically using classical Information Retrieval statistics computed directly from the inverted index.
3. **Core Intellectual Work Implemented by the Team:**
   - All core Information Retrieval algorithms—including the inverted index data structures, positional postings intersection, Martin Porter's 1980 stemming rules, SMART `lnc.ltc` logarithmic TF/IDF vector math, Okapi BM25 ranking formulas, binary min-heap algorithms, exponential decay formulations, cosine topic-shift detection heuristics, Reciprocal Rank Fusion, and leader/follower cluster pruning—were designed, verified, and implemented directly in pure Node.js ES modules by the team members.
   - Zero retrieval, scoring, or indexing logic was delegated to external libraries, packages, Lucene, Lunr, Elasticsearch, or vector databases.
   - All evaluation numbers reported in this project were generated directly from live computational executions of `npm run eval`.
