# TurnTrace Roadmap (36-Hour Hackathon Execution)

## Phases Overview

| Phase | Milestone | Focus Area | Owner | Key Deliverables |
|---|---|---|---|---|
| **Phase 1** | H0–H3 | Environment, Skeleton & Dataset Gate | All / M1 | Repo workspaces (`server`, `client`, `eval`), config module, Wikipedia fallback dataset builder & judged conversations |
| **Phase 2** | H3–H7 | Inverted Indexing & Postings Engine | Member 1 | Tokenizer, normalizer, Porter stemmer, inverted index with positions & zones, champion lists, serializer, unit tests |
| **Phase 3** | H7–H10 | Core Retrieval, Scoring & Fusion | Member 2 | SMART `lnc.ltc` cosine, BM25, binary heap top-K, index elimination, Boolean engine, phrase engine, RRF & score-sum fusion |
| **Phase 4** | H10–H20 | Conversational Layer & Trace Engine | Member 3 | Decayed context vector, topic-shift detector, rewriter with provenance, decomposer, cluster clarifier, LLM adapter |
| **Phase 5** | H20–H28 | Evaluation Harness, Benchmarks & UI | Member 4 | Qrels evaluator (S0–S5 + ablations), metrics (P@k, Recall, MRR, nDCG, Clarification), CSV/Chart output, Express API, Vite/React Trace Inspector |
| **Phase 6** | H28–H36 | Verification, Report, Video Script & Final Polish | All | Clean clone verification, 7-section report draft (with Mermaid IR pipeline), 5-8 min video run-of-show, submission checklist |

---

## Detailed Phase Breakdown

### Phase 1: Repo Skeleton, Config & Dataset Gate (H0–H3)
- [x] Dataset Gate: Confirmed fallback Wikipedia passage collection due to external network constraints on raw QReCC.
- [ ] Initialize `package.json` workspaces: `server`, `client`, `eval`.
- [ ] Implement central configuration module `server/src/config/index.js` (weights, decay $\lambda$, heap $K$, expansion terms $m$, cluster thresholds).
- [ ] Build `server/scripts/prepareCorpus.js`: Generates 30k–50k passages across 4 domains (AI/CS, History, Physics/Space, Biology/Medicine) with 14 multi-turn conversations (70+ judged turns with gold rewrites and qrels).
- [ ] Configure `node:test` runner and ESLint/Prettier setup.

### Phase 2: Indexing Engine (H3–H7)
- [ ] `server/src/index/tokenizer.js`: Lowercase, regex tokenization, punctuation stripping.
- [ ] `server/src/index/normalizer.js`: Stop word removal, Porter stemmer (declared IR library), accent normalization.
- [ ] `server/src/index/postings.js`: Linked/array postings list with `docId`, `termFrequency`, positions, and zone flags (title vs body).
- [ ] `server/src/index/builder.js`: Inverted index builder computing $df_t$, document lengths (both Euclidean length for `lnc` and passage length for BM25), zone lengths.
- [ ] `server/src/index/championLists.js`: Precomputed champion lists per term ($r$ highest weights) for fast top-K retrieval.
- [ ] `server/src/index/serializer.js`: High-performance binary/JSON serialization and instant startup deserialization.
- [ ] Unit tests for all Phase 2 components in `server/test/index.test.js`.

### Phase 3: Core Retrieval & Scoring (H7–H10)
- [ ] `server/src/retrieval/cosine.js`: SMART `lnc.ltc` vector space cosine similarity:
  - Document weights: logarithmic tf ($1 + \ln(tf)$), no idf ($n$), cosine normalization ($c$).
  - Query weights: logarithmic tf ($1 + \ln(tf)$), idf ($\ln(N/df)$), cosine normalization ($c$).
- [ ] `server/src/retrieval/bm25.js`: Okapi BM25 scoring with parameters $k_1, b$ and average doc length.
- [ ] `server/src/retrieval/zones.js`: Weighted zone scoring: $Score(d) = g \cdot Score_{title}(d) + (1-g) \cdot Score_{body}(d)$.
- [ ] `server/src/retrieval/heap.js`: Min-heap of size $K$ for $O(N \log K)$ top-$K$ selection.
- [ ] `server/src/retrieval/indexElimination.js`: Filtering query terms by IDF threshold to skip low-discriminative terms.
- [ ] `server/src/retrieval/boolean.js`: AND, OR, NOT operations with postings intersection ordered by increasing document frequency.
- [ ] `server/src/retrieval/phrase.js`: Positional postings intersection for exact phrase queries with distance constraint $\le 1$.
- [ ] `server/src/retrieval/fusion.js`: Reciprocal Rank Fusion ($RRF(d) = \sum \frac{1}{60 + r_i(d)}$) and score-sum fusion.
- [ ] Unit tests in `server/test/retrieval.test.js`.

### Phase 4: Conversational Layer & Trace Assembly (H10–H20)
- [ ] `server/src/conversation/contextState.js`: Decayed term-weight context vector: $Weight(t, age) = \text{tfidf}(t) \cdot \lambda^{age}$. Top terms from queries and top-ranked passages.
- [ ] `server/src/conversation/shiftDetector.js`: Topic shift detection via cosine similarity between current query and context vector, combined with ellipsis/anaphora indicators. Outputs `CARRY` or `RESET`.
- [ ] `server/src/conversation/rewriter.js`: Selects top-$m$ context terms with full provenance metadata (origin turn, term IDF, decayed weight).
- [ ] `server/src/conversation/decomposer.js`: Splits multi-part / comparative queries into Boolean sub-queries (mandatory entities) and vector sub-queries.
- [ ] `server/src/conversation/clarifier.js`: Leader/follower cluster pruning on top-$K$ candidates; detects bimodal ambiguity and extracts discriminating high-IDF terms to synthesize clarifying questions.
- [ ] `server/src/conversation/llmAdapter.js`: Optional provider-agnostic LLM rewriter interface (toggleable, cached, fully declared).
- [ ] `server/src/api/traceAssembly.js`: Comprehensive JSON trace generation.
- [ ] Unit tests in `server/test/conversation.test.js`.

### Phase 5: Evaluation Harness, Benchmarks & React UI (H20–H28)
- [ ] `eval/src/qrelsLoader.js`: Loads judged turns and binary/graded relevance judgments.
- [ ] `eval/src/runner.js`: Runs S0, S1, S2, S3, S4 (optional), S5, plus ablations (BM25 vs Cosine, shift off, decay off, fusion off).
- [ ] `eval/src/metrics.js`: Computes P@5, P@10, Recall@20, MRR, nDCG@10, and Clarification Precision.
- [ ] `eval/src/export.js`: Outputs clean markdown/CSV summary tables and SVG/PNG visual comparison charts.
- [ ] `server/src/api/server.js`: Express REST API endpoints (`POST /api/chat`, `GET /api/stats`, `POST /api/reset`).
- [ ] `client/`: Lightweight Vite + React UI featuring:
  - Conversational chat pane
  - Ranked passages list with zone highlights
  - Interactive **Trace Inspector** drawer displaying every pipeline stage (tokens, shift cosine, context provenance, postings, heap weights, score breakdowns, RRF tables).

### Phase 6: Verification, Documentation, Report & Video (H28–H36)
- [ ] `README.md`: Setup, reproduction commands (`prepare:data`, `build:index`, `dev`, `eval`), data description, architecture, rubric compliance.
- [ ] `docs/report/`: 7 markdown chapters with Mermaid IR architecture diagram, real evaluation tables from `npm run eval`, failure case analysis, work distribution, and AI-use disclosure.
- [ ] `docs/video-script.md`: Timed 5–8 minute presentation script with step-by-step cue cards for all 4 team members.
- [ ] `docs/SUBMISSION_CHECKLIST.md`: Complete audit checklist against assignment rules.
