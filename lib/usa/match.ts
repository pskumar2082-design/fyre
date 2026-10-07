// Source listing (BFILMY USA id, or BFILMY India title) -> Fyre movie.
// Fyre's own catalog (fyre_tracked_movie) is what a listing can attach to;
// a listing with no match stays unmatched until an admin matches it,
// creates a Fyre movie from it, or rejects it. HIGH confidence (auto)
// needs all of:
//   - the listing's title key equals the key of one of the movie's known
//     titles (canonical, MovieMint, India, confirmed aliases, FYRE_ALIASES)
//   - exactly one Fyre movie has that key, and exactly one listing does
//   - the listing's first date is within -10/+30 days of the movie's Day 1
// Anything close but not certain -> needs_review (admin). Never guessed.
import { FYRE_ALIASES, titleKey } from '@/lib/bfilmy/normalize';

export function usTitleKey(title: string): string {
  return titleKey(
    String(title)
      .replace(/\s*\((19|20)\d{2}\)\s*$/, '')
      .replace(/&/g, ' and ')
  );
}

export type TrackedMovie = { movieId: string; slug: string; titles: string[]; dayOne: string | null; languages?: string[] };
export type UsIdInfo<I extends string | number = number> = { sourceMovieId: I; title: string; firstDate: string | null; languages?: string[] };

// Two language lists that share no language (unknown/empty never conflicts).
export function languagesConflict(a: string[] | undefined, b: string[] | undefined): boolean {
  const norm = (x: string[] | undefined) => new Set((x ?? []).map((l) => l.trim().toLowerCase()).filter((l) => l && l !== 'unknown'));
  const A = norm(a);
  const B = norm(b);
  if (!A.size || !B.size) return false;
  for (const l of A) if (B.has(l)) return false;
  return true;
}
export type Candidate = { movieId: string; slug: string; reason: string; dateGap: number | null };
export type MatchDecision<I extends string | number = number> = {
  sourceMovieId: I;
  status: 'matched' | 'needs_review' | 'unmatched';
  movieId: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  method: string;
  note: string;
  candidates: Candidate[];
};

function aliasKeys(title: string): string[] {
  const k = usTitleKey(title);
  const out = new Set([k]);
  for (const [canon, variants] of Object.entries(FYRE_ALIASES)) {
    const all = [canon, ...variants].map(usTitleKey);
    if (all.includes(k)) all.forEach((x) => out.add(x));
  }
  return [...out];
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function similar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const long = Math.max(a.length, b.length);
  if (Math.min(a.length, b.length) >= 6 && (a.startsWith(b) || b.startsWith(a))) return true;
  return long >= 5 && 1 - levenshtein(a, b) / long >= 0.8;
}

const gapDays = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

// `taken`: Fyre movies that already have a matched USA id (a second id for
// the same movie is a split listing -> admin review, never automatic).
export const NO_MATCH_NOTE = 'No existing Fyre movie match';

export function matchUsIds<I extends string | number = number>(ids: UsIdInfo<I>[], movies: TrackedMovie[], taken: Map<string, I[]> = new Map(), territory: 'USA' | 'India' = 'USA'): MatchDecision<I>[] {
  const idWord = territory === 'USA' ? 'USA id' : 'India listing';
  const dateWord = territory === 'USA' ? 'first US date' : 'first India date';
  const movieKeys = movies.map((m) => ({ m, keys: new Set(m.titles.flatMap(aliasKeys)) }));
  const idKey = new Map(ids.map((i) => [i.sourceMovieId, usTitleKey(i.title)]));
  // How many USA ids share each exact key (split listings under one name).
  const idsPerKey = new Map<string, number>(); // key -> listing count
  for (const k of idKey.values()) idsPerKey.set(k, (idsPerKey.get(k) ?? 0) + 1);

  return ids.map((info) => {
    const key = idKey.get(info.sourceMovieId)!;
    const exact = movieKeys.filter((x) => x.keys.has(key)).map((x) => x.m);
    const fuzzy = movieKeys.filter((x) => !x.keys.has(key) && [...x.keys].some((k) => similar(k, key))).map((x) => x.m);
    const cand = (m: TrackedMovie, reason: string): Candidate => ({
      movieId: m.movieId,
      slug: m.slug,
      reason,
      dateGap: info.firstDate && m.dayOne ? gapDays(info.firstDate, m.dayOne) : null
    });
    const candidates = [...exact.map((m) => cand(m, 'same title')), ...fuzzy.map((m) => cand(m, 'similar title'))];
    const base = { sourceMovieId: info.sourceMovieId, candidates };

    if (exact.length === 1) {
      const c = candidates[0];
      const inWindow = c.dateGap != null && c.dateGap >= -10 && c.dateGap <= 30;
      const other = (taken.get(c.movieId) ?? []).filter((x) => x !== info.sourceMovieId);
      if (other.length) return { ...base, status: 'needs_review', movieId: null, confidence: 'medium', method: 'title', note: `Same title, but ${idWord} ${other.join(', ')} is already matched to this movie (split listing?)` };
      const m = exact[0];
      if (languagesConflict(info.languages, m.languages)) return { ...base, status: 'needs_review', movieId: null, confidence: 'medium', method: 'title', note: `Same title but different languages (${(info.languages ?? []).join(', ')} vs ${(m.languages ?? []).join(', ')})` };
      if (inWindow && (idsPerKey.get(key) ?? 0) === 1 && fuzzy.length === 0) {
        return { ...base, status: 'matched', movieId: c.movieId, confidence: 'high', method: 'title+date', note: `Same title; ${dateWord} ${c.dateGap! >= 0 ? '+' : ''}${c.dateGap} days from Day 1` };
      }
      const why = c.dateGap == null ? 'release date unknown' : !inWindow ? `${dateWord} ${c.dateGap} days from Day 1` : (idsPerKey.get(key) ?? 0) > 1 ? `more than one ${territory} listing with this title` : 'another similar title exists';
      return { ...base, status: 'needs_review', movieId: null, confidence: 'medium', method: 'title', note: `Same title but ${why}` };
    }
    if (exact.length > 1) return { ...base, status: 'needs_review', movieId: null, confidence: 'low', method: 'title', note: 'Title matches more than one Fyre movie' };
    if (fuzzy.length > 0) return { ...base, status: 'needs_review', movieId: null, confidence: 'low', method: 'similar-title', note: 'Similar title only (spelling variant?)' };
    return { ...base, status: 'unmatched', movieId: null, confidence: null, method: 'none', note: NO_MATCH_NOTE };
  });
}
