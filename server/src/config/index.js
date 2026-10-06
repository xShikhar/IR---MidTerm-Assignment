/**
 * @file server/src/config/index.js
 * @description Centralized, strongly-typed configuration module for TurnTrace.
 * All tunable IR hyperparameters and conversational thresholds reside here.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

export const CONFIG = Object.freeze({
  paths: Object.freeze({
    projectRoot,
    dataDir: path.join(projectRoot, 'data'),
    corpusFile: path.join(projectRoot, 'data', 'corpus.json'),
    indexFile: path.join(projectRoot, 'data', 'index.json'),
    conversationsFile: path.join(projectRoot, 'data', 'conversations.json'),
    qrelsFile: path.join(projectRoot, 'data', 'qrels.json'),
    splitsFile: path.join(projectRoot, 'data', 'splits.json'),
    evalOutputDir: path.join(projectRoot, 'eval', 'output')
  }),

  retrieval: Object.freeze({
    // Standard top-K ranking depth
    topK: 10,
    // Zone scoring weights (must sum to 1.0)
    zones: Object.freeze({
      titleWeight: 0.35,
      bodyWeight: 0.65
    }),
    // Okapi BM25 hyperparameters (Robertson & Zaragoza, 2009)
    bm25: Object.freeze({
      k1: 1.2, // Term frequency saturation parameter
      b: 0.75  // Document length normalization parameter
    }),
    // Index elimination: threshold for skipping low-idf query terms
    indexElimination: Object.freeze({
      minIdf: 2.50
    }),
    // Champion lists: number of top-scoring documents cached per posting
    championLists: Object.freeze({
      topR: 50
    }),
    // Rank fusion constants
    fusion: Object.freeze({
      rrfConstant: 60, // Reciprocal Rank Fusion smoothing parameter (Cormack et al., 2009)
      scoreSumWeights: Object.freeze({
        vector: 0.70,
        boolean: 0.30
      })
    })
  }),

  conversation: Object.freeze({
    // Exponential term weight decay factor per turn age: Weight = tfidf * (lambda ^ age)
    context: Object.freeze({
      decayLambda: 0.75,
      maxHistoryTurns: 5,
      topTermsPerDoc: 4, // Max terms extracted from top-ranked passage to seed context
      maxContextVectorSize: 30
    }),
    // Topic shift detector thresholds and linguistic indicators
    shift: Object.freeze({
      cosineThreshold: 0.26,
      shortQueryLength: 3,
      pronouns: Object.freeze([
        'it', 'its', 'they', 'them', 'their', 'theirs',
        'this', 'that', 'these', 'those',
        'he', 'him', 'his', 'she', 'her', 'hers'
      ]),
      ellipsisMarkers: Object.freeze([
        'what about', 'how about', 'why', 'and', 'also', 'where', 'when', 'more', 'tell me more'
      ])
    }),
    // Query rewriter term expansion
    rewriter: Object.freeze({
      topMExpansionTerms: 3,
      minTermWeight: 0.05
    }),
    // Clarifier leader/follower cluster pruning
    clarifier: Object.freeze({
      scoreMarginThreshold: 0.065, // Trigger clarifying question if top margin is below this
      minClusterSize: 2,
      discriminatingTermsCount: 2
    })
  }),

  // Headline Novelty: Entity-Lock & Aspect-Aware Context Tracking
  // NOTE: All thresholds below are initial untuned baselines awaiting human qrels
  novelty: Object.freeze({
    entity: Object.freeze({
      minIdf: 2.50,        // [Untuned Initial] Minimum collection IDF for an entity candidate
      minTitleHits: 1,     // [Untuned Initial] Minimum title hits in top-3 candidates
      topN: 3              // [Untuned Initial] Depth of top results inspected for title-zone entity hits
    }),
    aspect: Object.freeze({
      minIdf: 1.80,        // [Untuned Initial] Minimum collection IDF for an aspect term
      decayLambda: 0.75,   // [Untuned Initial] Exponential decay multiplier for accumulated aspects
      additiveCues: Object.freeze([
        'also', 'and', 'as well', 'too', 'additionally', 'plus', 'furthermore'
      ])
    }),
    lock: Object.freeze({
      mode: 'hard',        // [Untuned Initial] 'hard' (Boolean title filter) | 'soft' (score boost)
      entityBoost: 2.0,    // [Untuned Initial] Multiplier for locked entity terms in soft mode
      minCandidates: 10    // [Untuned Initial] Fallback to soft if fewer than 10 candidates survive
    }),
    seen: Object.freeze({
      penalty: 0.30        // [Untuned Initial] Score penalty: (1 - 0.30) for previously shown docs
    })
  }),

  server: Object.freeze({
    port: parseInt(process.env.PORT || '3001', 10),
    host: '127.0.0.1'
  })
});

export default CONFIG;
