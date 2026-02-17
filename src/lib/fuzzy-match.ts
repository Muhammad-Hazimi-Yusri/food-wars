/**
 * Lightweight string similarity using bigram Dice coefficient.
 * No external dependencies — used server-side for matching AI output
 * to existing products, units, stores, and locations.
 */

function bigrams(str: string): Set<string> {
  const s = str.toLowerCase();
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    set.add(s.slice(i, i + 2));
  }
  return set;
}

/**
 * Compute a similarity score between two strings (0–1).
 */
export function similarityScore(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();

  if (la === lb) return 1.0;
  if (la.length === 0 || lb.length === 0) return 0;

  // One contains the other
  if (la.includes(lb) || lb.includes(la)) return 0.8;

  // Bigram Dice coefficient
  const biA = bigrams(la);
  const biB = bigrams(lb);
  if (biA.size === 0 || biB.size === 0) return 0;

  let intersection = 0;
  for (const bg of biA) {
    if (biB.has(bg)) intersection++;
  }

  return (2 * intersection) / (biA.size + biB.size);
}

/**
 * Find the best match from a list of candidates.
 * Returns the matched item and score, or null if below threshold.
 */
export function findBestMatch<T>(
  query: string,
  candidates: T[],
  getName: (item: T) => string,
  threshold: number = 0.4,
): { item: T; score: number } | null {
  if (!query.trim() || candidates.length === 0) return null;

  let best: { item: T; score: number } | null = null;

  for (const candidate of candidates) {
    const name = getName(candidate);
    const score = similarityScore(query, name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { item: candidate, score };
    }
  }

  return best;
}
