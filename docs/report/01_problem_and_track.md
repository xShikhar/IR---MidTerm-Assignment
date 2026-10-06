# Section 1: Problem Definition & Track Relevance

## 1.1 The Challenge of Conversational Search
Traditional Information Retrieval (IR) systems treat user queries as independent, static informational requests. When a user submits a query $q$, standard engines project $q$ into a vector space or evaluate probabilistic occurrence models against an inverted index, returning a top-$K$ ranked document set.

However, in conversational and agentic search (Track T2), human interaction is inherently incremental, context-dependent, and multi-turn. Users rely heavily on linguistic phenomena that break traditional standalone retrieval:
1. **Anaphora:** Pronoun references such as *"How does term frequency weighting work in it?"* or *"Who discovered it?"* lack explicit noun phrases.
2. **Ellipsis:** Fragmentary queries such as *"What about cosine normalization?"* or *"Tell me about its primary mirror size"* assume that the search engine preserves preceding discourse entities.
3. **Topic Shifts:** Conversations do not move monotonically along a single semantic axis. Users frequently pivot to unrelated topics (e.g., transitioning from Alan Turing to Black Holes, or from Alexander Fleming to the Mona Lisa). Retaining obsolete terms causes catastrophic vocabulary pollution.
4. **Lexical Ambiguity & Polysemy:** Ambiguous terms (e.g., *"Mercury"* referring to either the celestial planet or the neurotoxic heavy metal, or *"Transformer"* referring to either neural attention models or electrical AC power transformers) produce bimodal result distributions where high-scoring documents diverge across completely distinct semantics.

## 1.2 Track T2 Relevance & The TurnTrace Mission
Most contemporary conversational systems treat retrieval as a black box: they take the conversation history, pass it to a large language model (LLM), generate a synthetic rewrite, and forward the result to an external Lucene or vector database. While functionally convenient, such systems obscure the retrieval mechanics, introduce latency and API dependencies, and score 0 on fundamental IR rigor.

**TurnTrace** addresses this challenge by demonstrating that **conversational search can be driven entirely by inspectable, index-derived Information Retrieval principles**. By representing conversational memory as a decaying term-weight vector derived directly from collection statistics (TF, DF, and IDF), TurnTrace accomplishes anaphoric expansion, topic-shift detection, multi-part decomposition, and ambiguity clarification natively inside the retrieval engine—with zero black-box dependencies.
