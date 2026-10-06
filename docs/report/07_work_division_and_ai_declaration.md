# Section 7: Work Division & AI-Use Declaration

## 7.1 Team Ownership Matrix (Equal 4-Member Distribution)

| Member | Assigned Component | Key Deliverables & Implemented Modules | Video Presentation Focus |
|---|---|---|---|
| **Member 1** | **Indexing, Data & Preprocessing** | - Corpus generation & multi-domain structuring (`prepareCorpus.js`)<br>- Lexical tokenizer & positional tracking (`tokenizer.js`)<br>- Martin Porter (1980) 5-step stemmer (`porterStemmer.js`)<br>- Multi-zone inverted index & postings (`postings.js`, `builder.js`)<br>- Precomputed champion lists (`championLists.js`)<br>- Disk serializer & stats (`serializer.js`, `buildIndex.js`)<br>- Unit tests (`server/test/index.test.js`) | Offline indexing pipeline, multi-zone tokenization, positional postings, and champion lists. |
| **Member 2** | **Retrieval, Scoring & Fusion Engine** | - SMART `lnc.ltc` vector space cosine engine (`cosine.js`)<br>- Okapi BM25 scoring model (`bm25.js`)<br>- Binary min-heap top-K selector (`heap.js`)<br>- Index elimination IDF pruner (`indexElimination.js`)<br>- Boolean engine with DF-ordered intersection (`boolean.js`)<br>- Positional phrase query processor (`phrase.js`)<br>- Reciprocal Rank Fusion & Score-Sum (`fusion.js`)<br>- Unit tests (`server/test/retrieval.test.js`) | Scoring equations, Euclidean length normalization vs BM25, DF-ordered Boolean intersection, and RRF. |
| **Member 3** | **Conversational Layer & Tracking** | - Decayed term-weight context state vector (`contextState.js`)<br>- Topic-shift detector with anaphora heuristics (`shiftDetector.js`)<br>- Index-driven query rewriter with provenance (`rewriter.js`)<br>- Multi-part query decomposer (`decomposer.js`)<br>- Leader/follower cluster clarifier (`clarifier.js`)<br>- Optional LLM adapter interface (`llmAdapter.js`)<br>- Unit tests (`server/test/conversation.test.js`) | Conversational memory, exponential decay formula, cosine topic-shift detection, and cluster-pruned clarifier. |
| **Member 4** | **Evaluation, API & Trace Inspector UI** | - Qrels loader & test scenarios (`qrelsLoader.js`)<br>- IR metrics engine: P@k, Recall, MRR, nDCG (`metrics.js`)<br>- Benchmark runner across S0–S5 & ablations (`systemsRunner.js`)<br>- CSV tables & SVG chart generator (`export.js`)<br>- Express REST API & session manager (`server.js`)<br>- Central trace assembly engine (`traceAssembly.js`)<br>- React + Vite Trace Inspector interface (`client/src`)<br>- Integration tests (`server/test/api.test.js`, `eval/test/metrics.test.js`) | Evaluation benchmark results, ablation study findings, live interactive trace walkthrough, and failure case. |

---

## 7.2 AI-Use Declaration

In accordance with academic integrity guidelines, we declare the extent and nature of AI assistance used in this project:

1. **Permitted Assistance Utilized:**
   - AI tools (Antigravity IDE / Gemini models) were used to assist with syntax scaffolding, generating synthetic domain passage text for Wikipedia article templates, drafting initial unit test assertions, and structuring markdown documentation templates.
2. **Core Intellectual Work Done by Team:**
   - All core Information Retrieval logic—including the inverted index data structures, positional postings intersection, Martin Porter's 1980 stemming rules, SMART `lnc.ltc` logarithmic TF/IDF vector math, Okapi BM25 ranking formulas, binary min-heap algorithms, exponential decay formulations, cosine topic-shift detection heuristics, Reciprocal Rank Fusion, and leader/follower cluster pruning—was designed, verified, and implemented directly in pure Node.js ES modules by the team members.
   - Zero retrieval, scoring, or indexing logic was delegated to external libraries, packages, Lucene, Lunr, Elasticsearch, or vector databases.
   - All evaluation numbers reported in this project were generated directly from live computational executions of `npm run eval` against real relevance judgments.
