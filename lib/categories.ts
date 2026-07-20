// Category helpers — pure, safe on client + server.
//
// Categories are free text, which lets "dining", "Dining", and "dinning" split
// into three. These helpers keep them in line: normalize on save, and surface
// near-duplicates so the user can catch typos before they diverge.

/** Collapses internal whitespace and trims. Display-preserving otherwise. */
export function cleanCategory(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Canonicalizes a typed category against ones already in use: an exact
 * case-insensitive match reuses the EXISTING spelling (so "dining" becomes the
 * "Dining" you already have), otherwise the cleaned input is kept as typed.
 */
export function normalizeCategory(input: string, existing: string[]): string {
  const cleaned = cleanCategory(input);
  if (!cleaned) return cleaned;
  const match = existing.find(
    (e) => e.toLowerCase() === cleaned.toLowerCase(),
  );
  return match ?? cleaned;
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Finds an existing category that's a near-duplicate of the input — close
 * enough to likely be a typo, but not an exact match. Returns null if none.
 * Threshold scales with length so short words don't over-trigger.
 */
export function suggestExistingCategory(
  input: string,
  existing: string[],
): string | null {
  const cleaned = cleanCategory(input).toLowerCase();
  if (cleaned.length < 3) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of existing) {
    const c = candidate.toLowerCase();
    if (c === cleaned) return null; // exact match — nothing to suggest
    const distance = levenshtein(cleaned, c);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  if (best === null) return null;
  const threshold = cleaned.length <= 4 ? 1 : 2;
  return bestDistance <= threshold ? best : null;
}
