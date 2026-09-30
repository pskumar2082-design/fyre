// MovieMint movie -> BFILMY movie matching. Pure (no I/O), so every rule is
// unit-tested. A match is automatic only when it is unambiguous; anything
// else goes to an admin as NEEDS REVIEW with the candidates found.
import { canonicalTitle, titleKey } from '@/lib/bfilmy/normalize';
import type { MovieMintMovie } from './catalog';

export type BfCandidate = {
  slug: string;
  title: string;
  languages: string[];
  formats: string[];
  releaseDate: string | null; // Fyre's computed Day 1 (bf_movie.release_date)
  firstDate: string | null; // first box-office date
  lastDate: string | null;
  carriedOver: boolean; // already running on 1 Jan 2025
  seenOn?: string[]; // dates it appears in BFILMY files checked for this match
};

export type MatchResult = {
  status: 'matched' | 'needs_review' | 'unmatched';
  confidence: 'high' | 'medium' | 'low' | 'ambiguous' | null;
  slug: string | null;
  note: string | null;
  candidates: (BfCandidate & { titleMatch: 'exact' | 'loose'; dateGap: number | null; languageOk: boolean | null })[];
};

export function stripYear(title: string): string {
  return title.replace(/\s*\((19|20)\d\d\)\s*$/, '').trim();
}

export function looseKey(title: string): string {
  return titleKey(stripYear(title).replace(/&/g, ' and ').replace(/\bpart\b/gi, ''));
}

// "&" and "and" never distinguish two films, so they compare equal.
export function exactKey(title: string, aliasMap: Map<string, string>): string {
  return titleKey(canonicalTitle(stripYear(title), aliasMap).replace(/&/g, ' and '));
}

function dayGap(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

// How far MovieMint's release date is from the candidate's own release /
// first show / any date it was seen on (smallest wins).
function releaseGap(mm: MovieMintMovie, c: BfCandidate): number | null {
  if (!mm.releaseDate) return null;
  const dates = [c.releaseDate, c.firstDate, ...(c.seenOn ?? [])].filter((d): d is string => !!d);
  if (!dates.length) return null;
  return Math.min(...dates.map((d) => dayGap(mm.releaseDate!, d)));
}

export function matchMovie(mm: MovieMintMovie, pool: BfCandidate[], aliasMap: Map<string, string>): MatchResult {
  const ek = exactKey(mm.title, aliasMap);
  const lk = looseKey(mm.title);
  const exact = pool.filter((c) => exactKey(c.title, aliasMap) === ek);
  const loose = exact.length ? [] : pool.filter((c) => looseKey(c.title) === lk);
  const cands = (exact.length ? exact : loose).map((c) => ({
    ...c,
    titleMatch: (exact.length ? 'exact' : 'loose') as 'exact' | 'loose',
    dateGap: releaseGap(mm, c),
    languageOk: mm.language ? c.languages.includes(mm.language) : null
  }));
  if (!cands.length) return { status: 'unmatched', confidence: null, slug: null, note: 'No BFILMY movie with this title', candidates: [] };

  const fits = cands.filter((c) => c.dateGap != null && c.dateGap <= 3 && c.languageOk !== false);
  const reRelease = !!mm.badge && /re-?release/i.test(mm.badge);
  if (fits.length === 1) {
    const c = fits[0];
    const problems: string[] = [];
    if (c.titleMatch !== 'exact') problems.push('title only matches loosely');
    if (c.languageOk == null) problems.push('MovieMint gives no language');
    if (reRelease && (c.carriedOver || (c.firstDate && mm.releaseDate && dayGap(c.firstDate, mm.releaseDate) > 7)))
      problems.push('re-release shares BFILMY history with an earlier run');
    if (!problems.length) return { status: 'matched', confidence: 'high', slug: c.slug, note: null, candidates: cands };
    return { status: 'needs_review', confidence: 'medium', slug: c.slug, note: problems.join('; '), candidates: cands };
  }
  if (fits.length > 1) {
    return { status: 'needs_review', confidence: 'ambiguous', slug: null, note: `${fits.length} BFILMY movies fit: ${fits.map((f) => f.slug).join(', ')}`, candidates: cands };
  }
  const best = [...cands].sort((a, b) => (a.dateGap ?? 9999) - (b.dateGap ?? 9999))[0];
  const why: string[] = [];
  if (!mm.releaseDate) why.push('MovieMint gives no release date');
  else if (best.dateGap == null) why.push('no BFILMY dates to compare');
  else if (best.dateGap > 3) why.push(`release dates ${best.dateGap} days apart`);
  if (best.languageOk === false) why.push(`MovieMint language ${mm.language} not among ${best.languages.join('/')}`);
  if (!mm.language) why.push('MovieMint gives no language');
  return { status: 'needs_review', confidence: 'low', slug: best.slug, note: `Suggested ${best.slug}: ${why.join('; ')}`, candidates: cands };
}
