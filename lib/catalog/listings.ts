// BFILMY India listings (bf_listing) and India discovery. Every title the
// scheduled India sync sees in a summary file is recorded (identity only --
// title, dates seen, languages; never figures for a title that is not a
// Fyre movie) and, if nobody has decided it yet, decided here:
//
//   already a Fyre movie's title (tracked)            -> matched
//   same title as a Fyre movie, first date within
//     -10/+30 days of its Day 1, languages compatible -> attached (auto)
//   close but not certain                              -> needs_review
//   related title (catalog movie or another waiting
//     listing: dubbed name, "the Movie:" prefix)     -> needs_review
//   no Fyre movie near it, real title, real shows      -> a Fyre movie is
//                                                         created (auto)
//   not enough to go on yet                            -> unmatched (re-checked)
//   admin decisions (manual, created, rejected)        -> never changed
//
// One summary file is fetched once and everything in it is discovered and
// imported from that one copy. MovieMint plays no part.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { loadTrackedMovies } from '@/lib/usa/sync';
import { matchUsIds, NO_MATCH_NOTE, usTitleKey } from '@/lib/usa/match';
import { discoveryAction, findRelated, NOTE, type ListingStats } from './core';
import { createCatalogMovie } from './create';
import type { BfMovieDay } from '@/lib/bfilmy/types';

const db = supabaseAdmin as any;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type Movies = Awaited<ReturnType<typeof loadTrackedMovies>>;

// Points an India listing (title key) at a Fyre movie. The movie's India
// data is stored under its public slug:
//   - first India listing of the movie: the key -> the movie's slug
//     (bf_title_key), so the import files that title under the movie
//   - a further listing (spelling variant): an alias, merged into the
//     first title before a day's figures are added up (lib/catalog/aliases)
export async function attachIndiaListing(
  key: string,
  movieId: string,
  how: { method: string; confidence: string; note: string; decidedBy?: string | null }
): Promise<{ slug: string; alias: boolean }> {
  const listing = await must<any>(db.from('bf_listing').select('*').eq('key', key).maybeSingle(), 'bf_listing');
  if (!listing) throw new Error(`Unknown India listing ${key}`);
  const movie = await must<any>(db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,title,match_status').eq('moviemint_id', movieId).maybeSingle(), 'fyre_tracked_movie');
  if (!movie || movie.match_status !== 'matched' || !movie.bf_slug) throw new Error('Not a Fyre movie');
  const slug: string = movie.bf_slug;

  const keys = await must<any[]>(db.from('bf_title_key').select('key,slug').eq('slug', slug), 'bf_title_key');
  const primary = keys.find((k) => !String(k.key).startsWith('fyre:'));
  let alias = false;
  if (!primary || primary.key === key) {
    const existing = await must<any>(db.from('bf_title_key').select('key,slug').eq('key', key).maybeSingle(), 'bf_title_key');
    if (existing && existing.slug !== slug) {
      const { data: owner } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('bf_slug', existing.slug).eq('match_status', 'matched').maybeSingle();
      if (owner) throw new Error(`This India title already belongs to Fyre movie ${existing.slug}`);
      await must(db.from('bf_title_key').update({ slug, title: movie.title ?? listing.source_title }).eq('key', key), 'bf_title_key');
    } else if (!existing) {
      await must(db.from('bf_title_key').insert({ key, slug, title: movie.title ?? listing.source_title }), 'bf_title_key');
    }
  } else {
    alias = true;
  }
  const now = new Date().toISOString();
  await must(
    db.from('bf_listing').update({ movie_id: movieId, match_status: 'matched', match_method: how.method, match_confidence: how.confidence, match_note: how.note, reviewed_at: how.method === 'title+date' ? null : now, updated_at: now }).eq('key', key),
    'bf_listing'
  );
  await must(
    db.from('fyre_movie_alias').insert({
      movie_id: movieId,
      source: 'bfilmy_india',
      source_title: listing.source_title,
      source_key: key,
      source_movie_id: key,
      match_method: how.method,
      match_confidence: how.confidence,
      decision: 'matched',
      decided_by: how.decidedBy ?? (how.method === 'title+date' ? 'auto' : 'admin'),
      note: alias ? `spelling variant of ${primary!.key}` : how.note
    }),
    'fyre_movie_alias'
  );
  // Import the India history (summary + breakdowns) on the next sync.
  await must(db.from('fyre_tracked_movie').update({ backfill_status: 'requested', backfill_requested_at: now, updated_at: now }).eq('moviemint_id', movieId), 'fyre_tracked_movie');
  return { slug, alias };
}

export type DiscoveryCache = {
  movies?: Movies;
  pendingByTitle?: Map<string, Set<string>>; // title key -> undecided India listing keys
  pendingTitles?: Map<string, string>; // undecided India listing key -> its title
  budget?: { left: number }; // automatic creations still allowed this run
};

export type DiscoveryResult = {
  writes: number;
  attached: string[];
  created: string[];
  review: number;
  newKeys: Map<string, string>; // India title key -> slug, for titles now belonging to a Fyre movie
  titles: number; // distinct titles in the file
};

export const AUTO_CREATE_MAX = Number(process.env.CATALOG_AUTO_CREATE_MAX ?? 25);
export const AUTO_CREATE_ENABLED = process.env.CATALOG_AUTO_CREATE !== '0';

// Called by the India import for each summary file it reads (scheduled sync
// only -- never on a visitor request). `days` = every title in the file
// (normalized), `tracked` = key -> slug for titles already filed under a
// Fyre movie. Writes only rows that changed.
export async function discoverIndia(
  days: BfMovieDay[],
  date: string,
  tracked: Map<string, string>,
  cache: DiscoveryCache = {},
  opts: { autoCreate?: boolean } = {}
): Promise<DiscoveryResult> {
  const autoCreate = opts.autoCreate ?? AUTO_CREATE_ENABLED;
  const out: DiscoveryResult = { writes: 0, attached: [], created: [], review: 0, newKeys: new Map(), titles: 0 };
  const seen = new Map<string, { title: string; languages: Set<string>; stats: ListingStats }>();
  for (const d of days) {
    const s = seen.get(d.key) ?? { title: d.title, languages: new Set<string>(), stats: { kind: d.kind, shows: 0, sold: 0, places: 0, seats: 0 } };
    for (const l of d.totals.languages ?? []) s.languages.add(l);
    // Repeated rows for the same title never add up: the largest counts.
    s.stats.shows = Math.max(s.stats.shows, Number(d.totals.shows) || 0);
    s.stats.sold = Math.max(s.stats.sold, Number(d.totals.sold) || 0);
    s.stats.places = Math.max(s.stats.places ?? 0, Number(d.totals.cities) || 0);
    s.stats.seats = Math.max(s.stats.seats ?? 0, Number(d.totals.totalSeats) || 0);
    seen.set(d.key, s);
  }
  out.titles = seen.size;
  if (!seen.size) return out;
  const existing = new Map<string, any>();
  for (const c of chunks([...seen.keys()], 200)) for (const r of await must<any[]>(db.from('bf_listing').select('*').in('key', c), 'bf_listing')) existing.set(r.key, r);

  const settledRow = (e: any) => e && (e.match_status === 'rejected' || e.match_status === 'matched' || e.match_method === 'manual');
  const needMovies = [...seen.keys()].some((k) => (tracked.has(k) ? existing.get(k)?.match_status !== 'matched' : !settledRow(existing.get(k))));
  if (needMovies && !cache.movies) cache.movies = await loadTrackedMovies();
  const movies = cache.movies ?? [];
  const bySlug = new Map(movies.map((m) => [m.slug, m.movieId]));

  const now = new Date().toISOString();
  const seenRows: any[] = []; // only first/last date, languages changed
  const decidedRows: any[] = []; // match fields (re)decided
  const pending = new Map<string, any>();
  for (const [key, s] of seen) {
    const e = existing.get(key);
    const first = e?.first_date && e.first_date < date ? e.first_date : date;
    const last = e?.last_date && e.last_date > date ? e.last_date : date;
    const languages = [...new Set([...(e?.languages ?? []), ...s.languages])];
    const base = { key, source_title: e?.source_title ?? s.title, first_date: first, last_date: last, languages, updated_at: now };
    const changed = !e || e.first_date !== first || e.last_date !== last || languages.length !== (e.languages ?? []).length;
    const trackedSlug = tracked.get(key);
    if (trackedSlug) {
      if (!e || e.match_status !== 'matched') {
        const movieId = bySlug.get(trackedSlug) ?? null;
        decidedRows.push({ ...base, movie_id: movieId, match_status: movieId ? 'matched' : 'needs_review', match_method: 'tracked', match_confidence: 'high', match_note: 'Filed under a Fyre movie', candidates: [] });
      } else if (changed) seenRows.push(base);
      continue;
    }
    if (settledRow(e)) {
      if (changed) seenRows.push(base);
    } else pending.set(key, { row: base, changed, e, stats: s.stats });
  }

  if (pending.size) {
    // Undecided India listings by title (this run), so two listings with
    // the same title never each become a movie.
    if (!cache.pendingByTitle || !cache.pendingTitles) {
      cache.pendingByTitle = new Map();
      cache.pendingTitles = new Map();
      const since = new Date(Date.parse(`${date}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
      for (const r of await must<any[]>(db.from('bf_listing').select('key,source_title').in('match_status', ['unmatched', 'needs_review']).gte('last_date', since), 'bf_listing pending')) {
        const t = usTitleKey(r.source_title);
        cache.pendingByTitle.set(t, (cache.pendingByTitle.get(t) ?? new Set()).add(r.key));
        cache.pendingTitles.set(r.key, r.source_title);
      }
    }
    for (const p of pending.values()) {
      const t = usTitleKey(p.row.source_title);
      cache.pendingByTitle.set(t, (cache.pendingByTitle.get(t) ?? new Set()).add(p.row.key));
      cache.pendingTitles.set(p.row.key, p.row.source_title);
    }
    const pendingTitles = cache.pendingTitles;
    // Another waiting listing (or catalog movie) with a related title: the
    // same film under another name is never created twice automatically.
    const relatedTo = (key: string, title: string): string | null =>
      findRelated(title, movies.flatMap((m) => m.titles)) ?? findRelated(title, [...pendingTitles].filter(([k]) => k !== key).map(([, t]) => t));
    // Movies that already have India data: another India title with the same
    // name is a split listing -> admin review, never automatic.
    const taken = new Map<string, string[]>();
    for (const m of movies) if (m.hasIndia) taken.set(m.movieId, ['(India data)']);
    for (const r of await must<any[]>(db.from('bf_listing').select('key,movie_id').eq('match_status', 'matched'), 'bf_listing matched')) if (r.movie_id) taken.set(r.movie_id, [...(taken.get(r.movie_id) ?? []), r.key]);
    const toDecide = [...pending.values()].map((p) => ({ sourceMovieId: p.row.key as string, title: p.row.source_title as string, firstDate: p.row.first_date as string, languages: p.row.languages as string[] }));
    const budget = (cache.budget ??= { left: AUTO_CREATE_MAX });
    const toAttach: { key: string; movieId: string }[] = [];
    const toCreate: { key: string; title: string; languages: string[]; firstDate: string }[] = [];
    for (const d of matchUsIds<string>(toDecide, movies, taken, 'India')) {
      const p = pending.get(d.sourceMovieId)!;
      const others = [...(cache.pendingByTitle.get(usTitleKey(p.row.source_title)) ?? [])].filter((k) => k !== p.row.key);
      const act = discoveryAction(d, p.row.source_title, p.stats, { sameTitleElsewhere: others.length > 0, related: d.status === 'unmatched' ? relatedTo(p.row.key, p.row.source_title) : null });
      // attach / create are written by attachIndiaListing / createCatalogMovie;
      // until then the row reads as undecided.
      let status: string = d.status === 'matched' ? 'needs_review' : d.status;
      let note = d.note;
      if (act.action === 'review') {
        status = 'needs_review';
        note = act.note;
      } else if (act.action === 'wait') {
        status = 'unmatched';
        note = act.note;
      } else if (act.action === 'create') {
        status = 'unmatched';
        note = autoCreate ? (budget.left > 0 ? 'Creating a Fyre movie' : NOTE.deferred) : 'No existing Fyre movie match';
      }
      const same = p.e && p.e.match_status === status && p.e.match_note === note && !p.changed;
      if (!same || act.action === 'attach' || act.action === 'create') decidedRows.push({ ...p.row, movie_id: null, match_status: status, match_confidence: d.confidence, match_method: d.method, match_note: note, candidates: d.candidates });
      if (status === 'needs_review') out.review++;
      if (act.action === 'attach') toAttach.push({ key: d.sourceMovieId, movieId: act.movieId });
      if (act.action === 'create' && autoCreate && budget.left > 0) {
        budget.left--;
        toCreate.push({ key: d.sourceMovieId, title: p.row.source_title, languages: p.row.languages, firstDate: p.row.first_date });
      }
    }
    for (const c of chunks(decidedRows, 200)) await must(db.from('bf_listing').upsert(c, { onConflict: 'key' }), 'bf_listing upsert');
    decidedRows.length && (out.writes += decidedRows.length);
    decidedRows.length = 0;
    for (const a of toAttach) {
      try {
        const r = await attachIndiaListing(a.key, a.movieId, { method: 'title+date', confidence: 'high', note: 'Same title; first India date within -10/+30 days of Day 1', decidedBy: 'auto' });
        out.newKeys.set(a.key, r.slug);
        out.attached.push(`${a.key} -> ${a.movieId}`);
        out.writes += 4;
      } catch {
        // left as needs_review for the admin
      }
    }
    for (const c of toCreate) {
      try {
        const m = await createCatalogMovie({ source: 'bfilmy_india', sourceId: c.key, sourceTitle: c.title, languages: c.languages, firstDate: c.firstDate, decidedBy: 'auto', metadata: { checkedAt: undefined } });
        out.newKeys.set(c.key, m.slug);
        out.created.push(`${c.key} -> ${m.movieId} (${m.slug})`);
        movies.push({ movieId: m.movieId, slug: m.slug, titles: [m.title], dayOne: c.firstDate, indiaDayOne: null, active: true, origin: 'bfilmy_india', title: m.title, hasIndia: true, languages: c.languages });
        cache.pendingByTitle.get(usTitleKey(c.title))?.delete(c.key);
        pendingTitles.delete(c.key);
        out.writes += 5;
      } catch {
        // e.g. an overlapping run created it first (unique created_from)
      }
    }
  }
  for (const c of chunks(decidedRows, 200)) await must(db.from('bf_listing').upsert(c, { onConflict: 'key' }), 'bf_listing upsert');
  for (const c of chunks(seenRows, 200)) await must(db.from('bf_listing').upsert(c, { onConflict: 'key' }), 'bf_listing upsert');
  out.writes += decidedRows.length + seenRows.length;
  return out;
}

export { NO_MATCH_NOTE };
