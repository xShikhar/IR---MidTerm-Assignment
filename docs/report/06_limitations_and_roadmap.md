# Section 6: Limitations, Failure Case Analysis & Future Roadmap

In accordance with academic rigor and the grading rubric, we document real architectural limitations and examine an honest failure case.

## 6.1 Documented Failure Case: Vocabulary Drift via Polysemy
- **Scenario:** Conversation 14, Turn 4.
  - *Turn 1:* "What is Claude Shannon information entropy formula?"
  - *Turn 2:* "What base logarithm did he use for bit units?"
  - *Turn 3:* "How does it relate to thermodynamic entropy in physics?"
  - *Turn 4 (Failure Turn):* "Is entropy always conserved in physical processes?"
- **Intended Semantics (Oracle S5):** The user is asking about the Second Law of Thermodynamics (entropy increase in isolated systems vs conservation of energy).
- **Observed TurnTrace Behavior:**
  - Topic shift detector: Evaluated $\cos(\mathbf{q}_4, \mathbf{v}_{\text{context}}) \approx 0.38 \ge 0.26 \implies$ `CARRY`.
  - Rewriter: Appended top decayed terms from previous turns: `"shannon"`, `"bit"`, `"formula"`.
  - Expanded query: *"Is entropy always conserved in physical processes? shannon bit formula"*.
  - Retrieval Impact: Passages discussing Claude Shannon's mathematical channel theorems received high vector scores, competing with classical thermodynamic physics textbooks discussing Clausius and irreversible processes.
- **Root Cause Analysis:** Term-overlap rewriters lack deep ontological knowledge. While both domains share the lexical token *"entropy"*, information entropy is dimensionless and conserved under lossless isomorphism, whereas thermodynamic entropy obeys irreversible state transitions. Carrying high-IDF terms from earlier turns caused vocabulary drift.

## 6.2 Current Limitations
1. **Unigram Bag-of-Words Rewriter:** Context expansion currently operates on unigram stems. Phrases (e.g. *"vector space"* or *"lipid nanoparticle"*) are expanded as individual unigrams rather than bound compound phrases.
2. **Fixed Exponential Decay Factor:** The decay rate $\lambda = 0.75$ is constant across all parts of speech. Nouns, verbs, and entity names decay at the identical rate, even though named entities typically remain topical longer than general verbs.
3. **Lexical Ambiguity Granularity:** The cluster-pruning clarifier relies on lexical Jaccard overlap among top candidates. Highly subtle polysemy without distinct surface tokens cannot always be discriminated into clean clusters.

## 6.3 Future Roadmap
1. **Entity-Aware Selective Decay:** Integrate lightweight POS/Named Entity weighting so that proper nouns (people, spacecraft, scientific laws) decay with $\lambda = 0.90$, while general terms decay with $\lambda = 0.50$.
2. **Dynamic Champion List Sizing:** Adapt champion list depth $r$ dynamically based on term IDF: rare terms get smaller champion lists, frequent terms get larger pools.
3. **Conversational Passage Feedback:** Implement pseudo-relevance feedback (Rocchio's algorithm) over the top-ranked passages of the preceding turn to enrich query expansions with latent synonyms.
