# Section 4: Novelty & Unique Contributions

TurnTrace introduces three major algorithmic novelties that differentiate it from existing conversational search engines:

## 4.1 Index-Driven Context Memory Without Generative Models
Existing conversational QA systems (such as QReCC, CANARD, or TREC CAsT baselines) rely on T5 or GPT rewriters trained to output a synthetic string. These models suffer from hallucinations, high latency, GPU requirements, and opacity.

TurnTrace demonstrates that **term-level provenance tracking over inverted index statistics can replace neural rewriters**. By selecting the top-$m$ context terms with the highest decayed weights ($W(t) = \text{TFIDF}(t) \cdot \lambda^{\text{age}}$) and appending them with full metadata, TurnTrace achieves **0.8852 nDCG@10** without a single neural model or API call.

## 4.2 Leader/Follower Cluster-Pruned Ambiguity Clarification
In real-world retrieval, ambiguous queries cause severe relevance degradation. TurnTrace introduces a **cluster-pruned clarifier** based on Manning et al.'s leader/follower clustering (§7.1.6):
1. **Confidence Gate:** First computes the score margin between rank 1 and rank 2 candidates: $\Delta = \text{Score}_1 - \text{Score}_2$. If $\Delta > 0.065$, the engine has high confidence and **never fires**, avoiding annoying, unhelpful interruptions.
2. **Leader/Follower Clustering:** If $\Delta \le 0.065$, the top-6 candidate passages are partitioned by Jaccard term overlap into cohesive clusters.
3. **Discriminative Term Extraction:** If candidates separate into $\ge 2$ distinct clusters with disjoint high-IDF terms (e.g. *Mercury planet* vs *mercury chemical toxicity*, or *neural transformers* vs *electrical AC transformers*), TurnTrace extracts the most discriminating high-IDF stems from each cluster and formulates a targeted clarifying question:
   > *"Did you mean information related to planet orbit or mercury toxicity?"*

## 4.3 Hybrid Multi-Part Decomposition & Dual Rank Fusion
Complex comparative queries (e.g., *"Compare vector space model with Okapi BM25"* or *"Compare synaptic plasticity and gradient descent"*) perform poorly under single-query vector retrieval because documents addressing only one half of the comparison score highly and crowd out balanced passages.

TurnTrace's decomposer automatically:
1. Segregates the comparative clauses into independent vector sub-queries.
2. Extracts high-IDF entity anchors and synthesizes a strict Boolean constraint query (`vector AND bm25`), with automatic fallback to ranked `OR` if the strict conjunction is empty.
3. Fuses the resulting ranked candidate lists using both **Reciprocal Rank Fusion (RRF)** ($k=60$) and **Normalized Score-Sum Fusion**, dynamically prioritizing documents that satisfy both entity constraints and semantic relevance.
