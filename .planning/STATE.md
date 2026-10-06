# TurnTrace Project State

**Current Status:** Ready for Phase 1 Execution  
**Current Phase:** Phase 1 (Environment, Skeleton, Config & Dataset Gate)  
**Dataset Gate:** Confirmed Fallback Wikipedia Multi-Domain Passage Corpus (due to external raw GitHub rate-limiting/timeout).  
**Test Suite Status:** Not initialized yet.  

## Key Decisions Made
1. **Workspaces Architecture:** `package.json` at root managing workspaces `server`, `client`, `eval`.
2. **ES Modules Only:** All Node.js packages use `"type": "module"`.
3. **Pure IR Implementation:** Zero delegation to external search/vector engines. All scoring (`lnc.ltc`, BM25), index structures (inverted, positional, champion lists, binary heap), and conversational algorithms (decayed context, cosine shift detection, query decomposition, RRF, cluster-pruned clarifier) written natively.
4. **Testing Framework:** Native Node.js test runner (`node --test`), requiring zero external test frameworks.
5. **Corpus Construction:** Multi-domain Wikipedia corpus (30k–50k passages across Computer Science & AI, History & Exploration, Physics & Space Exploration, Biology & Medicine) with multi-zone schema (`docId`, `title`, `body`, `domain`) plus 14 multi-turn conversations (70+ turns, exceeding the 40-turn requirement).
