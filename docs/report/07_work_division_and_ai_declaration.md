# Section 7: Work Division & AI-Use Declaration

## 7.1 Team Ownership Matrix (Placeholders for Team Allocation)

The table below outlines the primary functional divisions of the TurnTrace architecture. Specific member names and university roll numbers are left as unassigned placeholders for the student team to claim based on presentation roles:

| Member Role | Component Track | Key Deliverables & Modules | Video Presentation Focus |
|---|---|---|---|
| **Member 1** <br>*(Placeholder: Name / Roll No.)* | **Indexing, Data & Preprocessing** | - Corpus acquisition & Wikipedia structuring (`prepareCorpus.js`)<br>- Lexical tokenizer & positional tracking (`tokenizer.js`)<br>- Martin Porter (1980) 5-step stemmer (`porterStemmer.js`)<br>- Multi-zone inverted index & postings (`postings.js`, `builder.js`)<br>- Precomputed champion lists (`championLists.js`)<br>- Disk serializer & stats (`serializer.js`, `buildIndex.js`)<br>- Unit tests (`server/test/index.test.js`) | Offline indexing pipeline, multi-zone tokenization, positional postings, and champion lists. |
| **Member 2** <br>*(Placeholder: Name / Roll No.)* | **Retrieval, Scoring & Fusion Engine** | - SMART `lnc.ltc` vector space cosine engine (`cosine.js`)<br>- Okapi BM25 scoring model (`bm25.js`)<br>- Binary min-heap top-K selector (`heap.js`)<br>- Index elimination IDF pruner (`indexElimination.js`)<br>- Boolean engine with DF-ordered intersection (`boolean.js`)<br>- Positional phrase query processor (`phrase.js`)<br>- Reciprocal Rank Fusion & Score-Sum (`fusion.js`)<br>- Unit tests (`server/test/retrieval.test.js`) | Scoring equations, Euclidean length normalization vs BM25, DF-ordered Boolean intersection, and RRF. |
| **Member 3** <br>*(Placeholder: Name / Roll No.)* | **Conversational Layer & Tracking** | - Entity lock & title-zone filter (`entityExtractor.js`, `titleFilter.js`)<br>- Aspect-aware context state & replacement (`contextState.js`)<br>- Conversational decision detector (`decisionDetector.js`)<br>- Provenance-aware query rewriter (`rewriter.js`)<br>- Multi-part query decomposer (`decomposer.js`)<br>- Leader/follower cluster clarifier (`clarifier.js`)<br>- Unit tests (`server/test/conversation.test.js`, `server/test/entityLock.test.js`) | Entity lock vs aspect separation, title-zone hard filtering with fallback, and conversational decision logic. |
| **Member 4** <br>*(Placeholder: Name / Roll No.)* | **Evaluation, API & Trace Inspector UI** | - Qrels loader & pooling sheet generator (`qrelsLoader.js`, `generatePoolingSheet.js`)<br>- IR metrics engine: P@k, Recall, MRR, nDCG, Novelty@k, Fidelity (`metrics.js`, `fidelity.js`, `noveltyAtK.js`)<br>- Benchmark runner across systems S0–S5, R1–R2, A0–A6 (`systemsRunner.js`)<br>- Paired bootstrap & Wilcoxon significance testing (`significance.js`)<br>- Express REST API & session manager (`server.js`, `traceAssembly.js`)<br>- React + Vite Trace Inspector interface (`client/src`)<br>- Integration tests (`server/test/api.test.js`, `eval/test/metrics.test.js`, `eval/test/noveltyMetrics.test.js`) | Evaluation benchmark results, ablation study findings, live interactive trace walkthrough, and failure case. |

---

## 7.2 Corpus Provenance & Data Sources

The 35,000-passage multi-domain evaluation corpus was constructed exclusively from authentic English Wikipedia articles across four balanced domains:
1. **Computer Science & Artificial Intelligence** (8,750 passages)
2. **Physics & Space Exploration** (8,750 passages)
3. **History & Inventions** (8,750 passages)
4. **Biology & Medicine** (8,750 passages)

**Data Collection Sources:**
- **Primary Live Source:** Wikipedia Action API (`https://en.wikipedia.org/w/api.php`) via automated hierarchical category crawling, extracts querying, and section-level chunking into passages of 80–180 words.
- **Offline Snapshot Source:** The Hugging Face `wikimedia/wikipedia` snapshot (`20231101.en`) used for bulk text extraction.

---

## 7.3 AI-Use Declaration

In strict accordance with academic integrity guidelines, we transparently declare the exact extent and nature of AI assistance utilized in this project:

1. **AI Tools Utilized:**
   - **Google Antigravity IDE (Gemini agent):** Generated the majority of the project implementation code, unit test suites, documentation drafts, the 14 multi-turn conversational benchmark scenarios, and the reference gold rewrites (as documented in git commit history).
   - **Claude (Anthropic):** Utilized for system architecture planning, prompt design, and independent adversarial audit review (identifying data leakage risks and evaluating IR rubric compliance).

2. **System Boundaries & Strict Offline IR Operation:**
   - **Zero Runtime AI or External LLM Calls:** No neural language models, external generative APIs, cloud inference endpoints, or black-box embeddings are used anywhere in the TurnTrace runtime search engine or evaluation pipeline.
   - **Pure Index-Driven Mathematics:** All retrieval ranking, query rewriting, conversational memory tracking, entity locking, and cluster clarification algorithms operate 100% deterministically using classical Information Retrieval statistics (TF-IDF, term frequencies, document frequencies, and inverted index postings) implemented in pure Node.js ES modules.
   - **Zero Black-Box IR Libraries:** Core inverted indexing, positional intersection, Porter stemming, and scoring formulas were implemented from first principles, without delegating to Lucene, Lunr, Elasticsearch, or vector databases.
   - **Empirical Rigor:** All reported numbers are computed directly from live computational runs of `npm run eval` and script executions.
