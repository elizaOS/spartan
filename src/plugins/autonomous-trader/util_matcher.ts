
// non-llm fuzzer choice matcher

// Jaro-Winkler similarity algorithm
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.max(len1, len2) / 2 - 1;

  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (matches2[j] || s1[i] !== s2[j]) continue;
      matches1[i] = matches2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;

  // Winkler modification
  let prefix = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + (0.1 * prefix * (1.0 - jaro));
}

// Cosine similarity using n-grams
function cosineSimilarity(s1: string, s2: string, n: number = 2): number {
  function getNGrams(str: string, n: number): Set<string> {
    const ngrams = new Set<string>();
    for (let i = 0; i <= str.length - n; i++) {
      ngrams.add(str.substring(i, i + n));
    }
    return ngrams;
  }

  const ngrams1 = getNGrams(s1, n);
  const ngrams2 = getNGrams(s2, n);

  const intersection = new Set(Array.from(ngrams1).filter(x => ngrams2.has(x)));
  const union = new Set([...Array.from(ngrams1), ...Array.from(ngrams2)]);

  if (union.size === 0) return 0;
  return intersection.size / Math.sqrt(ngrams1.size * ngrams2.size);
}

// Jaccard similarity
function jaccardSimilarity(s1: string, s2: string): number {
  const set1 = new Set<string>(s1.split(''));
  const set2 = new Set<string>(s2.split(''));

  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  return intersection.size / union.size;
}

// Dice coefficient (Sørensen-Dice)
function diceCoefficient(s1: string, s2: string): number {
  function getBigrams(str: string): string[] {
    const bigrams: string[] = [];
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
  }

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  if (bigrams1.length === 0 && bigrams2.length === 0) return 1;
  if (bigrams1.length === 0 || bigrams2.length === 0) return 0;

  const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));
  return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
}

// Metaphone algorithm (improved phonetic matching)
function metaphone(word: string): string {
  const vowels = 'AEIOU';
  let metaph = '';
  let current = 0;
  const original = word.toUpperCase();
  const length = original.length;

  if (length === 0) return '';

  // Initial transformations
  if (original.match(/^(PN|KN|GN|AE|WR)/)) {
    current = 1;
  }

  if (original[0] === 'X') {
    metaph += 'S';
    current = 1;
  }

  while (current < length) {
    const c = original[current];

    switch (c) {
      case 'B':
        if (current === length - 1 && original[current - 1] === 'M') {
          break;
        }
        metaph += 'B';
        break;
      case 'C':
        if (current > 0 && original[current - 1] === 'S' && 'EIY'.includes(original[current + 1])) {
          break;
        }
        if ('IA'.includes(original.substring(current + 1, current + 3))) {
          metaph += 'X';
        } else if ('EIY'.includes(original[current + 1])) {
          metaph += 'S';
        } else if (original[current + 1] === 'H') {
          metaph += ((current === 0 && !vowels.includes(original[current + 2])) ||
            original[current - 1] === 'S') ? 'K' : 'X';
          current++;
        } else {
          metaph += 'K';
        }
        break;
      case 'D':
        if (original[current + 1] === 'G' && 'EIY'.includes(original[current + 2])) {
          metaph += 'J';
          current += 2;
        } else {
          metaph += 'T';
        }
        break;
      case 'F':
        metaph += 'F';
        break;
      case 'G':
        if (original[current + 1] === 'H' && !vowels.includes(original[current + 2])) {
          break;
        }
        if (original[current + 1] === 'N' && current === length - 2) {
          break;
        }
        if ('EIY'.includes(original[current + 1])) {
          metaph += 'J';
        } else {
          metaph += 'K';
        }
        break;
      case 'H':
        if (current === 0 || vowels.includes(original[current - 1])) {
          if (vowels.includes(original[current + 1])) {
            metaph += 'H';
          }
        }
        break;
      case 'J':
        metaph += 'J';
        break;
      case 'K':
        if (current === 0 || original[current - 1] !== 'C') {
          metaph += 'K';
        }
        break;
      case 'L':
        metaph += 'L';
        break;
      case 'M':
        metaph += 'M';
        break;
      case 'N':
        metaph += 'N';
        break;
      case 'P':
        if (original[current + 1] === 'H') {
          metaph += 'F';
          current++;
        } else {
          metaph += 'P';
        }
        break;
      case 'Q':
        metaph += 'K';
        break;
      case 'R':
        metaph += 'R';
        break;
      case 'S':
        if ('EIY'.includes(original[current + 1])) {
          metaph += 'X';
        } else if (original[current + 1] === 'H') {
          metaph += 'X';
          current++;
        } else {
          metaph += 'S';
        }
        break;
      case 'T':
        if (original.substring(current, current + 3) === 'TIA' ||
          original.substring(current, current + 3) === 'TIO') {
          metaph += 'X';
        } else if (original[current + 1] === 'H') {
          metaph += '0';
          current++;
        } else {
          metaph += 'T';
        }
        break;
      case 'V':
        metaph += 'F';
        break;
      case 'W':
        if (vowels.includes(original[current + 1])) {
          metaph += 'W';
        }
        break;
      case 'X':
        metaph += 'KS';
        break;
      case 'Y':
        if (vowels.includes(original[current + 1])) {
          metaph += 'Y';
        }
        break;
      case 'Z':
        metaph += 'S';
        break;
      default:
        if (vowels.includes(c) && current === 0) {
          metaph += c;
        }
        break;
    }
    current++;
  }

  return metaph;
}

// Advanced fuzzy matching with weighted scoring
function advancedFuzzyMatch(input: string, target: string): number {
  const inputLower = input.toLowerCase();
  const targetLower = target.toLowerCase();

  // Calculate multiple similarity metrics
  const jaroScore = jaroWinkler(inputLower, targetLower);
  const cosineScore = cosineSimilarity(inputLower, targetLower);
  const jaccardScore = jaccardSimilarity(inputLower, targetLower);
  const diceScore = diceCoefficient(inputLower, targetLower);

  // Phonetic matching
  const metaphoneMatch = metaphone(input) === metaphone(target) ? 1 : 0;

  // Weighted composite score
  const compositeScore = (
    jaroScore * 0.3 +
    cosineScore * 0.25 +
    jaccardScore * 0.2 +
    diceScore * 0.15 +
    metaphoneMatch * 0.1
  );

  return compositeScore;
}

// Token-based matching for multi-word strings
function tokenBasedMatch(input: string, target: string): number {
  const inputTokens = input.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const targetTokens = target.toLowerCase().split(/\s+/).filter(t => t.length > 0);

  if (inputTokens.length === 0 || targetTokens.length === 0) return 0;

  let totalScore = 0;
  let matchedTokens = 0;

  for (const inputToken of inputTokens) {
    let bestTokenScore = 0;

    for (const targetToken of targetTokens) {
      const score = advancedFuzzyMatch(inputToken, targetToken);
      bestTokenScore = Math.max(bestTokenScore, score);
    }

    if (bestTokenScore > 0.5) {
      totalScore += bestTokenScore;
      matchedTokens++;
    }
  }

  return matchedTokens > 0 ? totalScore / Math.max(inputTokens.length, targetTokens.length) : 0;
}

// Main matching function
export function matchOption(input: string | null | undefined, list: string[]): string | null {

  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimInput = input.trim();

  // Direct match
  for (const strategy of list) {
    if (trimInput.toLowerCase() === strategy.toLowerCase()) {
      return strategy;
    }
  }

  // Advanced fuzzy matching
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const strategy of list) {
    // Full string comparison
    const fullStringScore = advancedFuzzyMatch(trimInput, strategy);

    // Token-based comparison
    const tokenScore = tokenBasedMatch(trimInput, strategy);

    // Combined score with slight preference for token matching
    const combinedScore = Math.max(fullStringScore, tokenScore * 0.9);

    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestMatch = strategy;
    }
  }

  // Adaptive threshold based on input length
  const baseThreshold = 0.6;
  const lengthAdjustment = Math.min(0.2, trimInput.length * 0.01);
  const threshold = baseThreshold - lengthAdjustment;

  return bestScore >= threshold ? bestMatch : null;
}
