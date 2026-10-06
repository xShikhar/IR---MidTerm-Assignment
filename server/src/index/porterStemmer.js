/**
 * @file server/src/index/porterStemmer.js
 * @description The Porter Stemming Algorithm (Martin Porter, 1980).
 * Implements standard morphological normalization through suffix stripping
 * across 5 rule-based transformation steps:
 *   - Step 1a: Plural nouns and third person singular verb forms (sses -> ss, ies -> i, s -> '')
 *   - Step 1b: Past tense and progressive participle endings (eed, ed, ing)
 *   - Step 1c: Y-replacement (y -> i when preceded by a consonant)
 *   - Step 2: Derivational suffixes on complex stems (ational, tional, enci, anci, etc.)
 *   - Step 3: Further derivational suffixes (icate, ative, alize, iciti, ical, ful, ness)
 *   - Step 4: Removal of inflectional/derivational suffixes (al, ance, ence, er, ic, able, etc.)
 *   - Step 5a & 5b: Final cleanup of trailing 'e' and double consonants (e -> '', ll -> l)
 */

// Helper to determine whether character at index i is a consonant
function isConsonant(str, i) {
  const ch = str.charAt(i);
  if (ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u') {
    return false;
  }
  if (ch === 'y') {
    if (i === 0) return true;
    return !isConsonant(str, i - 1);
  }
  return true;
}

// Measure m: the number of consonant sequences between vowels [C](VC)^m[V]
function getMeasure(str) {
  let m = 0;
  let i = 0;
  const len = str.length;

  while (i < len && isConsonant(str, i)) i++;
  if (i >= len) return 0;

  while (i < len) {
    while (i < len && !isConsonant(str, i)) i++;
    if (i >= len) break;
    while (i < len && isConsonant(str, i)) i++;
    m++;
  }
  return m;
}

// Check if stem contains at least one vowel
function containsVowel(str) {
  for (let i = 0; i < str.length; i++) {
    if (!isConsonant(str, i)) return true;
  }
  return false;
}

// Check if word ends with a double consonant
function endsWithDoubleConsonant(str) {
  const len = str.length;
  if (len < 2) return false;
  return (
    str.charAt(len - 1) === str.charAt(len - 2) &&
    isConsonant(str, len - 1)
  );
}

// Check if word ends with consonant-vowel-consonant (*o condition), where second consonant is not w, x, y
function endsWithCVC(str) {
  const len = str.length;
  if (len < 3) return false;
  const c1 = isConsonant(str, len - 3);
  const v = !isConsonant(str, len - 2);
  const c2 = isConsonant(str, len - 1);
  const lastCh = str.charAt(len - 1);
  return c1 && v && c2 && lastCh !== 'w' && lastCh !== 'x' && lastCh !== 'y';
}

/**
 * Applies Martin Porter's stemming algorithm to an input word.
 *
 * @param {string} word - Lowercase word to stem
 * @returns {string} Stemmed morphological root
 */
export function stem(word) {
  if (!word || typeof word !== 'string' || word.length < 3) {
    return word || '';
  }

  let w = word.toLowerCase();

  // Step 1a
  if (w.endsWith('sses')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ies')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ss')) {
    // leave as ss
  } else if (w.endsWith('s')) {
    w = w.slice(0, -1);
  }

  // Step 1b
  let extraStep1b = false;
  if (w.endsWith('eed')) {
    const stemPart = w.slice(0, -3);
    if (getMeasure(stemPart) > 0) {
      w = w.slice(0, -1);
    }
  } else if (w.endsWith('ed')) {
    const stemPart = w.slice(0, -2);
    if (containsVowel(stemPart)) {
      w = stemPart;
      extraStep1b = true;
    }
  } else if (w.endsWith('ing')) {
    const stemPart = w.slice(0, -3);
    if (containsVowel(stemPart)) {
      w = stemPart;
      extraStep1b = true;
    }
  }

  if (extraStep1b) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) {
      w += 'e';
    } else if (
      endsWithDoubleConsonant(w) &&
      !w.endsWith('l') &&
      !w.endsWith('s') &&
      !w.endsWith('z')
    ) {
      w = w.slice(0, -1);
    } else if (getMeasure(w) === 1 && endsWithCVC(w)) {
      w += 'e';
    }
  }

  // Step 1c
  if (w.endsWith('y')) {
    const stemPart = w.slice(0, -1);
    if (containsVowel(stemPart)) {
      w = stemPart + 'i';
    }
  }

  // Step 2
  const step2Suffixes = [
    ['ational', 'ate'],
    ['tional', 'tion'],
    ['enci', 'ence'],
    ['anci', 'ance'],
    ['izer', 'ize'],
    ['abli', 'able'],
    ['alli', 'al'],
    ['entli', 'ent'],
    ['eli', 'e'],
    ['ousli', 'ous'],
    ['ization', 'ize'],
    ['ation', 'ate'],
    ['ator', 'ate'],
    ['alism', 'al'],
    ['iveness', 'ive'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['aliti', 'al'],
    ['iviti', 'ive'],
    ['biliti', 'ble']
  ];

  for (const [suff, repl] of step2Suffixes) {
    if (w.endsWith(suff)) {
      const stemPart = w.slice(0, -suff.length);
      if (getMeasure(stemPart) > 0) {
        w = stemPart + repl;
      }
      break;
    }
  }

  // Step 3
  const step3Suffixes = [
    ['icate', 'ic'],
    ['ative', ''],
    ['alize', 'al'],
    ['iciti', 'ic'],
    ['ical', 'ic'],
    ['ful', ''],
    ['ness', '']
  ];

  for (const [suff, repl] of step3Suffixes) {
    if (w.endsWith(suff)) {
      const stemPart = w.slice(0, -suff.length);
      if (getMeasure(stemPart) > 0) {
        w = stemPart + repl;
      }
      break;
    }
  }

  // Step 4
  const step4Suffixes = [
    'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant',
    'ement', 'ment', 'ent', 'ou', 'ism', 'ate', 'iti', 'ous',
    'ive', 'ize'
  ];

  let matchedStep4 = false;
  for (const suff of step4Suffixes) {
    if (w.endsWith(suff)) {
      const stemPart = w.slice(0, -suff.length);
      if (getMeasure(stemPart) > 1) {
        w = stemPart;
      }
      matchedStep4 = true;
      break;
    }
  }

  if (!matchedStep4 && (w.endsWith('sion') || w.endsWith('tion'))) {
    const stemPart = w.slice(0, -3);
    if (getMeasure(stemPart) > 1) {
      w = stemPart;
    }
  }

  // Step 5a
  if (w.endsWith('e')) {
    const stemPart = w.slice(0, -1);
    const m = getMeasure(stemPart);
    if (m > 1 || (m === 1 && !endsWithCVC(stemPart))) {
      w = stemPart;
    }
  }

  // Step 5b
  if (getMeasure(w) > 1 && endsWithDoubleConsonant(w) && w.endsWith('l')) {
    w = w.slice(0, -1);
  }

  return w;
}
