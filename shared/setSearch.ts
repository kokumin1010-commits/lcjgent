const SET_SEARCH_SEPARATORS = /[\s\u3000/／・･,，、+＋|｜_＿\-‐‑–—]+/gu;

export function normalizeSetSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(SET_SEARCH_SEPARATORS, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function compactSetSearchText(value: unknown): string {
  return normalizeSetSearchText(value).replace(/\s+/gu, "");
}

export function tokenizeSetSearchKeyword(value: unknown): string[] {
  return [...new Set(normalizeSetSearchText(value).split(" ").map(compactSetSearchText).filter(Boolean))];
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  const result: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
}

function fuzzyTokenScore(token: string, candidate: string): number {
  if (!token || !candidate) return 0;
  if (candidate.includes(token)) return token.length === candidate.length ? 120 : 100;
  if (token.length < 4) return 0;

  const tokenBigrams = bigrams(token);
  const candidateBigrams = new Set(bigrams(candidate));
  const matchedBigrams = tokenBigrams.filter(pair => candidateBigrams.has(pair)).length;
  const coverage = tokenBigrams.length > 0 ? matchedBigrams / tokenBigrams.length : 0;
  return coverage >= 0.6 ? Math.round(coverage * 80) : 0;
}

export function scoreSetSearchMatch(keyword: unknown, fields: unknown[]): number {
  const tokens = tokenizeSetSearchKeyword(keyword);
  if (tokens.length === 0) return 0;
  const candidates = fields.map(compactSetSearchText).filter(Boolean);
  if (candidates.length === 0) return 0;

  let totalScore = 0;
  for (const token of tokens) {
    const bestScore = candidates.reduce(
      (best, candidate) => Math.max(best, fuzzyTokenScore(token, candidate)),
      0,
    );
    if (bestScore === 0) return 0;
    totalScore += bestScore;
  }
  return totalScore;
}
