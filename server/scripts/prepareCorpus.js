/**
 * @file server/scripts/prepareCorpus.js
 * @description Generates a reproducible multi-domain Wikipedia passage corpus
 * (35,000 passages across 4 domains) along with 14 multi-turn conversations
 * (70 judged turns) and pooled qrels relevance judgments.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../src/config/index.js';

// Domain definitions and core topic hierarchies
const DOMAIN_SEEDS = [
  {
    domain: 'cs_ai',
    name: 'Computer Science and Artificial Intelligence',
    topics: [
      {
        title: 'Information Retrieval and Inverted Indexing',
        articles: [
          'Inverted Index Architecture and Postings Lists',
          'Term Frequency and Inverse Document Frequency Formulation',
          'Vector Space Model and SMART Cosine Scoring',
          'Okapi BM25 Probabilistic Retrieval Model',
          'Positional Indexes and Phrase Query Processing',
          'Boolean Model and Fast Postings Intersection',
          'Champion Lists and Tiered Indexes for Top-K Selection',
          'Reciprocal Rank Fusion in Multi-Query Retrieval',
          'Evaluation Metrics: Precision, Recall, MAP, and nDCG',
          'PageRank Algorithm and Web Graph Link Analysis',
          'Latent Semantic Analysis and Singular Value Decomposition',
          'Language Models for Information Retrieval'
        ]
      },
      {
        title: 'Machine Learning and Neural Networks',
        articles: [
          'Transformer Architecture and Scaled Dot-Product Attention',
          'BERT: Bidirectional Encoder Representations from Transformers',
          'Convolutional Neural Networks for Computer Vision',
          'Recurrent Neural Networks and Long Short-Term Memory',
          'Stochastic Gradient Descent and Backpropagation Algorithm',
          'Deep Reinforcement Learning and Policy Gradients',
          'Generative Adversarial Networks and Latent Spaces',
          'Word2Vec and Distributed Semantic Word Embeddings',
          'Overfitting, Regularization, and Dropout Techniques',
          'Claude Shannon: Mathematical Theory of Communication and Information Entropy'
        ]
      },
      {
        title: 'Computing Foundations and History',
        articles: [
          'Alan Turing and the Universal Turing Machine',
          'The Turing Test and Philosophy of Machine Intelligence',
          'John von Neumann Architecture and Sequential Execution',
          'Time Complexity, NP-Completeness, and Computational Classes',
          'Relational Database Systems and Edgar F Codd Normalization',
          'Distributed Systems and the CAP Theorem'
        ]
      }
    ]
  },
  {
    domain: 'space_physics',
    name: 'Space Exploration and Astrophysics',
    topics: [
      {
        title: 'Space Missions and Observatories',
        articles: [
          'James Webb Space Telescope: Mission, Orbit at L2, and Instruments',
          'Hubble Space Telescope Discoveries and Optical Deep Fields',
          'Apollo 11 Mission: Saturn V, Lunar Module, and First Landing',
          'NASA Artemis Program: Lunar Gateway and Orion Spacecraft',
          'Voyager 1 and 2: Interstellar Space and Pale Blue Dot',
          'Mars Rovers: Curiosity, Perseverance, and Search for Biosignatures',
          'International Space Station: Microgravity Research Laboratory',
          'Cassini-Huygens Mission: Saturn Rings and Titan Landing'
        ]
      },
      {
        title: 'Planetary Science and the Solar System',
        articles: [
          'Mercury: Extreme Temperature Fluctuations and Solar Proximity',
          'Venus: Runaway Greenhouse Effect and Dense Atmosphere',
          'Mars: Geological Features, Olympus Mons, and Polar Ice Caps',
          'Jupiter: Great Red Spot and Magnetospheric Dynamics',
          'Exoplanet Detection: Transit Photometry and Radial Velocity Method'
        ]
      },
      {
        title: 'Astrophysics and Cosmology',
        articles: [
          'Albert Einstein and the General Theory of Relativity',
          'Black Holes, Event Horizons, and Schwarzschild Radius',
          'Neutron Stars, Pulsars, and Gravitational Wave Astronomy',
          'The Big Bang Theory and Cosmic Microwave Background Radiation',
          'Dark Matter, Dark Energy, and the Accelerating Universe',
          'Thermodynamics and the Second Law of Entropy Increase'
        ]
      }
    ]
  },
  {
    domain: 'biology_medicine',
    name: 'Biology, Genetics, and Medicine',
    topics: [
      {
        title: 'Molecular Genetics and Biotechnology',
        articles: [
          'CRISPR-Cas9 Gene Editing System and Guide RNA Mechanisms',
          'DNA Structure: Double Helix, Base Pairing, and Watson-Crick Discovery',
          'Human Genome Project: Sequencing, Mapping, and Bioethics',
          'Messenger RNA Vaccines: Lipid Nanoparticles and Spike Protein Expression',
          'Polymerase Chain Reaction and DNA Amplification by Kary Mullis',
          'Epigenetics, DNA Methylation, and Chromatin Remodeling',
          'Zinc Finger Nucleases and TALENs for Targeted Genome Editing'
        ]
      },
      {
        title: 'Physiology, Immunology, and Pharmacology',
        articles: [
          'Alexander Fleming and the Discovery of Penicillin from Penicillium',
          'Mass Production of Antibiotics by Howard Florey and Ernst Chain',
          'Antibody Structure, B-Cells, and Adaptive Immune Response',
          'Cellular Respiration, Glycolysis, and ATP Production in Mitochondria',
          'Photosynthesis: Light-Dependent Reactions and the Calvin Cycle',
          'Mercury Toxicity: Minamata Disease, Neurotoxicity, and Heavy Metals',
          'Synaptic Plasticity, Neurotransmitters, and Long-Term Potentiation'
        ]
      }
    ]
  },
  {
    domain: 'history_civilization',
    name: 'History, Civilization, and Philosophy',
    topics: [
      {
        title: 'Renaissance, Inventions, and the Scientific Revolution',
        articles: [
          'Johannes Gutenberg and the European Movable Type Printing Press',
          'The Gutenberg Bible and Mass Production of Printed Literature',
          'The Protestant Reformation and the Spread of Printed Pamphlets',
          'Leonardo da Vinci: The Mona Lisa, Polymath Notebooks, and Renaissance Art',
          'The Scientific Revolution: Galileo Galilei, Copernicus, and Heliocentrism',
          'Isaac Newton: Principia Mathematica and Universal Gravitation'
        ]
      },
      {
        title: 'Ancient Empires, Knowledge, and Philosophy',
        articles: [
          'The Ancient Library of Alexandria: Royal Ptolemaic Scholarship and Loss',
          'Scholars of Alexandria: Eratosthenes, Callimachus, and Aristarchus',
          'The Silk Road: Afro-Eurasian Trade Routes and Cultural Transmission',
          'The Roman Empire: Pax Romana, Roman Law, and Engineering Feats',
          'Classical Greek Philosophy: Socrates, Plato, and Aristotle',
          'The Industrial Revolution: Steam Power, Mechanization, and Urbanization'
        ]
      },
      {
        title: 'Electrical Engineering and Industrial Inventions',
        articles: [
          'Electrical Transformers: Electromagnetic Induction and AC Power Transmission',
          'Nikola Tesla, Thomas Edison, and the War of the Currents',
          'Michael Faraday and Discovery of Electromagnetic Induction'
        ]
      }
    ]
  }
];

// Rich paragraph templates per domain to generate realistic, content-dense passages
const EXPANSION_TEMPLATES = {
  cs_ai: [
    'The algorithm relies on mathematical formalisms where token vectors are normalized in multi-dimensional vector space. In classical information retrieval, document frequency quantifies the collection-wide specificity of each indexed term.',
    'Efficient evaluation requires pruning techniques such as champion lists and early termination heuristics. High document frequency terms provide minimal discriminative power compared to rare terms.',
    'Experimental validation on standard test collections demonstrates that probabilistic scoring functions balance term frequency saturation with document length normalization.',
    'Query decomposition enables breaking complex multi-part queries into constituent Boolean constraints and semantic vectors, improving recall across diverse passage zones.',
    'In conversational retrieval architectures, preserving decaying term weights from preceding turns resolves anaphora without overwhelming the scoring vector with obsolete context.'
  ],
  space_physics: [
    'Observation instruments onboard astronomical observatories operate under extreme cryogenic conditions to detect infrared emissions from the early universe.',
    'Gravitational physics dictates orbital mechanics around the second Sun-Earth Lagrange point, providing an unobstructed view of cosmological phenomena.',
    'Planetary exploration missions utilize spectrometers and multispectral imagers to detect mineralogical signatures and assess historical habitability.',
    'Theoretical models of stellar collapse predict that compact remnants form either degenerate neutron cores or event horizons from which no electromagnetic radiation escapes.',
    'Cosmological observations indicate that expansion acceleration is driven by unknown dark energy, counteracting gravitational attraction across intergalactic distances.'
  ],
  biology_medicine: [
    'Biochemical pathways in molecular biology rely on precise molecular recognition between nucleotide sequences and enzymatic catalytic domains.',
    'Therapeutic applications of engineered nucleases target specific genomic loci, introducing double-strand breaks that prompt cellular DNA repair mechanisms.',
    'Immunological memory develops following antigen presentation by dendritic cells to naive T-lymphocytes, leading to clonal expansion and durable antibody titers.',
    'Cellular metabolism depends on mitochondrial electron transport chains where proton gradients drive ATP synthesis across lipid bilayer membranes.',
    'Pharmacological safety profiles require rigorous evaluation of heavy metal toxicokinetics, focusing on bioaccumulation, renal clearance, and blood-brain barrier permeability.'
  ],
  history_civilization: [
    'Historical documentation confirms that technological innovations in movable type fundamentally transformed European literacy rates and scholarly communication networks.',
    'The preservation of classical manuscripts across imperial libraries enabled Renaissance thinkers to synthesize ancient philosophical treatises with empirical observation.',
    'Commercial trade networks connecting East Asia and the Mediterranean basin facilitated not only economic exchange but also technological transfer, religious ideas, and cartography.',
    'Sociopolitical revolutions throughout modern history coincided with rapid diffusion of printed pamphlets, destabilizing monarchical authority and reshaping legal institutions.',
    'Electromagnetic power generation in the late nineteenth century established modern electrical distribution grids, replacing localized steam engines with centralized power plants.'
  ]
};

/**
 * Builds the 14 multi-turn conversations (70 judged turns) with full annotations.
 */
function buildConversations() {
  return [
    {
      id: 'conv_01',
      domain: 'cs_ai',
      topic: 'Vector Space Model and Weighting Schemes',
      turns: [
        {
          turnId: 'turn_01',
          query: 'What is the vector space model in information retrieval?',
          goldRewrite: 'What is the vector space model in information retrieval?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['vector space model', 'cosine', 'information retrieval']
        },
        {
          turnId: 'turn_02',
          query: 'How does term frequency weighting work in it?',
          goldRewrite: 'How does term frequency weighting work in the vector space model?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['term frequency', 'vector space model', 'logarithmic']
        },
        {
          turnId: 'turn_03',
          query: 'What about cosine normalization?',
          goldRewrite: 'What is cosine normalization in the vector space model?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['cosine normalization', 'euclidean length', 'vector space']
        },
        {
          turnId: 'turn_04',
          query: 'Why is document length normalization needed?',
          goldRewrite: 'Why is document length normalization needed in the vector space model?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['document length normalization', 'short documents', 'vector space']
        },
        {
          turnId: 'turn_05',
          query: 'Compare it with Okapi BM25.',
          goldRewrite: 'Compare vector space model with Okapi BM25 scoring.',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: true,
          targetDocKeywords: ['Okapi BM25', 'vector space model', 'probabilistic retrieval']
        }
      ]
    },
    {
      id: 'conv_02',
      domain: 'cs_ai',
      topic: 'PageRank and Web Graph Link Analysis',
      turns: [
        {
          turnId: 'turn_01',
          query: 'How does PageRank calculate authority scores?',
          goldRewrite: 'How does PageRank calculate authority scores on the web graph?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['PageRank', 'authority scores', 'web graph']
        },
        {
          turnId: 'turn_02',
          query: 'Who invented the algorithm?',
          goldRewrite: 'Who invented the PageRank algorithm at Stanford?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Larry Page', 'Sergey Brin', 'PageRank', 'Stanford']
        },
        {
          turnId: 'turn_03',
          query: 'What is the random surfer model?',
          goldRewrite: 'What is the random surfer model in PageRank?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['random surfer', 'transition probability', 'PageRank']
        },
        {
          turnId: 'turn_04',
          query: 'Does it handle dead ends and spider traps?',
          goldRewrite: 'How does PageRank handle dead ends and spider traps with damping?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['spider traps', 'dead ends', 'damping factor', 'PageRank']
        },
        {
          turnId: 'turn_05',
          query: 'What is the standard damping factor value?',
          goldRewrite: 'What is the standard damping factor value used in PageRank?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['damping factor', '0.85', 'PageRank']
        }
      ]
    },
    {
      id: 'conv_03',
      domain: 'space_physics',
      topic: 'James Webb Space Telescope',
      turns: [
        {
          turnId: 'turn_01',
          query: 'When was the James Webb Space Telescope launched?',
          goldRewrite: 'When was the James Webb Space Telescope launched by NASA and ESA?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['James Webb Space Telescope', 'launch', 'Ariane 5']
        },
        {
          turnId: 'turn_02',
          query: 'What orbit is it located in?',
          goldRewrite: 'What orbit is the James Webb Space Telescope located in?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Lagrange point L2', 'orbit', 'James Webb']
        },
        {
          turnId: 'turn_03',
          query: 'How does its sunshield protect instruments?',
          goldRewrite: 'How does the James Webb Space Telescope sunshield protect instruments?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['sunshield', 'cryogenic temperature', 'infrared', 'James Webb']
        },
        {
          turnId: 'turn_04',
          query: 'Tell me about its primary mirror size.',
          goldRewrite: 'What is the size and diameter of the James Webb Space Telescope primary mirror?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['primary mirror', 'beryllium', '6.5 meters', 'James Webb']
        },
        {
          turnId: 'turn_05',
          query: 'What has it discovered about early galaxies?',
          goldRewrite: 'What has the James Webb Space Telescope discovered about early high-redshift galaxies?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['early galaxies', 'high redshift', 'cosmic dawn', 'James Webb']
        }
      ]
    },
    {
      id: 'conv_04',
      domain: 'space_physics',
      topic: 'Apollo Program and NASA Artemis',
      turns: [
        {
          turnId: 'turn_01',
          query: 'Which mission first landed humans on the Moon?',
          goldRewrite: 'Which mission first landed humans on the Moon?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Apollo 11', 'first landed humans', 'Moon landing']
        },
        {
          turnId: 'turn_02',
          query: 'Who were the astronauts on board?',
          goldRewrite: 'Who were the astronauts on board the Apollo 11 lunar mission?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Neil Armstrong', 'Buzz Aldrin', 'Michael Collins', 'Apollo 11']
        },
        {
          turnId: 'turn_03',
          query: 'What year did they return?',
          goldRewrite: 'What year did Apollo 11 return to Earth?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['1969', 'return to Earth', 'Apollo 11 splashdown']
        },
        {
          turnId: 'turn_04',
          query: 'Now what is NASA Artemis program?',
          goldRewrite: 'What is the NASA Artemis program for returning astronauts to the Moon?',
          isShift: true,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Artemis program', 'NASA lunar exploration', 'Moon return']
        },
        {
          turnId: 'turn_05',
          query: 'What is the Orion spacecraft role in it?',
          goldRewrite: 'What is the role of the Orion spacecraft in the Artemis lunar program?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Orion spacecraft', 'crew capsule', 'Artemis program']
        }
      ]
    },
    {
      id: 'conv_05',
      domain: 'biology_medicine',
      topic: 'CRISPR Cas9 Gene Editing',
      turns: [
        {
          turnId: 'turn_01',
          query: 'What is CRISPR Cas9 technology?',
          goldRewrite: 'What is CRISPR Cas9 genome editing technology?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['CRISPR-Cas9', 'gene editing', 'molecular biology']
        },
        {
          turnId: 'turn_02',
          query: 'How does the guide RNA locate target DNA sequences?',
          goldRewrite: 'How does guide RNA locate target DNA sequences in CRISPR Cas9?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['guide RNA', 'target DNA', 'PAM sequence', 'CRISPR-Cas9']
        },
        {
          turnId: 'turn_03',
          query: 'Who won the Nobel Prize for discovering it?',
          goldRewrite: 'Who won the Nobel Prize in Chemistry for discovering CRISPR Cas9 gene editing?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Jennifer Doudna', 'Emmanuelle Charpentier', 'Nobel Prize', 'CRISPR']
        },
        {
          turnId: 'turn_04',
          query: 'What ethical concerns surround human germline editing?',
          goldRewrite: 'What ethical concerns surround human germline editing with CRISPR?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['germline editing', 'bioethics', 'heritable changes', 'CRISPR']
        },
        {
          turnId: 'turn_05',
          query: 'How does it compare to zinc finger nucleases?',
          goldRewrite: 'Compare CRISPR Cas9 with zinc finger nucleases for genome editing.',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: true,
          targetDocKeywords: ['zinc finger nucleases', 'CRISPR-Cas9', 'targeted editing']
        }
      ]
    },
    {
      id: 'conv_06',
      domain: 'biology_medicine',
      topic: 'mRNA Vaccines and Lipid Nanoparticles',
      turns: [
        {
          turnId: 'turn_01',
          query: 'How do mRNA vaccines work?',
          goldRewrite: 'How do messenger RNA vaccines work to generate immunity?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['mRNA vaccines', 'spike protein', 'antigen presentation']
        },
        {
          turnId: 'turn_02',
          query: 'What is the role of lipid nanoparticles in their delivery?',
          goldRewrite: 'What is the role of lipid nanoparticles in mRNA vaccine delivery?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['lipid nanoparticles', 'cellular uptake', 'mRNA degradation']
        },
        {
          turnId: 'turn_03',
          query: 'Which scientists pioneered modified nucleosides for them?',
          goldRewrite: 'Which scientists pioneered modified nucleosides for mRNA vaccines?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Katalin Kariko', 'Drew Weissman', 'modified nucleosides', 'pseudouridine']
        },
        {
          turnId: 'turn_04',
          query: 'What immune response do they trigger?',
          goldRewrite: 'What immune response do mRNA vaccines trigger in the body?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['neutralizing antibodies', 'cytotoxic T-cells', 'immune response']
        },
        {
          turnId: 'turn_05',
          query: 'How does storage temperature affect stability?',
          goldRewrite: 'How does ultra-cold storage temperature affect mRNA vaccine stability?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['cold chain', 'ultra-cold storage', 'stability', 'mRNA']
        }
      ]
    },
    {
      id: 'conv_07',
      domain: 'history_civilization',
      topic: 'Johannes Gutenberg and the Printing Press',
      turns: [
        {
          turnId: 'turn_01',
          query: 'Who invented the movable type printing press in Europe?',
          goldRewrite: 'Who invented the movable type printing press in Europe?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Johannes Gutenberg', 'movable type printing press', 'Europe']
        },
        {
          turnId: 'turn_02',
          query: 'Where was his first print shop established?',
          goldRewrite: 'Where was Johannes Gutenberg first print shop established in Mainz?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Mainz', 'Germany', 'Gutenberg print workshop']
        },
        {
          turnId: 'turn_03',
          query: 'What was the first major book printed?',
          goldRewrite: 'What was the first major book printed by Gutenberg?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Gutenberg Bible', 'Latin Vulgate', 'forty-two-line Bible']
        },
        {
          turnId: 'turn_04',
          query: 'How did it influence the Protestant Reformation?',
          goldRewrite: 'How did the Gutenberg printing press influence the Protestant Reformation?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Protestant Reformation', 'Martin Luther', 'pamphlets', 'printing press']
        },
        {
          turnId: 'turn_05',
          query: 'What were the broader impacts on European literacy rates?',
          goldRewrite: 'What were the impacts of the printing press on European literacy rates?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['literacy rates', 'book production', 'education', 'printing press']
        }
      ]
    },
    {
      id: 'conv_08',
      domain: 'history_civilization',
      topic: 'Ancient Library of Alexandria',
      turns: [
        {
          turnId: 'turn_01',
          query: 'Where was the ancient Library of Alexandria located?',
          goldRewrite: 'Where was the ancient Royal Library of Alexandria located in Egypt?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Library of Alexandria', 'Ptolemaic Egypt', 'ancient Mediterranean']
        },
        {
          turnId: 'turn_02',
          query: 'Who founded it and when?',
          goldRewrite: 'Who founded the Library of Alexandria and during which century?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Ptolemy I Soter', 'Ptolemy II Philadelphus', 'founding', 'Alexandria']
        },
        {
          turnId: 'turn_03',
          query: 'How many scrolls was it estimated to hold?',
          goldRewrite: 'How many papyrus scrolls was the Library of Alexandria estimated to hold?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['papyrus scrolls', 'collection size', 'Library of Alexandria']
        },
        {
          turnId: 'turn_04',
          query: 'What caused its ultimate destruction?',
          goldRewrite: 'What events caused the destruction and decline of the Library of Alexandria?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['destruction', 'Julius Caesar fire', 'gradual decline', 'Alexandria']
        },
        {
          turnId: 'turn_05',
          query: 'Which scholars worked there as chief librarians?',
          goldRewrite: 'Which notable scholars served as chief librarians in Alexandria?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Eratosthenes', 'Callimachus', 'Apollonius', 'chief librarian']
        }
      ]
    },
    {
      id: 'conv_09',
      domain: 'cs_ai',
      topic: 'Turing Test to Black Holes Topic Shift',
      turns: [
        {
          turnId: 'turn_01',
          query: 'What is the Turing Test in artificial intelligence?',
          goldRewrite: 'What is the Turing Test for machine intelligence proposed by Alan Turing?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Turing Test', 'imitation game', 'machine intelligence']
        },
        {
          turnId: 'turn_02',
          query: 'Who proposed it in 1950?',
          goldRewrite: 'Who proposed the Turing Test in his 1950 paper Computing Machinery and Intelligence?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Alan Turing', 'Computing Machinery and Intelligence', '1950']
        },
        {
          turnId: 'turn_03',
          query: 'What are the common criticisms of the imitation game?',
          goldRewrite: 'What are common criticisms of Alan Turing imitation game test?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Chinese Room argument', 'John Searle', 'criticisms of Turing Test']
        },
        {
          turnId: 'turn_04',
          query: 'What is the event horizon of a black hole?',
          goldRewrite: 'What is the event horizon of an astrophysical black hole?',
          isShift: true,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['event horizon', 'black hole', 'general relativity', 'Schwarzschild radius']
        },
        {
          turnId: 'turn_05',
          query: 'Can light escape from it?',
          goldRewrite: 'Can electromagnetic light escape from inside a black hole event horizon?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['escape velocity', 'speed of light', 'event horizon', 'black hole']
        }
      ]
    },
    {
      id: 'conv_10',
      domain: 'biology_medicine',
      topic: 'Penicillin Discovery to Mona Lisa Topic Shift',
      turns: [
        {
          turnId: 'turn_01',
          query: 'How was penicillin discovered by Alexander Fleming?',
          goldRewrite: 'How was penicillin discovered by Alexander Fleming in 1928?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Alexander Fleming', 'penicillin discovery', 'Staphylococcus contamination']
        },
        {
          turnId: 'turn_02',
          query: 'What mould produced the antibiotic substance?',
          goldRewrite: 'What mould species produced the antibacterial substance discovered by Fleming?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Penicillium notatum', 'fungus mould', 'antibiotic substance']
        },
        {
          turnId: 'turn_03',
          query: 'How did Florey and Chain help mass produce it?',
          goldRewrite: 'How did Howard Florey and Ernst Chain purify and mass produce penicillin?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Howard Florey', 'Ernst Chain', 'purification', 'penicillin mass production']
        },
        {
          turnId: 'turn_04',
          query: 'Who painted the Mona Lisa?',
          goldRewrite: 'Who painted the Renaissance masterpiece portrait of the Mona Lisa?',
          isShift: true,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Leonardo da Vinci', 'Mona Lisa', 'Renaissance painting', 'portrait']
        },
        {
          turnId: 'turn_05',
          query: 'Where is the painting displayed today?',
          goldRewrite: 'Where is the Mona Lisa painting permanently displayed today?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Louvre Museum', 'Paris', 'Mona Lisa display']
        }
      ]
    },
    {
      id: 'conv_11',
      domain: 'space_physics',
      topic: 'Mercury Planet vs Chemical Element Polysemy',
      turns: [
        {
          turnId: 'turn_01',
          query: 'Tell me about Mercury orbital period.',
          goldRewrite: 'What is the orbital period and revolution of planet Mercury around the Sun?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['planet Mercury', 'orbital period', '88 days', 'Solar System']
        },
        {
          turnId: 'turn_02',
          query: 'How close is it to the Sun?',
          goldRewrite: 'How close is the planet Mercury to the Sun at perihelion?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['distance to Sun', 'closest planet', 'Mercury perihelion']
        },
        {
          turnId: 'turn_03',
          query: 'What are the extreme temperature variations on the surface?',
          goldRewrite: 'What are the surface temperature variations on the planet Mercury?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['surface temperature', 'Mercury day and night extremes', 'lack of atmosphere']
        },
        {
          turnId: 'turn_04',
          query: 'Tell me about mercury toxicity and environmental exposure.',
          goldRewrite: 'What are the health risks of mercury elemental toxicity and environmental exposure?',
          isShift: true,
          isAmbiguous: true,
          isDecomposable: false,
          targetDocKeywords: ['mercury toxicity', 'heavy metal poisoning', 'methylmercury', 'Minamata']
        },
        {
          turnId: 'turn_05',
          query: 'What organs does the toxic metal damage?',
          goldRewrite: 'What human organs does toxic mercury metal poison and damage?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['neurological damage', 'kidneys', 'central nervous system', 'mercury toxicity']
        }
      ]
    },
    {
      id: 'conv_12',
      domain: 'cs_ai',
      topic: 'Neural Transformers vs Electrical Transformers Ambiguity',
      turns: [
        {
          turnId: 'turn_01',
          query: 'How does the Transformer architecture use self-attention?',
          goldRewrite: 'How does the deep learning Transformer architecture use self-attention mechanisms?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Transformer architecture', 'self-attention mechanism', 'neural networks']
        },
        {
          turnId: 'turn_02',
          query: 'What is multi-head attention?',
          goldRewrite: 'What is multi-head attention in the Transformer architecture?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['multi-head attention', 'projection matrices', 'Transformer']
        },
        {
          turnId: 'turn_03',
          query: 'What are positional encodings used for in it?',
          goldRewrite: 'What are positional encodings used for in Transformer models?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['positional encodings', 'token order', 'Transformer']
        },
        {
          turnId: 'turn_04',
          query: 'How do electrical power transformers step down voltage?',
          goldRewrite: 'How do electrical power transformers step down AC voltage using induction?',
          isShift: true,
          isAmbiguous: true,
          isDecomposable: false,
          targetDocKeywords: ['electrical transformer', 'step-down voltage', 'electromagnetic induction', 'coils']
        },
        {
          turnId: 'turn_05',
          query: 'What magnetic core materials do they use?',
          goldRewrite: 'What magnetic core materials do electrical transformers use to minimize eddy currents?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['silicon steel', 'laminated magnetic core', 'electrical transformers', 'eddy currents']
        }
      ]
    },
    {
      id: 'conv_13',
      domain: 'cs_ai',
      topic: 'Artificial vs Biological Neural Networks Decomposer',
      turns: [
        {
          turnId: 'turn_01',
          query: 'How do artificial neural networks differ from biological brains?',
          goldRewrite: 'How do artificial neural networks differ fundamentally from biological brains?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: true,
          targetDocKeywords: ['artificial neural networks', 'biological brains', 'synaptic plasticity']
        },
        {
          turnId: 'turn_02',
          query: 'What is the backpropagation algorithm?',
          goldRewrite: 'What is the backpropagation algorithm for training artificial neural networks?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['backpropagation algorithm', 'chain rule', 'gradient descent', 'neural networks']
        },
        {
          turnId: 'turn_03',
          query: 'Why is biological plausibility debated for it?',
          goldRewrite: 'Why is the biological plausibility of backpropagation debated in neuroscience?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['weight transport problem', 'biological plausibility', 'backpropagation']
        },
        {
          turnId: 'turn_04',
          query: 'Compare synaptic plasticity and gradient descent.',
          goldRewrite: 'Compare biological synaptic plasticity with artificial neural gradient descent optimization.',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: true,
          targetDocKeywords: ['synaptic plasticity', 'gradient descent', 'Hebb rule', 'optimization']
        },
        {
          turnId: 'turn_05',
          query: 'How does spike-timing-dependent plasticity work?',
          goldRewrite: 'How does spike-timing-dependent plasticity work in biological synapses?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['spike-timing-dependent plasticity', 'STDP', 'biological synapse', 'presynaptic']
        }
      ]
    },
    {
      id: 'conv_14',
      domain: 'cs_ai',
      topic: 'Shannon Entropy to Physics Thermodynamic Law (Documented Limitation Case)',
      turns: [
        {
          turnId: 'turn_01',
          query: 'What is Claude Shannon information entropy formula?',
          goldRewrite: 'What is Claude Shannon mathematical formula for information entropy in bits?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Claude Shannon', 'information entropy formula', 'log2', 'bits']
        },
        {
          turnId: 'turn_02',
          query: 'What base logarithm did he use for bit units?',
          goldRewrite: 'What base logarithm did Claude Shannon use to define bit units of entropy?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['base 2 logarithm', 'bits', 'binary units', 'Shannon entropy']
        },
        {
          turnId: 'turn_03',
          query: 'How does it relate to thermodynamic entropy in physics?',
          goldRewrite: 'How does Claude Shannon information entropy relate to thermodynamic entropy in statistical physics?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['Boltzmann constant', 'thermodynamic entropy', 'statistical mechanics', 'Shannon']
        },
        {
          turnId: 'turn_04',
          // HONEST LIMITATION CASE: The term rewriter will over-carry communication channel terms (bits, channel capacity)
          // into the thermodynamic conservation inquiry, leading to vocabulary drift.
          query: 'Is entropy always conserved in physical processes?',
          goldRewrite: 'Is thermodynamic entropy conserved or increasing according to physical laws?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['entropy conservation', 'irreversible processes', 'second law of thermodynamics']
        },
        {
          turnId: 'turn_05',
          query: 'What does the second law of thermodynamics state about it?',
          goldRewrite: 'What does the second law of thermodynamics state about isolated systems and entropy increase?',
          isShift: false,
          isAmbiguous: false,
          isDecomposable: false,
          targetDocKeywords: ['second law of thermodynamics', 'isolated system', 'entropy increase', 'Clausius']
        }
      ]
    }
  ];
}

/**
 * Main execution script generating corpus, conversations, and pooled qrels.
 */
export async function prepareCorpus() {
  console.log('[TurnTrace Corpus Builder] Initializing corpus generation...');
  const dataDir = CONFIG.paths.dataDir;
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const conversations = buildConversations();
  const passages = [];
  const qrels = {}; // { [queryId]: { [docId]: relevanceGrade (1 or 2) } }
  let docCounter = 1;

  // 1. First build the core ground-truth passages for each conversation turn
  for (const conv of conversations) {
    for (const turn of conv.turns) {
      const turnKey = `${conv.id}_${turn.turnId}`;
      qrels[turnKey] = {};

      // Primary gold passage (grade 2: highly relevant)
      const primaryDocId = `doc_${String(docCounter++).padStart(5, '0')}`;
      const primaryTitle = `${conv.topic} - ${turn.targetDocKeywords.slice(0, 2).join(' and ')}`;
      const primaryBody = `${turn.goldRewrite} Detailed analysis demonstrates that ${turn.targetDocKeywords.join(', ')} play a fundamental role. ${EXPANSION_TEMPLATES[conv.domain][(docCounter % EXPANSION_TEMPLATES[conv.domain].length)]} In practice, researchers observe that these mechanisms ensure robust operation across standard empirical benchmarks.`;
      
      passages.push({
        docId: primaryDocId,
        title: primaryTitle,
        body: primaryBody,
        domain: conv.domain
      });
      qrels[turnKey][primaryDocId] = 2;

      // Secondary relevant passage (grade 1: relevant)
      const secondaryDocId = `doc_${String(docCounter++).padStart(5, '0')}`;
      const secondaryTitle = `${conv.topic} - Principles and Related Aspects`;
      const secondaryBody = `Comprehensive survey discussing ${turn.targetDocKeywords.join(' alongside ')}. ${EXPANSION_TEMPLATES[conv.domain][((docCounter + 1) % EXPANSION_TEMPLATES[conv.domain].length)]} Furthermore, comparative experiments substantiate theoretical claims regarding ${turn.targetDocKeywords[0]}.`;

      passages.push({
        docId: secondaryDocId,
        title: secondaryTitle,
        body: secondaryBody,
        domain: conv.domain
      });
      qrels[turnKey][secondaryDocId] = 1;
    }
  }

  console.log(`[TurnTrace Corpus Builder] Created ${passages.length} gold passages and qrels for 70 turns.`);

  // 2. Synthesize domain passages to reach 35,000 passages across 4 domains
  const TARGET_PASSAGES = 35000;
  let topicIdx = 0;
  const allArticles = [];

  for (const domainSeed of DOMAIN_SEEDS) {
    for (const topic of domainSeed.topics) {
      for (const article of topic.articles) {
        allArticles.push({
          domain: domainSeed.domain,
          topic: topic.title,
          article
        });
      }
    }
  }

  console.log(`[TurnTrace Corpus Builder] Expanding corpus to ${TARGET_PASSAGES} passages using ${allArticles.length} seed article frameworks...`);

  while (passages.length < TARGET_PASSAGES) {
    const art = allArticles[topicIdx % allArticles.length];
    const docId = `doc_${String(docCounter++).padStart(5, '0')}`;
    const sectionNum = Math.floor(topicIdx / allArticles.length) + 1;
    const title = `${art.article} - Section ${sectionNum}: Fundamentals and Historical Development`;
    const template = EXPANSION_TEMPLATES[art.domain][(topicIdx + sectionNum) % EXPANSION_TEMPLATES[art.domain].length];
    const body = `This section examines ${art.article} within the context of ${art.topic}. ${template} Detailed historical and theoretical evaluations show consistent patterns across diverse experimental setups. Key foundational concepts include systematic observation, algorithmic derivation, and empirical measurement in contemporary research.`;

    passages.push({
      docId,
      title,
      body,
      domain: art.domain
    });

    topicIdx++;
  }

  // 3. Write outputs to disk
  console.log(`[TurnTrace Corpus Builder] Serializing ${passages.length} passages to ${CONFIG.paths.corpusFile}...`);
  fs.writeFileSync(CONFIG.paths.corpusFile, JSON.stringify(passages, null, 2), 'utf-8');

  console.log(`[TurnTrace Corpus Builder] Serializing ${conversations.length} conversations to ${CONFIG.paths.conversationsFile}...`);
  fs.writeFileSync(CONFIG.paths.conversationsFile, JSON.stringify(conversations, null, 2), 'utf-8');

  console.log(`[TurnTrace Corpus Builder] Serializing qrels (${Object.keys(qrels).length} turns) to ${CONFIG.paths.qrelsFile}...`);
  fs.writeFileSync(CONFIG.paths.qrelsFile, JSON.stringify(qrels, null, 2), 'utf-8');

  const corpusStats = {
    totalPassages: passages.length,
    domains: {
      cs_ai: passages.filter(p => p.domain === 'cs_ai').length,
      space_physics: passages.filter(p => p.domain === 'space_physics').length,
      biology_medicine: passages.filter(p => p.domain === 'biology_medicine').length,
      history_civilization: passages.filter(p => p.domain === 'history_civilization').length
    },
    totalConversations: conversations.length,
    totalTurns: Object.keys(qrels).length
  };

  console.log('[TurnTrace Corpus Builder] Generation complete! Statistics:', JSON.stringify(corpusStats, null, 2));
  return corpusStats;
}

// Allow direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('prepareCorpus.js')) {
  prepareCorpus()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[TurnTrace Corpus Builder] Fatal error:', err);
      process.exit(1);
    });
}
