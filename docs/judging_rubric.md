# TurnTrace Relevance Judging Rubric (CSD358 Track T2)

This rubric governs relevance assessment for the pooled candidate passages across all benchmark conversations. Relevance judgments form the ground truth test collection (`data/qrels.json`) against which conversational search systems and ablations are evaluated.

---

## 1. Information Need Representation

- Each conversational turn possesses an underlying information need specified by the user's current query within the dialogue history, operationalized by the reference **Gold Standalone Rewrite** (`goldRewrite`).
- The judge assesses whether the passage satisfies the information need of `goldRewrite` in the context of the dialogue.
- **Judge Context Rule:** The judge observes ONLY the dialogue topic, previous turns, gold standalone rewrite, passage title, and passage text. The judge NEVER observes which system retrieved the passage, its rank, its score, or any system-generated query rewrite.

---

## 2. Graded Relevance Scale (0, 1, 2)

### Grade 2: Highly Relevant (Direct Answer)
- **Definition:** The passage directly answers, explains, or fulfills the specific informational question posed in the gold rewrite given the conversation.
- **Criteria:**
  - Contains factual answers, definitions, core explanations, or precise evidence directly addressing the turn's target aspect.
  - For entity-specific turns, explicitly discusses the target entity in the correct sense.
- **Example:**
  - *Query:* "Where is its orbit located in space?" (JWST)
  - *Gold Rewrite:* "Where is the James Webb Space Telescope orbit located in space?"
  - *Passage Title:* "James Webb Space Telescope"
  - *Passage Text:* "...operates in a halo orbit around the Sun-Earth L2 (Lagrange) point, approximately 1,500,000 km beyond Earth..."
  - *Grade:* **2** (Directly states the exact orbit location L2).

### Grade 1: Partially Relevant (Related Background)
- **Definition:** The passage does not directly answer the specific question, but provides topical, useful background context about the entity or aspect.
- **Criteria:**
  - Discusses the correct entity and domain, but focuses on adjacent aspects (e.g., launch date, general architecture, instruments) rather than the specific property queried.
  - Provides broader conceptual background that helps understand the topic.
- **Example:**
  - *Query:* "Where is its orbit located in space?" (JWST)
  - *Gold Rewrite:* "Where is the James Webb Space Telescope orbit located in space?"
  - *Passage Title:* "James Webb Space Telescope"
  - *Passage Text:* "...JWST was launched on 25 December 2021 on an Ariane 5 rocket from Kourou, French Guiana..."
  - *Grade:* **1** (Correct entity, mentions launch trajectory/space flight, but does not specify the final operational orbit).

### Grade 0: Non-Relevant (Off-Topic / Wrong Sense / Unhelpful)
- **Definition:** The passage does not answer the question and does not provide useful context for the target information need.
- **Criteria:**
  - **Off-topic:** Completely unrelated to the target entity or topic.
  - **Wrong Polysemous Sense:** For ambiguous entities (e.g., Transformer neural network architecture vs. electrical power transformer; Saturn rocket vs. Saturn planet; Apollo space program vs. Apollo Greek deity; Apple Inc. vs. apple fruit), describes the wrong real-world entity.
  - **Generic / Superficial:** Only mentions a keyword incidentally in an unrelated list or boilerplate without substantive information.
- **Example:**
  - *Query:* "How does the Transformer architecture use self-attention?"
  - *Gold Rewrite:* "How does the Transformer neural network architecture use self-attention?"
  - *Passage Title:* "Transformer (disambiguation)" or "Electric power distribution"
  - *Passage Text:* "...A transformer is a passive component that transfers electrical energy from one circuit to another through electromagnetic induction..."
  - *Grade:* **0** (Wrong entity sense — electrical engineering rather than deep learning NLP).

---

## 3. Disambiguation and Polysemy Rules

When evaluating conversations with polysemous entities:
1. **Target Sense Preservation:** The conversation establishes the intended entity sense in Turn 1.
2. If the user intentionally shifts topics (e.g., conv_12 shifting from neural network transformers to electrical power transformers), the information need for that turn is determined by that turn's gold rewrite.
3. Passages matching only the surface term but adhering to the obsolete or wrong domain sense MUST receive **Grade 0**.

---

## 4. Judging Constraints

- Judge ONLY from the passage text and Wikipedia title.
- Do NOT assume external facts not supported or implied by the passage text.
- Do NOT penalize passages for being slightly technical or concise if they factually answer the query.
