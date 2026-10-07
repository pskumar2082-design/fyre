// Fyre's canonical movie catalog -- pure helpers (no I/O), shared by the
// admin actions, the syncs and the tests.
//
// Fyre owns its catalog. A Fyre movie (fyre_tracked_movie row) is
// discovered from a BFILMY India / BFILMY USA listing by the scheduled sync
// or created/matched by an admin (id 'fyre-' + 8 hex); movies that came in
// through MovieMint earlier keep their ids. Either way its public slug is
// bf_slug and every source listing that belongs to it points at it.
// MovieMint is never required.
import { slugify } from '@/lib/bfilmy/normalize';
import { similar, usTitleKey } from '@/lib/usa/match';

export type CatalogSource = 'bfilmy_india' | 'bfilmy_usa';

export const SOURCE_LABEL: Record<CatalogSource | 'moviemint' | 'admin', string> = {
  bfilmy_india: 'India listing',
  bfilmy_usa: 'USA listing',
  moviemint: 'MovieMint (legacy)',
  admin: 'Admin'
};

// "Don't Trouble The Trouble (2026)" -> title "Don't Trouble The Trouble",
// year 2026. Only a trailing (19xx|20xx) is read as the year.
export function splitTitleYear(raw: string): { title: string; year: number | null } {
  const t = String(raw).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.*\S)\s*\(((?:19|20)\d{2})\)$/);
  return m ? { title: m[1].trim(), year: Number(m[2]) } : { title: t, year: null };
}

export function newFyreId(rand: () => string = () => globalThis.crypto.randomUUID()): string {
  return `fyre-${rand().replace(/-/g, '').slice(0, 8)}`;
}

// Public slug for a new Fyre movie: the plain title slug if free, else
// title-year, else numbered variants. `taken` = every slug already used
// (bf_title_key + fyre_tracked_movie).
export function proposeSlug(title: string, year: number | null, taken: Set<string>): string {
  const base = slugify(title.replace(/['’]/g, '')); // "Don't" -> dont, not don-t
  const tries = [base, ...(year ? [`${base}-${year}`] : [])];
  for (const s of tries) if (!taken.has(s)) return s;
  const stem = tries[tries.length - 1];
  for (let i = 2; ; i++) if (!taken.has(`${stem}-${i}`)) return `${stem}-${i}`;
}

export type CatalogEntry = { movieId: string; slug: string; titles: string[]; dayOne: string | null; origin?: string };
export type DuplicateHit = { movieId: string; slug: string; title: string; reason: string };
export type DuplicateReport = {
  exact: DuplicateHit[]; // same title as an existing Fyre movie -> never create; use Match
  similar: DuplicateHit[]; // spelling variant? -> admin must confirm it is a different movie
};

// Duplicate protection for "Create Fyre movie". Keys ignore case,
// punctuation, a trailing (year) and & vs "and" (usTitleKey).
export function duplicateReport(title: string, catalog: CatalogEntry[]): DuplicateReport {
  const key = usTitleKey(title);
  const exact: DuplicateHit[] = [];
  const near: DuplicateHit[] = [];
  for (const m of catalog) {
    const keys = new Map(m.titles.filter(Boolean).map((t) => [usTitleKey(t), t]));
    if (keys.has(key)) exact.push({ movieId: m.movieId, slug: m.slug, title: keys.get(key)!, reason: 'same title' });
    else {
      const hit = [...keys.entries()].find(([k]) => similar(k, key));
      if (hit) near.push({ movieId: m.movieId, slug: m.slug, title: hit[1], reason: 'similar title' });
    }
  }
  return { exact, similar: near };
}

// Create is refused for an obvious duplicate; a similar title needs the
// admin's explicit confirmation that it is a different movie.
export function createBlocker(rep: DuplicateReport, acknowledgeSimilar: boolean): string | null {
  if (rep.exact.length) return `Already a Fyre movie: ${rep.exact.map((e) => `“${e.title}” (${e.slug})`).join(', ')}. Use Match instead.`;
  if (rep.similar.length && !acknowledgeSimilar) return `Similar to ${rep.similar.map((e) => `“${e.title}”`).join(', ')}. Confirm it is a different movie, or Match it.`;
  return null;
}

export type MovieMetadata = {
  poster?: string | null;
  posterSource?: string | null;
  releaseDate?: string | null;
  releaseDateSource?: string | null;
  backdrop?: string | null;
  runtime?: number | null;
  genres?: string[] | null;
  cast?: string[] | null;
  director?: string | null;
  missing?: string[];
  checkedAt?: string;
};

// What a movie page needs to look complete. Missing fields never block
// analytics; they only put the movie on the admin's review list.
export const REQUIRED_METADATA = ['poster', 'releaseDate'] as const;

export function metadataStatus(meta: MovieMetadata): { status: 'complete' | 'incomplete'; missing: string[] } {
  const missing = REQUIRED_METADATA.filter((k) => !meta[k]);
  return { status: missing.length ? 'incomplete' : 'complete', missing: [...missing] };
}

// ---------------------------------------------------------------------------
// Automatic discovery (scheduled BFILMY sync)
// ---------------------------------------------------------------------------

// What a listing must show before the sync creates a Fyre movie for it on
// its own: legitimate THEATRICAL evidence -- it is in a box-office (show)
// file with at least one real show at a real venue. One show is enough
// (small regional films may have only a few). Advance presence alone never
// creates a movie: the listing stays a candidate until shows appear (an
// admin can create it earlier).
export const DISCOVERY = {
  minShows: 1 // box office: one legitimate show
};

// Notes the sync writes on listings it did not decide (stable prefixes:
// bootstrap statistics count by them).
export const NOTE = {
  advanceOnly: 'Advance only — kept as a candidate; a Fyre movie is created once theatrical shows appear (admin can create it now)',
  noShows: 'No existing Fyre movie match; no theatrical show record yet',
  filtered: 'Filtered (not created automatically)',
  deferred: 'No existing Fyre movie match; creation deferred — creation limit reached for this run',
  sameTitle: 'Another listing with the same title is waiting — check they are the same film',
  related: 'Related title'
};

const JUNK = /\b(test(ing)?|dummy|demo|trial show|private (show|screening)|tba|tbd|untitled|unknown|n\/a|combo|[5-9]d)\b/i; // [5-9]d: "7D" rides, not films

// A usable movie title, or why not.
export function titleProblem(title: string): string | null {
  const t = String(title ?? '').trim();
  if ((t.match(/\p{L}/gu) ?? []).length < 2) return 'title has no words';
  if (t.length > 120) return 'title too long';
  if (JUNK.test(t)) return 'not a movie title';
  return null;
}

// shows: distinct show records (repeated rows for one show count once);
// places: distinct venues/cities with shows; seats: seats on sale.
export type ListingStats = { kind: 'boxoffice' | 'advance'; shows: number; sold: number; places?: number; seats?: number };

// Real theatrical evidence: a box-office file, at least one show, and that
// show is at a real place (a venue/city) or has seats.
export function enoughSourceData(s: ListingStats): boolean {
  return s.kind === 'boxoffice' && s.shows >= DISCOVERY.minShows && ((s.places ?? 0) >= 1 || (s.seats ?? 0) > 0);
}

// Two titles that could be the same film under different names (dubbed
// titles, "the Movie:" prefixes, spelling variants, a sequel number). Used
// only to STOP automatic creation -- a related title goes to admin review.
const TITLE_STOP = new Set(['the', 'a', 'an', 'of', 'and', 'movie', 'film', 'in', 'to', 'vs', '3d', '2d', 'imax', '4dx']);
export function titleWords(title: string): Set<string> {
  return new Set(
    String(title ?? '')
      .toLowerCase()
      .replace(/\s*\((19|20)\d{2}\)\s*$/, '')
      .replace(/&/g, ' and ')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w && !TITLE_STOP.has(w))
  );
}
export function relatedTitle(a: string, b: string): boolean {
  const ka = usTitleKey(a);
  const kb = usTitleKey(b);
  if (!ka || !kb) return false;
  if (ka === kb || similar(ka, kb)) return true;
  const A = titleWords(a);
  const B = titleWords(b);
  const [small, large] = A.size <= B.size ? [A, B] : [B, A];
  if (!small.size) return false;
  let shared = 0;
  for (const w of small) if (large.has(w)) shared++;
  if (shared === small.size) {
    if (small.size >= 2) return true; // every word of one is in the other
    const [w] = [...small];
    return w.length >= 5 && large.size <= 3; // "Jayanti" / "Jayanti 2"
  }
  return small.size >= 3 && shared / small.size >= 0.75;
}
// First title in `titles` related to `title` (ignoring `self`), or null.
export function findRelated(title: string, titles: Iterable<string>, self?: string): string | null {
  for (const t of titles) if (t !== self && relatedTitle(title, t)) return t;
  return null;
}

export type DiscoveryAction = { action: 'attach'; movieId: string } | { action: 'create' } | { action: 'review'; note: string } | { action: 'wait'; note: string };

// The scheduled sync's decision for one listing nobody has decided yet.
//   matched by title + date (+ language)          -> attach to that movie
//   close but not certain (similar / two movies / out of window /
//     another listing of the same title waiting /
//     a related title in the catalog or waiting)  -> admin review
//   junk / event / ride / combo title             -> filtered (never created)
//   advance file only                             -> candidate (wait for shows)
//   box office, >= 1 real show, nothing near it   -> create a Fyre movie
//   box office but no real show record            -> wait
// Previously rejected listings never reach here. Never guesses between
// candidates; never needs MovieMint.
export function discoveryAction(
  match: { status: 'matched' | 'needs_review' | 'unmatched'; movieId: string | null; note: string },
  title: string,
  stats: ListingStats,
  opts: { sameTitleElsewhere?: boolean; related?: string | null } = {}
): DiscoveryAction {
  if (match.status === 'matched' && match.movieId) return { action: 'attach', movieId: match.movieId };
  if (match.status === 'needs_review') return { action: 'review', note: match.note };
  const bad = titleProblem(title);
  if (bad) return { action: 'wait', note: `${NOTE.filtered}: ${bad}` };
  if (opts.sameTitleElsewhere) return { action: 'review', note: NOTE.sameTitle };
  if (opts.related) return { action: 'review', note: `${NOTE.related} "${opts.related}" — check whether it is the same film before creating` };
  if (stats.kind !== 'boxoffice') return { action: 'wait', note: NOTE.advanceOnly };
  if (!enoughSourceData(stats)) return { action: 'wait', note: NOTE.noShows };
  return { action: 'create' };
}

// ---------------------------------------------------------------------------
// 90-day active window (BFILMY source activity decides; never MovieMint)
// ---------------------------------------------------------------------------
//   - discovery / history import look back at most ACTIVE_WINDOW_DAYS of
//     source files (today included); older BFILMY history is never fetched
//     just because it exists
//   - a movie already in Fyre keeps being imported for as long as BFILMY
//     reports shows for it -- there is no maximum run length
//   - a catalog record is never deleted for being inactive
export const ACTIVE_WINDOW_DAYS = 90;

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// First date of the window ending `today` (inclusive): today - 89.
export function windowStart(today: string, days = ACTIVE_WINDOW_DAYS): string {
  return addDaysIso(today, -(days - 1));
}

// Where a new movie's history import starts: its known release date minus 3
// days (advance), never before the window. Unknown release -> the window
// start (whatever is there inside the window). `clamped` = the window cut
// it short, so the movie may have older history we did not fetch.
export function historyRange(today: string, releaseDate: string | null, days = ACTIVE_WINDOW_DAYS): { floor: string; start: string; clamped: boolean } {
  const floor = windowStart(today, days);
  const wanted = releaseDate ? addDaysIso(releaseDate, -3) : null;
  if (wanted && wanted > floor) return { floor, start: wanted, clamped: false };
  return { floor, start: floor, clamped: true };
}

// Is the stored history the movie's whole run? Only when the window did not
// cut it off: data that begins exactly at a clamped start may have older
// days we never imported. No box-office days yet (advance only) = nothing
// missing. Data older than the start came from earlier full imports.
export function historyComplete(firstStored: string | null, range: { start: string; clamped: boolean }): boolean {
  if (!firstStored) return true;
  return !(range.clamped && firstStored === range.start);
}

// Discovery bootstrap: a listing is considered only if it has activity
// inside the window. (A movie that ended before the window is never
// discovered as a new movie.)
export function inActiveWindow(lastActivity: string | null, today: string, days = ACTIVE_WINDOW_DAYS): boolean {
  return !!lastActivity && lastActivity >= windowStart(today, days) && lastActivity <= addDaysIso(today, 7);
}

// Admin label from the latest BFILMY activity (India or USA, box office or
// advance). ACTIVE = activity inside the window. Inactive movies stay in
// the catalog and on the site with their history.
export function activityStatus(lastActivity: string | null, today: string, days = ACTIVE_WINDOW_DAYS): 'ACTIVE' | 'INACTIVE' {
  return inActiveWindow(lastActivity, today, days) ? 'ACTIVE' : 'INACTIVE';
}
