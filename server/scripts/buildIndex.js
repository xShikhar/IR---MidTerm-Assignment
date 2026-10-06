/**
 * @file server/scripts/buildIndex.js
 * @description Offline Inverted Index Build CLI Script.
 * Reads data/corpus.json, constructs the multi-zone inverted index with
 * champion lists and length norms, and serializes to data/index.json.
 */

import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/config/index.js';
import { buildIndex } from '../src/index/builder.js';
import { saveIndex } from '../src/index/serializer.js';

export async function runBuildIndex() {
  console.log('[TurnTrace Index Builder] Starting offline index construction...');
  const corpusPath = CONFIG.paths.corpusFile;

  if (!fs.existsSync(corpusPath)) {
    throw new Error(`Corpus file not found at ${corpusPath}. Run 'npm run prepare:data' first.`);
  }

  const startTime = performance.now();
  const rawCorpus = fs.readFileSync(corpusPath, 'utf-8');
  const passages = JSON.parse(rawCorpus);

  console.log(`[TurnTrace Index Builder] Loaded ${passages.length} passages. Building index...`);
  const index = buildIndex(passages);

  console.log(`[TurnTrace Index Builder] Serializing index to ${CONFIG.paths.indexFile}...`);
  saveIndex(index, CONFIG.paths.indexFile);

  const elapsed = (performance.now() - startTime).toFixed(1);
  const fileSizeBytes = fs.statSync(CONFIG.paths.indexFile).size;
  const fileSizeMb = (fileSizeBytes / (1024 * 1024)).toFixed(2);

  console.log('======================================================');
  console.log('           TurnTrace Inverted Index Statistics        ');
  console.log('======================================================');
  console.log(`Total Documents (N):       ${index.metadata.totalDocs.toLocaleString()}`);
  console.log(`Vocabulary Size (|V|):     ${index.metadata.vocabularySize.toLocaleString()} terms`);
  console.log(`Total Postings Entries:    ${index.metadata.totalPostings.toLocaleString()}`);
  console.log(`Avg Document Length:       ${index.metadata.avgDocLength.toFixed(2)} tokens`);
  console.log(`Champion Lists Count:      ${Object.keys(index.championLists).length.toLocaleString()} terms`);
  console.log(`Index File Size on Disk:   ${fileSizeMb} MB`);
  console.log(`Total Indexing Time:       ${elapsed} ms`);
  console.log('======================================================');

  return index.metadata;
}

if (process.argv[1] && process.argv[1].endsWith('buildIndex.js')) {
  runBuildIndex()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[TurnTrace Index Builder] Fatal Error:', err);
      process.exit(1);
    });
}
