// USA source movie id -> Fyre movie. MovieMint decides which movies exist;
// a USA id is only ever attached to one of those. HIGH confidence (auto)
// needs all of:
//   - the USA title key equals the key of the movie's MovieMint title,
//     Fyre (India) title or one of its FYRE_ALIASES spellings
//   - exactly one tracked movie has that key, and exactly one USA id does
//   - the USA id's first date is within -10/+30 days of the movie's Day 1
// Anything close but not certain -> needs_review (admin). Never guessed.
import { FYRE_ALIASES, titleKey } from '@/lib/bfilmy/normalize';

export function usTitleKey(title: string): string {
  return titleKey(
    String(title)
      .replace(/\s*\((19|20)\d{2}\)\s*$/, '')
      .replace(/&/g, ' and ')
  );
}

export type TrackedMovie = { movieId: string; slug: string; titles: string[]; dayOne: string | null };
export type UsIdInfo = { sourceMovieId: number; title: string; firstDate: string | null };
export type Candidate = { movieId: string; slug: string; reason: string; dateGap: number | null };
export type MatchDecision = {
  sourceMovieId: number;
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
export function matchUsIds(ids: UsIdInfo[], movies: TrackedMovie[], taken: Map<string, number[]> = new Map()): MatchDecision[] {
  const movieKeys = movies.map((m) => ({ m, keys: new Set(m.titles.flatMap(aliasKeys)) }));
  const idKey = new Map(ids.map((i) => [i.sourceMovieId, usTitleKey(i.title)]));
  // How many USA ids share each exact key (split listings under one name).
  const idsPerKey = new Map<string, number>();
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
      if (other.length) return { ...base, status: 'needs_review', movieId: null, confidence: 'medium', method: 'title', note: `Same title, but USA id ${other.join(', ')} is already matched to this movie (split listing?)` };
      if (inWindow && (idsPerKey.get(key) ?? 0) === 1 && fuzzy.length === 0) {
        return { ...base, status: 'matched', movieId: c.movieId, confidence: 'high', method: 'title+date', note: `Same title; first US date ${c.dateGap! >= 0 ? '+' : ''}${c.dateGap} days from Day 1` };
      }
      const why = c.dateGap == null ? 'release date unknown' : !inWindow ? `first US date ${c.dateGap} days from Day 1` : (idsPerKey.get(key) ?? 0) > 1 ? 'more than one USA listing with this title' : 'another similar title exists';
      return { ...base, status: 'needs_review', movieId: null, confidence: 'medium', method: 'title', note: `Same title but ${why}` };
    }
    if (exact.length > 1) return { ...base, status: 'needs_review', movieId: null, confidence: 'low', method: 'title', note: 'Title matches more than one tracked movie' };
    if (fuzzy.length > 0) return { ...base, status: 'needs_review', movieId: null, confidence: 'low', method: 'similar-title', note: 'Similar title only (spelling variant?)' };
    return { ...base, status: 'unmatched', movieId: null, confidence: null, method: 'none', note: 'Not a MovieMint-tracked movie' };
  });
}
