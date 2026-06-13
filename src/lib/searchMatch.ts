/**
 * Shared admin/search matching helper.
 *
 * Goals:
 *  - Case-insensitive
 *  - Diacritic-insensitive ("Pokémon" matches "pokemon")
 *  - Punctuation-insensitive ("spider-man" matches "spiderman")
 *  - Multi-token AND ("jackson michael" matches "Michael Jackson")
 *  - Forgiving of small typos for longer tokens (Levenshtein ≤ 1 on words ≥ 5 chars)
 */

const normalize = (input: unknown): string => {
  if (input === null || input === undefined) return "";
  return String(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// Tiny Levenshtein distance with an early-exit cap (avoids quadratic blow-up on long strings).
const levenshteinCapped = (a: string, b: string, cap: number): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

/**
 * Returns true if every token in `query` matches somewhere in `fields`.
 * Empty/whitespace queries always match.
 */
export const matchesSearch = (query: string, ...fields: unknown[]): boolean => {
  const q = normalize(query);
  if (!q) return true;

  const haystack = fields.map(normalize).filter(Boolean).join(" ");
  if (!haystack) return false;

  const tokens = q.split(" ").filter(Boolean);
  const words = haystack.split(" ");

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    // Fuzzy fallback: allow 1 typo on tokens ≥ 5 chars vs any word in haystack.
    if (token.length < 5) return false;
    return words.some((w) => levenshteinCapped(token, w, 1) <= 1);
  });
};
