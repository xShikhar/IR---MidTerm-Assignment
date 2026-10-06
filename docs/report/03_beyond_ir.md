# Section 3: Beyond Classical IR: Conversational Tracking & Inspectability

While classical Information Retrieval focuses on single-shot document retrieval from fixed queries, TurnTrace bridges classical IR and conversational dialogue systems without delegating reasoning to opaque neural models.

## 3.1 Resolving Anaphora and Ellipsis via Decayed Term Vectors
In human conversation, pronouns and elliptical phrases refer to concepts established in earlier turns. Rather than relying on neural coreference resolution models (which are compute-heavy and non-transparent), TurnTrace represents dialogue memory as an **exponentially decayed term-weight vector**:
$$W(t, \text{age}) = \text{TFIDF}(t) \cdot \lambda^{\text{age}}$$
where $\lambda = 0.75$ is the decay parameter and $\text{age} \in \{0, 1, 2, \dots, 5\}$ is the turn distance from inception.

At each turn:
1. Terms from the user's query are ingested with high priority.
2. The top-scoring document from the previous turn contributes its highest-TF-IDF terms ($m \le 4$), anchoring the semantic context with grounded document vocabulary.
3. As the conversation progresses, older terms diminish geometrically, preventing ancient discourse from contaminating subsequent turns.

## 3.2 Dual-Signal Topic-Shift Detection
A notorious failure mode of conversational search is carrying obsolete terms across sudden topic shifts. TurnTrace prevents this using an inspectable dual-signal detector:
1. **Geometric Signal:** Computes the cosine angle between the sparse query term vector $\mathbf{q}_t$ and the active context vector $\mathbf{v}_{\text{context}}$:
   $$\cos(\mathbf{q}_t, \mathbf{v}_{\text{context}}) = \frac{\mathbf{q}_t \cdot \mathbf{v}_{\text{context}}}{\|\mathbf{q}_t\| \|\mathbf{v}_{\text{context}}\|}$$
2. **Linguistic Anaphora Override:** A low cosine angle alone does not always signify a topic shift; for example, the query *"How close is it to the Sun?"* contains general vocabulary that produces near-zero cosine overlap with preceding astronomy vectors, yet is intensely anaphoric. TurnTrace scans for:
   - English personal and demonstrative pronouns (`it`, `its`, `they`, `them`, `this`, `that`, `he`, `she`).
   - Elliptical interrogative prefixes (`what about`, `how about`, `why`, `and`, `also`).
   - Query length constraints ($\le 3$ words).

If $\cos \ge 0.26$ OR strong anaphora is present $\implies$ `CARRY` (expand query).  
If $\cos < 0.26$ AND no anaphora exists $\implies$ `RESET` (wipe context vector, preserve standalone semantics).

## 3.3 Deep Inspectability: The Per-Turn Trace
Modern users and evaluators have zero visibility into LLM-based black-box search engines. TurnTrace exposes every intermediate decision in an unredacted JSON trace returned on every turn:
- **Lexical Tokens & Stems:** Raw vs stemmed representations.
- **Topic Shift Metrics:** Exact cosine similarity, threshold, pronoun matches, and rationale.
- **Context Provenance:** For every term in context: origin turn, origin source (query vs passage), initial weight, decay factor, and current effective weight.
- **Query Rewriting:** Original query vs rewritten expansion.
- **Sub-Queries Evaluated:** Constituent Boolean and vector sub-queries with candidate counts.
- **Postings Statistics:** Collection document frequency ($df$) and IDF for every active term.
- **Document Score Breakdown:** Per-term query weight, doc weight, and vector product.
- **Timing Profiling:** Millisecond latency for each pipeline stage.
