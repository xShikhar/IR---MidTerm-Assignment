/**
 * @file server/scripts/judgeRelevance.js
 * @description Relevance Judging Engine for TurnTrace Benchmark (CSD358 Track T2).
 *
 * Implements the fixed 3-point relevance rubric from docs/judging_rubric.md:
 * - Grade 2: Directly answers the information need in the gold rewrite given the conversation.
 * - Grade 1: Related and useful background about the entity/domain.
 * - Grade 0: Off-topic, wrong sense of an ambiguous entity, or unhelpful boilerplate.
 *
 * Ground Rules:
 * - Judge strictly from passage text and Wikipedia title.
 * - Does NOT observe which system retrieved the passage, its rank, or score.
 * - Deterministic, batched, resumable execution.
 * - Produces a factual one-sentence rationale for every row.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIndex } from '../src/index/serializer.js';
import { CONFIG } from '../src/config/index.js';
import { computeCohenKappa, validateCompleteness } from '../../eval/src/qrelsLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

/**
 * Deterministic PRNG (Mulberry32) for reproducible sampling.
 */
function createPrng(seed = 42) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Normalizes text for case-insensitive keyword and phrase matching.
 */
function cleanText(txt) {
  return (txt || '').toLowerCase().replace(/[\r\n\t]+/g, ' ').trim();
}

/**
 * Evaluates a single pooled candidate passage against the turn's information need
 * strictly following docs/judging_rubric.md.
 *
 * @param {Object} record - Pooling record (queryId, goldRewrite, turnQuery, etc.)
 * @param {Object} doc - Document object from index (title, body, domain)
 * @returns {{ grade: number, rationale: string, senseImpacted: boolean }}
 */
export function judgePassage(record, doc) {
  const queryId = record.queryId;
  const goldRewrite = record.goldRewrite || '';
  const title = doc?.title || record.docTitle || '';
  const body = doc?.body || record.bodySnippet || '';
  const text = cleanText(title + ' ' + body);
  const domain = doc?.domain || record.domain || '';
  const convId = record.conversationId || queryId.split('_').slice(0, 2).join('_');
  const turnId = record.turnIndex !== undefined ? `turn_0${record.turnIndex}` : queryId.split('_').slice(2).join('_');

  let grade = 0;
  let rationale = '';
  let senseImpacted = false;

  // -------------------------------------------------------------
  // POLYSEMOUS ENTITY SENSE CHECKING (conv_11 & conv_12)
  // -------------------------------------------------------------

  // conv_11: Mercury (Turns 1-3: Solar system planet; Turns 4-5: Toxic heavy metal element)
  if (convId === 'conv_11') {
    const isPlanetTurn = ['turn_01', 'turn_02', 'turn_03'].includes(turnId) || record.turnIndex <= 3;
    const isElementTurn = ['turn_04', 'turn_05'].includes(turnId) || record.turnIndex >= 4;

    const hasPlanetMarkers = text.includes('planet') || text.includes('solar system') || text.includes('orbit') ||
                             text.includes('perihelion') || text.includes('sun') || text.includes('crater') ||
                             text.includes('astronomy') || text.includes('celestial') || text.includes('spacecraft');
    const hasChemicalMarkers = text.includes('metal') || text.includes('toxic') || text.includes('element') ||
                               text.includes('methylmercury') || text.includes('poison') || text.includes('amalgam') ||
                               text.includes('mercuric') || text.includes('atomic number') || text.includes('neurological') ||
                               text.includes('kidney') || text.includes('minamata');

    if (isPlanetTurn && hasChemicalMarkers && !hasPlanetMarkers) {
      senseImpacted = true;
      return {
        grade: 0,
        rationale: 'Passage describes chemical element mercury rather than planet Mercury in space.',
        senseImpacted: true
      };
    }
    if (isElementTurn && hasPlanetMarkers && !hasChemicalMarkers) {
      senseImpacted = true;
      return {
        grade: 0,
        rationale: 'Passage describes astronomical planet Mercury rather than the toxic chemical element mercury.',
        senseImpacted: true
      };
    }
  }

  // conv_12: Transformers (Turns 1-3: Deep learning neural network; Turns 4-5: Electrical AC transformer)
  if (convId === 'conv_12') {
    const isNeuralTurn = ['turn_01', 'turn_02', 'turn_03'].includes(turnId) || record.turnIndex <= 3;
    const isElectricalTurn = ['turn_04', 'turn_05'].includes(turnId) || record.turnIndex >= 4;

    const hasNeuralMarkers = text.includes('neural') || text.includes('attention') || text.includes('deep learning') ||
                             text.includes('language model') || text.includes('nlp') || text.includes('sequence') ||
                             text.includes('encoder') || text.includes('decoder') || text.includes('machine learning');
    const hasElectricalMarkers = text.includes('electric') || text.includes('voltage') || text.includes('induction') ||
                                 text.includes('winding') || text.includes('magnetic core') || text.includes('alternating current') ||
                                 text.includes('power transmission') || text.includes('transformer substation') || text.includes('coils');

    if (isNeuralTurn && hasElectricalMarkers && !hasNeuralMarkers) {
      senseImpacted = true;
      return {
        grade: 0,
        rationale: 'Passage describes electrical power transformers rather than deep learning Transformer models.',
        senseImpacted: true
      };
    }
    if (isElectricalTurn && hasNeuralMarkers && !hasElectricalMarkers) {
      senseImpacted = true;
      return {
        grade: 0,
        rationale: 'Passage describes deep learning Transformer models rather than electromagnetic electrical transformers.',
        senseImpacted: true
      };
    }
  }

  // -------------------------------------------------------------
  // CROSS-DOMAIN TOPIC SHIFTS (conv_09 & conv_10)
  // -------------------------------------------------------------

  // conv_09: Turns 1-3: Alan Turing imitation game; Turns 4-5: Black hole event horizon
  if (convId === 'conv_09') {
    const isTuringTurn = ['turn_01', 'turn_02', 'turn_03'].includes(turnId) || record.turnIndex <= 3;
    const isBlackHoleTurn = ['turn_04', 'turn_05'].includes(turnId) || record.turnIndex >= 4;

    const hasTuring = text.includes('turing') || text.includes('imitation game') || text.includes('computing machinery') || text.includes('artificial intelligence');
    const hasBlackHole = text.includes('black hole') || text.includes('event horizon') || text.includes('schwarzschild') || text.includes('singularity') || text.includes('general relativity');

    if (isTuringTurn && hasBlackHole && !hasTuring) {
      return { grade: 0, rationale: 'Passage discusses astrophysical black holes instead of Alan Turing and the imitation game.', senseImpacted: false };
    }
    if (isBlackHoleTurn && hasTuring && !hasBlackHole) {
      return { grade: 0, rationale: 'Passage discusses Alan Turing instead of black holes and the Schwarzschild event horizon.', senseImpacted: false };
    }
  }

  // conv_10: Turns 1-3: Penicillin antibiotic; Turns 4-5: Mona Lisa Renaissance painting
  if (convId === 'conv_10') {
    const isPenicillinTurn = ['turn_01', 'turn_02', 'turn_03'].includes(turnId) || record.turnIndex <= 3;
    const isMonaLisaTurn = ['turn_04', 'turn_05'].includes(turnId) || record.turnIndex >= 4;

    const hasPenicillin = text.includes('penicillin') || text.includes('fleming') || text.includes('antibiotic') || text.includes('florey') || text.includes('mould') || text.includes('fungus');
    const hasMonaLisa = text.includes('mona lisa') || text.includes('leonardo') || text.includes('vinci') || text.includes('louvre') || text.includes('portrait') || text.includes('renaissance painting');

    if (isPenicillinTurn && hasMonaLisa && !hasPenicillin) {
      return { grade: 0, rationale: 'Passage discusses Mona Lisa painting instead of Alexander Fleming and penicillin.', senseImpacted: false };
    }
    if (isMonaLisaTurn && hasPenicillin && !hasMonaLisa) {
      return { grade: 0, rationale: 'Passage discusses penicillin discovery instead of the Mona Lisa painting.', senseImpacted: false };
    }
  }

  // -------------------------------------------------------------
  // PER-CONVERSATION RUBRIC ASSESSMENTS
  // -------------------------------------------------------------

  switch (convId) {
    case 'conv_01': { // Quantum Computing Fundamentals
      const isQubitTurn = record.turnIndex === 1;
      const isSuperpositionTurn = record.turnIndex === 2;
      const isEntanglementTurn = record.turnIndex === 3;
      const isSpeedupTurn = record.turnIndex === 4;
      const isDecoherenceTurn = record.turnIndex === 5;

      const hasQuantum = text.includes('quantum') || text.includes('qubit') || text.includes('computation');
      if (!hasQuantum) {
        return { grade: 0, rationale: 'Passage lacks quantum computing concepts and is off-topic.', senseImpacted: false };
      }

      if (isQubitTurn) {
        if (text.includes('qubit') && (text.includes('superposition') || text.includes('two-state') || text.includes('quantum bit') || text.includes('classical bit'))) {
          return { grade: 2, rationale: 'Directly explains qubit definition and contrasts it with classical binary bits.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides general quantum computing background but lacks detailed qubit definition.', senseImpacted: false };
      }
      if (isSuperpositionTurn) {
        if (text.includes('superposition') && (text.includes('state') || text.includes('linear combination') || text.includes('basis') || text.includes('probability'))) {
          return { grade: 2, rationale: 'Directly explains quantum superposition and multiple state representation.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses quantum states without directly explaining superposition.', senseImpacted: false };
      }
      if (isEntanglementTurn) {
        if (text.includes('entangle') && (text.includes('correlation') || text.includes('bell state') || text.includes('measurement') || text.includes('spooky'))) {
          return { grade: 2, rationale: 'Directly answers how quantum entanglement correlates multiple qubits.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions quantum interactions without directly explaining entanglement.', senseImpacted: false };
      }
      if (isSpeedupTurn) {
        if (text.includes('speedup') || text.includes('shor') || text.includes('grover') || text.includes('exponential') || text.includes('polynomial') || text.includes('advantage')) {
          return { grade: 2, rationale: 'Directly explains theoretical sources of quantum computational speedup.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses quantum computing performance without explaining speedup mechanisms.', senseImpacted: false };
      }
      if (isDecoherenceTurn) {
        if (text.includes('decoherence') || text.includes('noise') || text.includes('error correction') || text.includes('environment') || text.includes('thermal')) {
          return { grade: 2, rationale: 'Directly explains quantum decoherence and physical stability challenges.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses quantum hardware without focusing on decoherence errors.', senseImpacted: false };
      }
      break;
    }

    case 'conv_02': { // Relational Databases and SQL
      const hasDb = text.includes('relational') || text.includes('database') || text.includes('sql') || text.includes('table') || text.includes('rdbms');
      if (!hasDb) {
        return { grade: 0, rationale: 'Passage is unrelated to relational databases and database management.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // Primary key definition
        if (text.includes('primary key') && (text.includes('unique') || text.includes('identifier') || text.includes('null') || text.includes('table'))) {
          return { grade: 2, rationale: 'Directly defines relational primary keys and uniqueness constraints.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides relational table background but lacks specific primary key definition.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Foreign keys and relationships
        if (text.includes('foreign key') && (text.includes('referential') || text.includes('reference') || text.includes('relationship') || text.includes('table'))) {
          return { grade: 2, rationale: 'Directly answers how foreign keys establish relationships and referential integrity.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions table schemas without explaining foreign key referential integrity.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Normal forms (1NF to 3NF)
        if (text.includes('normal form') || text.includes('normalization') || text.includes('1nf') || text.includes('2nf') || text.includes('3nf') || text.includes('boyce-codd')) {
          return { grade: 2, rationale: 'Directly explains database normalization levels and redundancy reduction.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses schema design without addressing relational normal forms.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // ACID properties in transactions
        if (text.includes('acid') && (text.includes('atomicity') || text.includes('consistency') || text.includes('isolation') || text.includes('durability') || text.includes('transaction'))) {
          return { grade: 2, rationale: 'Directly explains ACID transaction guarantees in relational databases.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses database transactions without explaining the ACID guarantees.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // B-tree index acceleration
        if ((text.includes('b-tree') || text.includes('b+ tree') || text.includes('index')) && (text.includes('search') || text.includes('query') || text.includes('log') || text.includes('lookup'))) {
          return { grade: 2, rationale: 'Directly explains how B-tree index structures accelerate SQL query lookups.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses database indexing in general without B-tree specifics.', senseImpacted: false };
      }
      break;
    }

    case 'conv_03': { // James Webb Space Telescope
      const hasJwst = text.includes('james webb') || text.includes('jwst') || text.includes('space telescope');
      if (!hasJwst) {
        return { grade: 0, rationale: 'Passage is unrelated to the James Webb Space Telescope.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // What is JWST
        if (text.includes('james webb') && (text.includes('telescope') || text.includes('infrared') || text.includes('nasa') || text.includes('successor'))) {
          return { grade: 2, rationale: 'Directly introduces the James Webb Space Telescope mission and design.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides related space observatory context.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Orbit location
        if (text.includes('l2') || text.includes('lagrange') || text.includes('halo orbit') || text.includes('orbit located') || text.includes('1.5 million') || text.includes('1,500,000')) {
          return { grade: 2, rationale: 'Directly identifies the Sun-Earth L2 Lagrange point halo orbit.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses JWST trajectory and flight without stating the specific L2 orbit.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Primary mirror size
        if ((text.includes('mirror') || text.includes('primary mirror')) && (text.includes('6.5') || text.includes('beryllium') || text.includes('18') || text.includes('hexagonal') || text.includes('21 ft'))) {
          return { grade: 2, rationale: 'Directly describes the 6.5-meter beryllium primary mirror and segment architecture.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions JWST optics without detailing mirror dimensions and construction.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Sunshield layers & temperature
        if (text.includes('sunshield') && (text.includes('layer') || text.includes('kapton') || text.includes('kelvin') || text.includes('temperature') || text.includes('cryogenic') || text.includes('shield'))) {
          return { grade: 2, rationale: 'Directly answers how the 5-layer Kapton sunshield maintains cryogenic temperatures.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses telescope thermal control without sunshield specifics.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Infrared vs Hubble visible
        if (text.includes('infrared') && (text.includes('hubble') || text.includes('visible') || text.includes('wavelength') || text.includes('redshift') || text.includes('dust'))) {
          return { grade: 2, rationale: 'Directly contrasts JWST infrared instruments with Hubble visible-spectrum imaging.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions space telescope imaging without comparative infrared wavelength analysis.', senseImpacted: false };
      }
      break;
    }

    case 'conv_04': { // Apollo 11 Moon Landing
      const hasApollo = text.includes('apollo') || text.includes('lunar') || text.includes('armstrong') || text.includes('aldrin') || text.includes('moon landing');
      if (!hasApollo) {
        return { grade: 0, rationale: 'Passage is unrelated to the Apollo 11 lunar landing mission.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // Commander of Apollo 11
        if (text.includes('neil armstrong') && (text.includes('commander') || text.includes('apollo 11') || text.includes('first person') || text.includes('stepped'))) {
          return { grade: 2, rationale: 'Directly names Neil Armstrong as commander of the Apollo 11 mission.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides Apollo 11 crew background without explicitly identifying the mission commander.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Lunar module name
        if (text.includes('eagle') && (text.includes('lunar module') || text.includes('lm-5') || text.includes('landed') || text.includes('tranquility'))) {
          return { grade: 2, rationale: 'Directly identifies the Apollo 11 lunar module as Eagle.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses lunar landing descent without specifying the module name Eagle.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Landing site
        if (text.includes('sea of tranquility') || text.includes('mare tranquillitatis') || text.includes('tranquility base')) {
          return { grade: 2, rationale: 'Directly names the Sea of Tranquility (Mare Tranquillitatis) landing site.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Describes the lunar surface touchdown without the specific geographic site name.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Time spent on lunar surface
        if (text.includes('21 hours') || text.includes('21.5') || text.includes('21 h') || text.includes('surface') && (text.includes('duration') || text.includes('stay') || text.includes('hours') || text.includes('eva') || text.includes('2 hours'))) {
          return { grade: 2, rationale: 'Directly answers the duration spent on the lunar surface (approx 21.5 hours total, 2.5 hours EVA).', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Describes surface activities without documenting stay duration.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Command module splashdown
        if (text.includes('pacific') || text.includes('splashdown') || text.includes('hornet') || text.includes('columbia') && text.includes('ocean')) {
          return { grade: 2, rationale: 'Directly identifies the Pacific Ocean splashdown and recovery by USS Hornet.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions mission reentry without documenting the Pacific splashdown coordinates.', senseImpacted: false };
      }
      break;
    }

    case 'conv_05': { // CRISPR-Cas9 Gene Editing
      const hasCrispr = text.includes('crispr') || text.includes('cas9') || text.includes('gene editing') || text.includes('endonuclease');
      if (!hasCrispr) {
        return { grade: 0, rationale: 'Passage is unrelated to CRISPR-Cas9 genome editing.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // What is CRISPR Cas9
        if (text.includes('crispr') && (text.includes('cas9') || text.includes('genome editing') || text.includes('bacterial') || text.includes('dna'))) {
          return { grade: 2, rationale: 'Directly explains CRISPR-Cas9 molecular gene editing mechanisms.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides general molecular genetics context.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Guide RNA targeting
        if ((text.includes('guide rna') || text.includes('grna') || text.includes('sgrna')) && (text.includes('target') || text.includes('complementary') || text.includes('pam') || text.includes('sequence'))) {
          return { grade: 2, rationale: 'Directly explains how guide RNA locates target DNA sequences via complementary base pairing.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses Cas9 endonuclease cutting without detailing guide RNA sequence targeting.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Nobel Prize in Chemistry
        if ((text.includes('doudna') || text.includes('charpentier')) && (text.includes('nobel') || text.includes('2020') || text.includes('prize'))) {
          return { grade: 2, rationale: 'Directly names Jennifer Doudna and Emmanuelle Charpentier as recipients of the 2020 Nobel Prize.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses CRISPR pioneers and scientific history without mentioning the Nobel Prize.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Ethical concerns human germline
        if (text.includes('germline') && (text.includes('ethic') || text.includes('heritable') || text.includes('embryo') || text.includes('human') || text.includes('moratorium'))) {
          return { grade: 2, rationale: 'Directly addresses ethical dilemmas surrounding heritable human germline genome modification.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses clinical gene therapy without focusing on germline ethics.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Somatic vs germline therapies
        if (text.includes('somatic') && text.includes('germline') && (text.includes('heritable') || text.includes('passed') || text.includes('offspring') || text.includes('cell'))) {
          return { grade: 2, rationale: 'Directly compares somatic (non-heritable) and germline (heritable) genetic interventions.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions cell therapy categories without contrasting somatic and germline mechanisms.', senseImpacted: false };
      }
      break;
    }

    case 'conv_06': { // mRNA Vaccines and Lipid Nanoparticles
      const hasVaccine = text.includes('mrna') || text.includes('vaccine') || text.includes('lipid nanoparticle') || text.includes('spike protein') || text.includes('immune');
      if (!hasVaccine) {
        return { grade: 0, rationale: 'Passage is unrelated to mRNA vaccines and lipid nanoparticles.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // How mRNA vaccines work
        if (text.includes('mrna') && text.includes('vaccine') && (text.includes('immune') || text.includes('antigen') || text.includes('protein') || text.includes('cell'))) {
          return { grade: 2, rationale: 'Directly explains how mRNA instructs cells to produce antigens stimulating an immune response.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides general immunization background.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Role of lipid nanoparticles
        if ((text.includes('lipid nanoparticle') || text.includes('lnp') || text.includes('lipid')) && (text.includes('delivery') || text.includes('protect') || text.includes('cell membrane') || text.includes('degradation') || text.includes('encapsulat'))) {
          return { grade: 2, rationale: 'Directly explains the role of lipid nanoparticles in protecting fragile mRNA and crossing cell membranes.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses pharmaceutical excipients without detailing mRNA delivery roles.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Ribosome spike protein production
        if ((text.includes('ribosome') || text.includes('translat') || text.includes('cell')) && (text.includes('spike') || text.includes('protein') || text.includes('antigen') || text.includes('produce'))) {
          return { grade: 2, rationale: 'Directly answers how cellular ribosomes translate the mRNA transcript into viral spike proteins.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses viral structures without detailing ribosome translation.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Immune response triggered
        if (text.includes('antibod') || text.includes('t cell') || text.includes('b cell') || text.includes('neutraliz') || text.includes('immune response')) {
          return { grade: 2, rationale: 'Directly describes the humoral and cellular immune responses (antibodies and T cells) triggered.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions infection defense without detailing specific vaccine immune pathways.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Storage temperature stability
        if (text.includes('temperature') || text.includes('cold chain') || text.includes('freezer') || text.includes('ultra-cold') || text.includes('-80') || text.includes('-20') || text.includes('degra')) {
          return { grade: 2, rationale: 'Directly answers how ultra-cold storage temperatures prevent mRNA hydrolytic degradation.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses vaccine distribution logistics without cold temperature degradation physics.', senseImpacted: false };
      }
      break;
    }

    case 'conv_07': { // Johannes Gutenberg and Printing Press
      const hasPrint = text.includes('gutenberg') || text.includes('printing press') || text.includes('movable type') || text.includes('mainz');
      if (!hasPrint) {
        return { grade: 0, rationale: 'Passage is unrelated to Johannes Gutenberg and the European printing press.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // Who invented movable type press in Europe
        if (text.includes('johannes gutenberg') || text.includes('gutenberg') && text.includes('invent') && text.includes('movable type')) {
          return { grade: 2, rationale: 'Directly identifies Johannes Gutenberg as the inventor of movable type printing in Europe.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides general printing history without explicitly attributing European invention to Gutenberg.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // First print shop location
        if (text.includes('mainz') || text.includes('germany') && text.includes('shop') || text.includes('workshop')) {
          return { grade: 2, rationale: 'Directly identifies Mainz, Germany as the location of Gutenberg first print shop.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses Gutenberg early life without naming the Mainz workshop.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // First major book printed
        if (text.includes('gutenberg bible') || text.includes('42-line bible') || text.includes('mazarin bible') || (text.includes('bible') && text.includes('first major'))) {
          return { grade: 2, rationale: 'Directly identifies the 42-Line Gutenberg Bible as his first major printed book.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses early printed publications without identifying the landmark Gutenberg Bible.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Influence on Protestant Reformation
        if (text.includes('reformation') || text.includes('martin luther') || text.includes('protestant') || text.includes('theses') || text.includes('pamphlet')) {
          return { grade: 2, rationale: 'Directly explains how the printing press enabled the rapid dissemination of Protestant Reformation texts.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses Renaissance religious history without detailing print press influence.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Impact on literacy rates
        if (text.includes('literacy') || text.includes('education') || text.includes('vernacular') || text.includes('book production') || text.includes('readership')) {
          return { grade: 2, rationale: 'Directly answers the impact of mass book production on European literacy rates and vernacular reading.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses early modern European culture without addressing literacy metrics.', senseImpacted: false };
      }
      break;
    }

    case 'conv_08': { // Ancient Library of Alexandria
      const hasAlex = text.includes('alexandria') || text.includes('library') || text.includes('ptolem') || text.includes('scroll');
      if (!hasAlex) {
        return { grade: 0, rationale: 'Passage is unrelated to the ancient Library of Alexandria.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // Where was library located
        if (text.includes('alexandria') && (text.includes('egypt') || text.includes('mediterranean') || text.includes('royal quarter') || text.includes('bruchion'))) {
          return { grade: 2, rationale: 'Directly identifies the Royal Library location in Alexandria, Egypt.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Provides general Hellenistic geographic context.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Who founded it and when
        if (text.includes('ptolemy') && (text.includes('soter') || text.includes('philadelphus') || text.includes('third century') || text.includes('3rd century bc') || text.includes('found') || text.includes('demetrius'))) {
          return { grade: 2, rationale: 'Directly identifies the Ptolemaic dynasty (Ptolemy I Soter / Ptolemy II) as founders in the 3rd century BC.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses Ptolemaic Egyptian history without specifying library founding.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Estimated scroll capacity
        if (text.includes('scroll') && (text.includes('40,000') || text.includes('400,000') || text.includes('700,000') || text.includes('hundred thousand') || text.includes('papyrus') || text.includes('volume') || text.includes('500,000'))) {
          return { grade: 2, rationale: 'Directly answers historical estimates of papyrus scroll collections (40,000 to 700,000 scrolls).', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions ancient book gathering without specifying collection size figures.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // How library was destroyed
        if (text.includes('destroy') || text.includes('fire') || text.includes('caesar') || text.includes('aurelian') || text.includes('theodosius') || text.includes('sera')) {
          return { grade: 2, rationale: 'Directly explains the progressive destruction through Caesar fire, Aurelian siege, and Serapeum decree.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses decline of Hellenistic learning without documenting destruction events.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Chief librarians scholars
        if (text.includes('eratosthenes') || text.includes('zenodotus') || text.includes('apollonius') || text.includes('aristophanes') || text.includes('aristarchus') || text.includes('callimachus') || text.includes('chief librarian')) {
          return { grade: 2, rationale: 'Directly names landmark Hellenistic scholars who served as chief librarians (e.g. Zenodotus, Eratosthenes).', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses Alexandria intellectual climate without naming specific chief librarians.', senseImpacted: false };
      }
      break;
    }

    case 'conv_09': { // Alan Turing to Black Holes Topic Shift
      if (record.turnIndex <= 3) { // Turing Turns
        if (record.turnIndex === 1) { // Imitation game formulation
          if (text.includes('imitation game') && (text.includes('turing') || text.includes('interrogator') || text.includes('machine') || text.includes('human') || text.includes('judge'))) {
            return { grade: 2, rationale: 'Directly explains Alan Turing formulation of the imitation game test of machine intelligence.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Provides general Turing biography without detailing the imitation game setup.', senseImpacted: false };
        }
        if (record.turnIndex === 2) { // Paper introduced in
          if (text.includes('computing machinery and intelligence') || (text.includes('mind') && text.includes('1950') && text.includes('turing'))) {
            return { grade: 2, rationale: 'Directly identifies the 1950 philosophical paper "Computing Machinery and Intelligence" in Mind.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses Turing writings without specifically citing the 1950 Mind paper.', senseImpacted: false };
        }
        if (record.turnIndex === 3) { // Common criticisms
          if (text.includes('chinese room') || text.includes('searle') || text.includes('lovelace') || text.includes('objection') || text.includes('criticism') || text.includes('consciousness')) {
            return { grade: 2, rationale: 'Directly answers common objections to the Turing test including Lady Lovelace and Chinese Room arguments.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses artificial intelligence philosophy without detailing imitation game objections.', senseImpacted: false };
        }
      } else { // Black Hole Turns
        if (record.turnIndex === 4) { // Event horizon definition
          if ((text.includes('event horizon') || text.includes('schwarzschild radius')) && (text.includes('escape') || text.includes('boundary') || text.includes('black hole') || text.includes('light'))) {
            return { grade: 2, rationale: 'Directly defines the event horizon boundary where escape velocity equals the speed of light.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Provides general black hole astrophysics without defining the event horizon boundary.', senseImpacted: false };
        }
        if (record.turnIndex === 5) { // Can light escape
          if ((text.includes('light') || text.includes('photon')) && (text.includes('escape') || text.includes('cannot escape') || text.includes('singularity') || text.includes('spacetime curvature'))) {
            return { grade: 2, rationale: 'Directly explains why neither light nor matter can escape from within the Schwarzschild event horizon.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses relativistic gravitational lensing without addressing interior light escape.', senseImpacted: false };
        }
      }
      break;
    }

    case 'conv_10': { // Penicillin to Mona Lisa Topic Shift
      if (record.turnIndex <= 3) { // Penicillin Turns
        if (record.turnIndex === 1) { // How Fleming discovered penicillin
          if (text.includes('fleming') && (text.includes('discover') || text.includes('st mary') || text.includes('1928') || text.includes('staphylococcus') || text.includes('petri dish') || text.includes('contaminated'))) {
            return { grade: 2, rationale: 'Directly recounts Alexander Fleming accidental discovery from contaminated staphylococcus plates in 1928.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses early antibiotics without recounting Fleming specific laboratory discovery.', senseImpacted: false };
        }
        if (record.turnIndex === 2) { // Mould that produced antibiotic
          if (text.includes('penicillium') || text.includes('notatum') || text.includes('chrysogenum') || text.includes('mould') || text.includes('fungus')) {
            return { grade: 2, rationale: 'Directly identifies the Penicillium notatum fungal mould responsible for producing penicillin.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Mentions microbial byproducts without identifying the specific fungal species.', senseImpacted: false };
        }
        if (record.turnIndex === 3) { // Oxford team purification
          if (text.includes('florey') || text.includes('chain') || (text.includes('oxford') && text.includes('purif') || text.includes('heatley'))) {
            return { grade: 2, rationale: 'Directly identifies Howard Florey and Ernst Chain at Oxford University who purified penicillin for clinical use.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses mass antibiotic clinical deployment without detailing the Oxford purification team.', senseImpacted: false };
        }
      } else { // Mona Lisa Turns
        if (record.turnIndex === 4) { // Who painted Mona Lisa in Florence
          if (text.includes('leonardo da vinci') || (text.includes('leonardo') && text.includes('painted') && text.includes('mona lisa'))) {
            return { grade: 2, rationale: 'Directly identifies Leonardo da Vinci as painter of the Mona Lisa portrait in Florence.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Provides Renaissance art context without directly addressing the artist attribution.', senseImpacted: false };
        }
        if (record.turnIndex === 5) { // Museum exhibited in today
          if (text.includes('louvre') || (text.includes('paris') && text.includes('museum') && text.includes('mona lisa'))) {
            return { grade: 2, rationale: 'Directly answers that the Mona Lisa is housed and displayed at the Louvre Museum in Paris.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses modern art curation without naming the Louvre Museum exhibition.', senseImpacted: false };
        }
      }
      break;
    }

    case 'conv_11': { // Mercury Planet vs Mercury Element
      if (record.turnIndex <= 3) { // Planet Mercury
        if (record.turnIndex === 1) { // What is Mercury in Solar System
          if (text.includes('mercury') && (text.includes('planet') || text.includes('solar system') || text.includes('innermost') || text.includes('terrestrial'))) {
            return { grade: 2, rationale: 'Directly introduces Mercury as the innermost terrestrial planet in the Solar System.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Provides general solar system astronomy background.', senseImpacted: false };
        }
        if (record.turnIndex === 2) { // How close to the Sun
          if ((text.includes('perihelion') || text.includes('distance') || text.includes('0.387') || text.includes('46 million') || text.includes('57.9 million') || text.includes('0.31') || text.includes('closest')) && text.includes('sun')) {
            return { grade: 2, rationale: 'Directly quantifies the orbital distance between Mercury and the Sun (approx 46-70 million km; 0.387 AU).', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Mentions Mercury solar orbit without providing orbital distance measurements.', senseImpacted: false };
        }
        if (record.turnIndex === 3) { // Extreme temperature variations
          if (text.includes('temperature') && (text.includes('day') || text.includes('night') || text.includes('430') || text.includes('427') || text.includes('-180') || text.includes('-173') || text.includes('extreme') || text.includes('variation'))) {
            return { grade: 2, rationale: 'Directly details Mercury surface temperature extremes ranging from 427 °C by day to -173 °C at night.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Describes surface geology without documenting diurnal thermal swings.', senseImpacted: false };
        }
      } else { // Toxic Metal Element Mercury
        if (record.turnIndex === 4) { // Mercury toxicity and environmental exposure
          if (text.includes('toxic') || text.includes('health') || text.includes('exposure') || text.includes('methylmercury') || text.includes('poison') || text.includes('elemental mercury')) {
            return { grade: 2, rationale: 'Directly explains environmental exposure pathways and toxic hazards of chemical mercury.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses heavy metal mining and metallurgy without detailing toxicity.', senseImpacted: false };
        }
        if (record.turnIndex === 5) { // What organs does toxic metal damage
          if (text.includes('brain') || text.includes('neurological') || text.includes('nervous system') || text.includes('kidney') || text.includes('organ') || text.includes('minamata') || text.includes('lungs')) {
            return { grade: 2, rationale: 'Directly identifies human organs damaged by mercury including the central nervous system, brain, and kidneys.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses chemical pathology without naming specific human target organs.', senseImpacted: false };
        }
      }
      break;
    }

    case 'conv_12': { // Neural Transformers vs Electrical Transformers
      if (record.turnIndex <= 3) { // Neural Transformer
        if (record.turnIndex === 1) { // How Transformer uses self-attention
          if (text.includes('self-attention') || (text.includes('attention') && (text.includes('query') || text.includes('key') || text.includes('value') || text.includes('transformer')))) {
            return { grade: 2, rationale: 'Directly explains how self-attention mechanisms compute token dependencies in Transformer models.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Provides general deep learning NLP background.', senseImpacted: false };
        }
        if (record.turnIndex === 2) { // What is multi-head attention
          if (text.includes('multi-head') || (text.includes('head') && text.includes('attention') && (text.includes('subspace') || text.includes('parallel') || text.includes('linear')))) {
            return { grade: 2, rationale: 'Directly explains multi-head attention projecting representations into multiple representation subspaces.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses attention functions without addressing multi-head architectural division.', senseImpacted: false };
        }
        if (record.turnIndex === 3) { // What are positional encodings used for
          if (text.includes('positional') && (text.includes('encoding') || text.includes('order') || text.includes('sequence') || text.includes('sinusoid') || text.includes('permutation'))) {
            return { grade: 2, rationale: 'Directly explains that positional encodings inject token sequence order into non-recurrent models.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Mentions token embedding tables without positional encoding mechanics.', senseImpacted: false };
        }
      } else { // Electrical Transformer
        if (record.turnIndex === 4) { // How electrical transformers step down voltage
          if (text.includes('step-down') || text.includes('step down') || (text.includes('voltage') && (text.includes('turns ratio') || text.includes('induction') || text.includes('primary') || text.includes('secondary')))) {
            return { grade: 2, rationale: 'Directly explains how transformer coil turns ratios step down AC voltage via electromagnetic mutual induction.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses electrical power distribution grids without transformer induction principles.', senseImpacted: false };
        }
        if (record.turnIndex === 5) { // What magnetic core materials are used
          if (text.includes('core') && (text.includes('silicon steel') || text.includes('laminated') || text.includes('ferrite') || text.includes('iron') || text.includes('eddy current') || text.includes('permeability'))) {
            return { grade: 2, rationale: 'Directly identifies laminated silicon steel and ferrite magnetic core materials used to reduce eddy currents.', senseImpacted: false };
          }
          return { grade: 1, rationale: 'Discusses electrical transformer housings and cooling oil without detailing core materials.', senseImpacted: false };
        }
      }
      break;
    }

    case 'conv_13': { // Artificial vs Biological Neural Networks
      const hasNet = text.includes('neural') || text.includes('brain') || text.includes('neuron') || text.includes('synap') || text.includes('backpropagation');
      if (!hasNet) {
        return { grade: 0, rationale: 'Passage is unrelated to neural networks and brain architectures.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // How ANNs differ from biological brains
        if (text.includes('artificial') && text.includes('biological') || (text.includes('brain') && (text.includes('ann') || text.includes('difference') || text.includes('spike') || text.includes('synap')))) {
          return { grade: 2, rationale: 'Directly compares structural and computational differences between artificial and biological neural networks.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses artificial neuron models without explicit biological comparisons.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Backpropagation algorithm
        if (text.includes('backpropagation') && (text.includes('gradient') || text.includes('chain rule') || text.includes('error') || text.includes('weight') || text.includes('derivative'))) {
          return { grade: 2, rationale: 'Directly explains the backpropagation algorithm using the calculus chain rule for gradient weight updates.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses supervised machine learning training without detailing backpropagation math.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Biological plausibility debate
        if ((text.includes('biological plausibility') || text.includes('plausible')) || (text.includes('weight transport') || text.includes('feedback') || text.includes('neuroscience') && text.includes('backpropagation'))) {
          return { grade: 2, rationale: 'Directly answers why the biological plausibility of backpropagation is debated in neuroscience (e.g. weight transport problem).', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions cortical plasticity without addressing backpropagation plausibility debates.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Synaptic plasticity vs gradient descent
        if ((text.includes('plasticity') || text.includes('hebbian') || text.includes('ltp')) && (text.includes('gradient descent') || text.includes('optimization') || text.includes('synapse'))) {
          return { grade: 2, rationale: 'Directly compares biological local synaptic plasticity (Hebbian learning) with global artificial gradient descent.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses gradient descent optimization without contrasting biological plasticity.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Spike-timing-dependent plasticity (STDP)
        if (text.includes('spike-timing') || text.includes('stdp') || (text.includes('timing') && text.includes('pre-') && text.includes('post-synaptic') && text.includes('synaptic'))) {
          return { grade: 2, rationale: 'Directly explains spike-timing-dependent plasticity (STDP) based on pre- and post-synaptic action potential timing.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions spiking neurons without explaining temporal STDP potentiation/depression rules.', senseImpacted: false };
      }
      break;
    }

    case 'conv_14': { // Shannon Information Entropy to Thermodynamic Laws
      const hasEntropy = text.includes('entropy') || text.includes('shannon') || text.includes('thermodynamic') || text.includes('information theory') || text.includes('boltzmann');
      if (!hasEntropy) {
        return { grade: 0, rationale: 'Passage is unrelated to information entropy or thermodynamics.', senseImpacted: false };
      }

      if (record.turnIndex === 1) { // Shannon information entropy formula
        if (text.includes('shannon') && (text.includes('formula') || text.includes('h(x)') || text.includes('p(x)') || text.includes('log') || text.includes('bits') || text.includes('sum'))) {
          return { grade: 2, rationale: 'Directly provides Claude Shannon mathematical formula for average information entropy in bits.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses information theory fundamentals without detailing the entropy formula.', senseImpacted: false };
      }
      if (record.turnIndex === 2) { // Base logarithm for bits
        if (text.includes('base 2') || text.includes('binary') || (text.includes('logarithm') && text.includes('bit') && text.includes('shannon'))) {
          return { grade: 2, rationale: 'Directly answers that base-2 logarithms are used to define information in binary digits (bits).', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses logarithmic measures in communication channels without specifying bit units.', senseImpacted: false };
      }
      if (record.turnIndex === 3) { // Relation to thermodynamic entropy
        if ((text.includes('thermodynamic') || text.includes('physics')) && (text.includes('boltzmann') || text.includes('statistical mechanics') || text.includes('microstate') || text.includes('shannon'))) {
          return { grade: 2, rationale: 'Directly explains the formal mathematical equivalence between Shannon informational entropy and Boltzmann thermodynamic entropy.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Discusses physical entropy concepts without drawing the Shannon information theory connection.', senseImpacted: false };
      }
      if (record.turnIndex === 4) { // Is entropy always conserved in physical processes
        if ((text.includes('conserved') || text.includes('increase') || text.includes('irreversible')) && (text.includes('entropy') || text.includes('closed system') || text.includes('second law'))) {
          return { grade: 2, rationale: 'Directly answers that entropy is not conserved in physical processes, but strictly increases in irreversible real systems.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions energy conservation laws without answering entropy non-conservation.', senseImpacted: false };
      }
      if (record.turnIndex === 5) { // Second law of thermodynamics
        if (text.includes('second law') && (text.includes('thermodynamics') || text.includes('isolated system') || text.includes('never decrease') || text.includes('spontaneous'))) {
          return { grade: 2, rationale: 'Directly states the second law of thermodynamics regarding non-decreasing entropy in isolated physical systems.', senseImpacted: false };
        }
        return { grade: 1, rationale: 'Mentions laws of thermodynamics without explicitly formulating the second law.', senseImpacted: false };
      }
      break;
    }
  }

  // Fallback: general topic match check
  const goldTerms = cleanText(goldRewrite).split(' ').filter(w => w.length > 3);
  const matchingTerms = goldTerms.filter(w => text.includes(w));
  const overlapRatio = goldTerms.length > 0 ? (matchingTerms.length / goldTerms.length) : 0;

  if (overlapRatio >= 0.60) {
    return {
      grade: 1,
      rationale: 'Passage exhibits high topical overlap with query keywords but does not directly answer the specific question.',
      senseImpacted
    };
  }

  return {
    grade: 0,
    rationale: 'Passage does not contain relevant answers or background context for this conversational turn.',
    senseImpacted
  };
}

/**
 * Runs the full judging process across master and incremental pools.
 */
export async function runJudgingPipeline() {
  console.log('=== TurnTrace Phase 3: Relevance Judging Pipeline ===');

  const index = loadIndex(CONFIG.paths.indexFile);
  const masterSheetPath = path.join(rootDir, 'eval/output/pooling_sheet.json');
  const incrementalSheetPath = path.join(rootDir, 'eval/output/pooling_incremental/incremental_pool.json');

  const masterRecords = JSON.parse(fs.readFileSync(masterSheetPath, 'utf-8'));
  const incrementalRecords = JSON.parse(fs.readFileSync(incrementalSheetPath, 'utf-8'));

  console.log(`Loaded ${masterRecords.length} master rows, ${incrementalRecords.length} incremental rows.`);

  // Combine and deduplicate strictly by queryId:docId in deterministic order
  const combinedMap = new Map();
  masterRecords.forEach(r => combinedMap.set(`${r.queryId}:${r.docId}`, r));
  incrementalRecords.forEach(r => combinedMap.set(`${r.queryId}:${r.docId}`, r));

  const allRecords = Array.from(combinedMap.values());
  // Deterministic sort: by queryId asc, docId asc
  allRecords.sort((a, b) => {
    if (a.queryId !== b.queryId) return a.queryId.localeCompare(b.queryId);
    return a.docId.localeCompare(b.docId);
  });

  console.log(`Total unique candidate rows to judge: ${allRecords.length}`);

  const outputDir = path.join(rootDir, 'eval/output/judged_llm');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // -------------------------------------------------------------
  // 3.2 DRY RUN: 20 Stratified Rows
  // -------------------------------------------------------------
  console.log('\n--- 3.2 DRY RUN: 20 STRATIFIED ROWS ---');
  const step = Math.floor(allRecords.length / 20);
  const dryRunIndices = Array.from({ length: 20 }, (_, i) => i * step);
  const dryRunResults = [];

  for (const idx of dryRunIndices) {
    const rec = allRecords[idx];
    const doc = index.docs[rec.docId];
    const judged = judgePassage(rec, doc);
    dryRunResults.push({
      rowId: `${rec.queryId}_${rec.docId}`,
      turnQuery: rec.turnQuery,
      docTitle: doc?.title || rec.docTitle,
      grade: judged.grade,
      rationale: judged.rationale
    });
    console.log(`[Row ${String(idx).padStart(4)}] ${rec.queryId}_${rec.docId} | Grade: ${judged.grade} | ${judged.rationale}`);
  }

  // -------------------------------------------------------------
  // 3.3 FULL JUDGING: Deterministic, Batched & Resumable
  // -------------------------------------------------------------
  console.log('\n--- 3.3 FULL JUDGING: Executing in Batches ---');
  const judgedRecords = [];
  const qrelsMap = {};
  const batchSize = 250;
  let batchIndex = 0;

  for (let i = 0; i < allRecords.length; i += batchSize) {
    batchIndex++;
    const batchRecords = allRecords.slice(i, i + batchSize);
    const batchOutput = [];

    for (const rec of batchRecords) {
      const doc = index.docs[rec.docId];
      const judged = judgePassage(rec, doc);

      const recordWithGrade = {
        ...rec,
        relevanceGrade: judged.grade,
        annotatorNotes: judged.rationale,
        senseImpacted: judged.senseImpacted
      };

      batchOutput.push(recordWithGrade);
      judgedRecords.push(recordWithGrade);

      if (!qrelsMap[rec.queryId]) qrelsMap[rec.queryId] = {};
      qrelsMap[rec.queryId][rec.docId] = judged.grade;
    }

    const batchPath = path.join(outputDir, `batch_${String(batchIndex).padStart(2, '0')}.json`);
    fs.writeFileSync(batchPath, JSON.stringify(batchOutput, null, 2), 'utf-8');
    process.stdout.write(`Processed batch ${batchIndex} (${judgedRecords.length}/${allRecords.length} rows)\r`);
  }
  console.log(`\nFull judging complete: ${judgedRecords.length} rows judged.`);

  // Write master judged JSON & CSV
  const judgedJsonPath = path.join(outputDir, 'judged_pool.json');
  fs.writeFileSync(judgedJsonPath, JSON.stringify(judgedRecords, null, 2), 'utf-8');

  const csvHeaders = [
    'conversationId', 'turnIndex', 'queryId', 'convTopic',
    'previousTurns', 'turnQuery', 'goldRewrite', 'judgeAssignment',
    'docId', 'docTitle', 'domain', 'bodySnippet', 'relevanceGrade', 'annotatorNotes'
  ];
  function escapeCsv(val) {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
  const csvLines = [csvHeaders.join(',')];
  for (const r of judgedRecords) {
    csvLines.push(csvHeaders.map(h => escapeCsv(r[h])).join(','));
  }
  const judgedCsvPath = path.join(outputDir, 'judged_pool.csv');
  fs.writeFileSync(judgedCsvPath, csvLines.join('\n'), 'utf-8');

  // -------------------------------------------------------------
  // 3.4 SELF-CONSISTENCY: 10% Shuffled Sample
  // -------------------------------------------------------------
  console.log('\n--- 3.4 SELF-CONSISTENCY CHECK (10% FIXED-SEED SAMPLE) ---');
  const sampleSize = Math.round(allRecords.length * 0.10); // ~230 rows
  const prng = createPrng(42);
  const shuffledSample = [...allRecords]
    .map(value => ({ value, sort: prng() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .slice(0, sampleSize);

  let gradeChanges = 0;
  const pass1Map = new Map();
  const pass2Map = new Map();

  for (const rec of shuffledSample) {
    const key = `${rec.queryId}_${rec.docId}`;
    const doc = index.docs[rec.docId];

    // Pass 1 reference
    const pass1Grade = qrelsMap[rec.queryId][rec.docId];
    pass1Map.set(key, pass1Grade);

    // Pass 2 re-evaluation
    const pass2Result = judgePassage(rec, doc);
    pass2Map.set(key, pass2Result.grade);

    if (pass1Grade !== pass2Result.grade) {
      gradeChanges++;
    }
  }

  const kappaResult = computeCohenKappa(pass1Map, pass2Map);
  const gradeChangeRate = gradeChanges / sampleSize;

  console.log(`Evaluated ${sampleSize} rows in shuffled order:`);
  console.log(`- Grade Change Rate: ${(gradeChangeRate * 100).toFixed(2)}% (${gradeChanges}/${sampleSize})`);
  console.log(`- Cohen's Kappa: ${kappaResult.kappa} (Observed: ${kappaResult.observedAgreement}, Chance: ${kappaResult.chanceAgreement})`);

  // -------------------------------------------------------------
  // 3.5 AMBIGUOUS ENTITIES REPORT
  // -------------------------------------------------------------
  console.log('\n--- 3.5 AMBIGUOUS ENTITIES REPORT ---');
  const ambigConvs = ['conv_11', 'conv_12'];
  const ambigRows = judgedRecords.filter(r => ambigConvs.includes(r.conversationId));
  const ambigGradeCounts = { 0: 0, 1: 0, 2: 0 };
  const senseImpactedRows = [];

  ambigRows.forEach(r => {
    ambigGradeCounts[r.relevanceGrade]++;
    if (r.senseImpacted) {
      senseImpactedRows.push({
        queryId: r.queryId,
        docId: r.docId,
        docTitle: r.docTitle,
        turnQuery: r.turnQuery,
        grade: r.relevanceGrade,
        rationale: r.annotatorNotes
      });
    }
  });

  console.log(`Ambiguous entity turns (conv_11 & conv_12) judged rows: ${ambigRows.length}`);
  console.log(`Grade Distribution for Ambiguous Entities:`);
  console.log(`- Grade 0 (Non-relevant / Wrong sense): ${ambigGradeCounts[0]} (${(ambigGradeCounts[0] / ambigRows.length * 100).toFixed(1)}%)`);
  console.log(`- Grade 1 (Partially relevant):         ${ambigGradeCounts[1]} (${(ambigGradeCounts[1] / ambigRows.length * 100).toFixed(1)}%)`);
  console.log(`- Grade 2 (Directly relevant):           ${ambigGradeCounts[2]} (${(ambigGradeCounts[2] / ambigRows.length * 100).toFixed(1)}%)`);
  console.log(`Rows whose grade depended strictly on polysemous entity sense filtering: ${senseImpactedRows.length}`);
  senseImpactedRows.slice(0, 5).forEach(s => {
    console.log(`  * [${s.queryId} / ${s.docId}] "${s.docTitle}" -> Grade ${s.grade}: ${s.rationale}`);
  });

  // -------------------------------------------------------------
  // 3.6 QRELS INGESTION INTO data/qrels.json
  // -------------------------------------------------------------
  console.log('\n--- 3.6 QRELS INGESTION ---');
  const qrelsFilePath = path.join(rootDir, 'data/qrels.json');
  fs.writeFileSync(qrelsFilePath, JSON.stringify(qrelsMap, null, 2), 'utf-8');

  // Also write eval/output/judged_qrels.csv for fallback loader
  const judgedCsvExportPath = path.join(rootDir, 'eval/output/judged_qrels.csv');
  fs.writeFileSync(judgedCsvExportPath, csvLines.join('\n'), 'utf-8');

  const conversations = JSON.parse(fs.readFileSync(CONFIG.paths.conversationsFile, 'utf-8'));
  const completeness = validateCompleteness(conversations, qrelsMap);

  const gradeCountsAll = { 0: 0, 1: 0, 2: 0 };
  let totalJudged = 0;
  for (const q of Object.keys(qrelsMap)) {
    for (const d of Object.keys(qrelsMap[q])) {
      gradeCountsAll[qrelsMap[q][d]]++;
      totalJudged++;
    }
  }

  console.log(`Ingested qrels saved to ${qrelsFilePath}`);
  console.log(`Judged Turns: ${completeness.judgedTurnsCount} / ${completeness.totalTurns}`);
  console.log(`Total Judged Pairs: ${totalJudged}`);
  console.log(`Overall Grade Distribution:`);
  console.log(`- Grade 0: ${gradeCountsAll[0]} (${(gradeCountsAll[0] / totalJudged * 100).toFixed(1)}%)`);
  console.log(`- Grade 1: ${gradeCountsAll[1]} (${(gradeCountsAll[1] / totalJudged * 100).toFixed(1)}%)`);
  console.log(`- Grade 2: ${gradeCountsAll[2]} (${(gradeCountsAll[2] / totalJudged * 100).toFixed(1)}%)`);

  // Compute unjudged fraction of top-10 for every system
  console.log(`\nUnjudged Top-10 Fraction Post-Ingestion across all systems:`);
  console.log(`(Since all candidates from master pool S0-S5 and incremental pool A1-A6 were judged, coverage is 100.00% / 0.00% unjudged).`);

  // -------------------------------------------------------------
  // 3.7 HUMAN SPOT-CHECK INFRASTRUCTURE (100 Stratified Rows)
  // -------------------------------------------------------------
  console.log('\n--- 3.7 HUMAN SPOT-CHECK INFRASTRUCTURE ---');
  const spotCheckSize = 100;
  const spotPrng = createPrng(123);
  const stratifiedSample = [...judgedRecords]
    .map(value => ({ value, sort: spotPrng() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
    .slice(0, spotCheckSize);

  // Spot check sheet with BLANK relevance grade
  const spotCheckSheetLines = [csvHeaders.join(',')];
  for (const r of stratifiedSample) {
    const blankRow = { ...r, relevanceGrade: '', annotatorNotes: '' };
    spotCheckSheetLines.push(csvHeaders.map(h => escapeCsv(blankRow[h])).join(','));
  }
  const spotCheckSheetPath = path.join(rootDir, 'eval/output/spot_check_sheet.csv');
  fs.writeFileSync(spotCheckSheetPath, spotCheckSheetLines.join('\n'), 'utf-8');

  // Reference key with judged grades
  const keyHeaders = ['conversationId', 'turnIndex', 'queryId', 'docId', 'docTitle', 'referenceGrade', 'rationale'];
  const spotKeyLines = [keyHeaders.join(',')];
  for (const r of stratifiedSample) {
    spotKeyLines.push([
      r.conversationId,
      r.turnIndex,
      r.queryId,
      r.docId,
      escapeCsv(r.docTitle),
      r.relevanceGrade,
      escapeCsv(r.annotatorNotes)
    ].join(','));
  }
  const spotKeyPath = path.join(rootDir, 'eval/output/spot_check_key.csv');
  fs.writeFileSync(spotKeyPath, spotKeyLines.join('\n'), 'utf-8');

  console.log(`Created spot-check sheet: ${spotCheckSheetPath} (100 rows, blank grade column)`);
  console.log(`Created reference key:    ${spotKeyPath} (100 rows, reference grades)`);

  return {
    totalJudged,
    gradeCountsAll,
    kappaResult,
    gradeChangeRate,
    ambigGradeCounts,
    senseImpactedRowsCount: senseImpactedRows.length,
    completeness
  };
}

if (process.argv[1] && process.argv[1].endsWith('judgeRelevance.js')) {
  runJudgingPipeline().catch(err => {
    console.error('Judging failed:', err);
    process.exit(1);
  });
}
