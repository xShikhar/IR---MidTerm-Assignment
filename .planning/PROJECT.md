# TurnTrace: Inspectable Conversational Search Engine
**Course:** CSD358 Information Retrieval — University Hackathon Track T2 (Conversational and Agentic Search)  
**Stack:** Node.js Backend (ES Modules), React Frontend (Vite), Pure Node.js Testing (`node:test`)  
**Timeline:** 36-Hour Build Window  
**Target:** 100/100 on Rubric (IR Principles 30, Working System 20, Evaluation 15, Novelty 10, Report 10, Video 10, Track Relevance 5)

## 1. Project Overview & Intent
TurnTrace is an inspectable conversational search engine built from the ground up on core Information Retrieval principles. Unlike black-box conversational systems or wrapper architectures that delegate retrieval to Lucene/Elasticsearch/vector databases, TurnTrace implements every indexing, scoring, query rewriting, and conversational tracking primitive directly in pure ES modules.

At each turn of a conversation, TurnTrace returns:
1. Ranked passages from a multi-zone corpus (title + body).
2. A complete, unredacted JSON **Trace** exposing every intermediate decision:
   - Tokenization & normalization details
   - Topic-shift cosine angle & linguistic shift heuristics
   - Decayed context term weights with provenance (source turn, idf, decay factor)
   - Rewritten query terms
   - Sub-query decomposition (Boolean entity constraints + vector sub-queries)
   - Term postings statistics (document frequency, IDF)
   - Score breakdown (lnc.ltc vector weights, BM25 component scores, zone weighting)
   - Rank fusion contributions (RRF vs score-sum)
   - Cluster-pruned clarifying questions when top results exhibit ambiguity.

---

## 2. Hard Requirements & Constraints
- **Zero Delegation of IR Core:** No Lucene, Lunr, Elasticsearch, Milvus, Chroma, Pinecone, or LangChain.
- **Pure Original Code:** Tokenizer, normalizer, inverted index with postings, positional index, binary heap, cosine similarity (`lnc.ltc`), BM25, Boolean postings intersection, RRF fusion, context decay, shift detection, and cluster clarifier are implemented in-house.
- **Allowed Libraries (Explicitly Declared in IR Terms):** 
  - Porter Stemmer (`natural`'s PorterStemmer or a pure JS Porter algorithm) for suffix-stripping morphological normalization.
  - Express for HTTP REST endpoints.
  - React + Vite for trace visualization.
- **Honest Evaluation:** All numbers come from real runs of `npm run eval` across judged turns. No fabricated numbers, no mock retrieval paths.
- **Decoupled LLM:** An optional LLM adapter can be toggled on/off via environment variables. System operates 100% autonomously without any LLM.

---

## 3. Dataset Gate Decision
- **Gate Status:** Triggered to fallback Wikipedia passages corpus.
- **Rationale:** Direct fetching from `raw.githubusercontent.com` (QReCC raw repository) timed out in this environment due to network/firewall policies. Per the rubric specification (*"Decision gate at hour 3: if QReCC download or subsetting is not working, switch to the fallback and do not look back"*), we switch immediately to the structured Wikipedia passage corpus.
- **Corpus Specification:**
  - 30,000–50,000 passages across 4 distinct domains: Computer Science & AI, History & Exploration, Physics & Space Exploration, Biology & Medicine.
  - Multi-zone format: `docId`, `title`, `body`, `domain`.
  - 14 distinct multi-turn conversations (5+ turns each, 70+ total turns exceeding the 40-turn minimum requirement), featuring:
    - Anaphoric references ("it", "they", "that model")
    - Ellipsis ("what about in Europe?", "and its applications?")
    - Topic shifts (clear shifts requiring context reset)
    - Ambiguous turns requiring cluster-pruned clarification.
  - Gold query rewrites for each turn to support Oracle baseline S5.
  - Pooled relevance judgments (qrels) across top-10 candidate passages.

---

## 4. Systems to Compare (Evaluation)
- **S0:** Raw current query only (no context).
- **S1:** Naive concatenation of all conversation history + current query.
- **S2:** TurnTrace index-driven query rewriter (decayed context terms, no LLM).
- **S3:** TurnTrace complete pipeline (rewriter + decomposition + Reciprocal Rank Fusion).
- **S4:** LLM rewriter (optional comparison).
- **S5:** Oracle: gold manual rewrite.
- **Ablations:** 
  - SMART `lnc.ltc` vs BM25 scoring on S2.
  - Topic-shift detector disabled (forced carry-over).
  - Exponential decay disabled ($\lambda = 1.0$).
  - Rank fusion disabled (single query only).
- **Evaluation Metrics:** P@5, P@10, Recall@20, MRR, nDCG@10, and Clarification Precision.

---

## 5. Team Ownership Matrix (4 Members)
1. **Member 1 (Indexing & Data):** Corpus preparation, tokenizer, normalizer, stemmer, inverted/positional index, zone scoring, champion lists, disk serializer.
2. **Member 2 (Retrieval & Scoring):** Cosine (`lnc.ltc`), BM25, binary heap top-K, index elimination, Boolean engine, phrase query engine, RRF & score-sum fusion.
3. **Member 3 (Conversation Layer):** Context state with exponential decay, topic-shift detector, query rewriter with provenance, decomposer, cluster-pruning clarifier, optional LLM adapter.
4. **Member 4 (Evaluation, API & Trace UI):** Evaluation harness, qrels loader, metrics calculation, Express API, trace inspector React UI, report drafts, video script, submission checklist.
