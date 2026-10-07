// USA import: BFILMY USA files -> us_* tables (supabase/migration_bfilmy_usa.sql).
// Only source ids matched to a Fyre movie are imported. Scheduled runs also
// discover: a new USA listing can become a Fyre movie (no MovieMint needed).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dayOneDate } from '@/lib/bfilmy/adapter';
import { fetchUsFile, type UsFetch } from './fetch';
import { aggregateMovie, listSourceMovies, parseUsFile, US_DETAIL_DIMENSIONS, US_DIMENSIONS, type UsFile, type UsKind, type UsMovieDay } from './normalize';
import { matchUsIds, usTitleKey, type TrackedMovie } from './match';
import { discoveryAction, findRelated, historyComplete, NOTE, windowStart } from '@/lib/catalog/core';
import { bootstrapRunning } from '@/lib/catalog/bootstrapState';
import { createCatalogMovie } from '@/lib/catalog/create';
import { usDayOne, usFinal, usReleaseDay, usToday } from './days';

const db = supabaseAdmin as any;

export const US_BREAKDOWN_DAYS = Number(process.env.US_BREAKDOWN_DAYS ?? 90);
export const US_DETAIL_DAYS = Number(process.env.US_DETAIL_DAYS ?? 30);
export const US_SHOW_DAYS = Number(process.env.US_SHOW_DAYS ?? 7);
export const US_SNAPSHOT_DAYS = Number(process.env.US_SNAPSHOT_DAYS ?? 30);

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// Fyre movies (the canonical catalog: MovieMint-discovered or created by an
// admin from a source listing) with every title a source listing may use
// and the India Day 1.
//   indiaDayOne: India Day 1 (or a known release date) -- the USA Day 1 rule
//   dayOne:      the same, else the first date the creating listing had
//                shows (matching window only)
export async function loadTrackedMovies(): Promise<(TrackedMovie & { active: boolean; indiaDayOne: string | null; origin: string; title: string | null; hasIndia: boolean; languages: string[] })[]> {
  let tracked: any[];
  try {
    tracked = await must<any[]>(
      db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,tracking_status,origin,title,release_date,first_source_date,languages').eq('match_status', 'matched').not('bf_slug', 'is', null),
      'fyre_tracked_movie'
    );
  } catch (err: any) {
    // Before migration_catalog.sql: the original columns only.
    if (!/origin|first_source_date|release_date|title|languages/.test(String(err?.message))) throw err;
    tracked = await must<any[]>(db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,tracking_status').eq('match_status', 'matched').not('bf_slug', 'is', null), 'fyre_tracked_movie');
  }
  const ids = tracked.map((t) => t.moviemint_id);
  const slugs = tracked.map((t) => t.bf_slug);
  // MovieMint's stored list is optional enrichment (an extra title spelling,
  // a release date); if it is missing or unreadable nothing here changes.
  const mm = new Map<string, any>();
  try {
    for (const c of chunks(ids.filter((i) => !String(i).startsWith('fyre-')), 200)) for (const r of await must<any[]>(db.from('mm_movie').select('moviemint_id,title,release_date').in('moviemint_id', c), 'mm_movie')) mm.set(r.moviemint_id, r);
  } catch {
    mm.clear();
  }
  const bf = new Map<string, any>();
  for (const c of chunks(slugs, 200)) for (const r of await must<any[]>(db.from('bf_movie').select('slug,title,release_date,first_date,carried_over,languages').in('slug', c), 'bf_movie')) bf.set(r.slug, r);
  // Confirmed source titles (spelling variants) of each movie.
  const aliases = new Map<string, string[]>();
  const { data: aliasRows } = await db.from('fyre_movie_alias').select('movie_id,source_title').in('decision', ['created', 'matched']);
  for (const a of aliasRows ?? []) aliases.set(a.movie_id, [...(aliases.get(a.movie_id) ?? []), a.source_title]);
  return tracked.map((t) => {
    const b = bf.get(t.bf_slug);
    const m = mm.get(t.moviemint_id);
    const indiaDayOne = b ? dayOneDate(b) ?? (!b.first_date && !b.carried_over ? b.release_date : null) : m?.release_date ?? t.release_date ?? null;
    return {
      movieId: t.moviemint_id,
      slug: t.bf_slug,
      titles: [...new Set([m?.title, b?.title, t.title, ...(aliases.get(t.moviemint_id) ?? [])].filter(Boolean))],
      dayOne: indiaDayOne ?? t.first_source_date ?? null,
      indiaDayOne,
      active: t.tracking_status === 'active' || t.tracking_status === 'ended', // 'ended' = legacy MovieMint state; only an admin 'stopped' stops tracking
      origin: t.origin ?? 'moviemint',
      title: t.title ?? b?.title ?? m?.title ?? null,
      hasIndia: !!b,
      languages: [...new Set([...(b?.languages ?? []), ...(t.languages ?? [])])]
    };
  });
}

type MapRow = { source_movie_id: number; source_title: string; movie_id: string | null; match_status: string; match_method: string | null; first_date: string | null; last_date: string | null; languages: string[] | null };

// Undecided India listings by title key (an India title still waiting for
// its Fyre movie). [] when the table is not there yet.
async function pendingIndiaTitles(date: string): Promise<Map<string, string> & { titles?: string[] }> {
  const out: Map<string, string> & { titles?: string[] } = new Map<string, string>();
  out.titles = [];
  try {
    const since = addDays(date, -60);
    const { data, error } = await db.from('bf_listing').select('source_title,match_status,match_note').in('match_status', ['unmatched', 'needs_review']).gte('last_date', since);
    if (!error)
      for (const r of data ?? []) {
        // 'unmatched' here = an India listing with theatrical shows that is
        // about to become a Fyre movie; advance-only / filtered / show-less
        // India candidates never hold a USA listing back.
        const creating = r.match_note === 'Creating a Fyre movie' || r.match_note === NOTE.deferred;
        out.set(usTitleKey(r.source_title), r.match_status === 'needs_review' ? 'needs_review' : creating ? 'unmatched' : 'candidate');
        out.titles!.push(r.source_title);
      }
  } catch {
    // no India listings table yet
  }
  return out;
}

// Records every source id in a file (first/last date, languages) and
// (re)decides the ones not yet settled. Manual decisions and 'rejected'
// are never changed; an automatic 'matched' is kept.
// discover (scheduled runs only): a USA listing with no Fyre movie near it,
// a real title and real shows becomes a Fyre movie (lib/catalog/create),
// added to `movies` so this same file imports it. Ambiguous -> review.
export async function recordSeenIds(file: UsFile, date: string, movies: TrackedMovie[], discover?: { budget: { left: number }; kind: UsKind } | null): Promise<Map<number, MapRow>> {
  const seen = listSourceMovies(file);
  const ids = seen.map((s) => s.sourceMovieId);
  const existing = new Map<number, MapRow>();
  for (const c of chunks(ids, 200)) for (const r of await must<MapRow[]>(db.from('us_movie_map').select('source_movie_id,source_title,movie_id,match_status,match_method,first_date,last_date,languages').in('source_movie_id', c), 'us_movie_map')) existing.set(Number(r.source_movie_id), r);

  const rows: any[] = [];
  const toDecide: { sourceMovieId: number; title: string; firstDate: string | null; languages: string[] }[] = [];
  const statsOf = new Map(seen.map((s) => [s.sourceMovieId, { shows: s.shows, sold: s.sold, places: s.places, seats: s.seats }]));
  for (const s of seen) {
    const e = existing.get(s.sourceMovieId);
    const first = e?.first_date && e.first_date < date ? e.first_date : date;
    const last = e?.last_date && e.last_date > date ? e.last_date : date;
    const languages = [...new Set([...(e?.languages ?? []), ...s.languages])];
    rows.push({ source_movie_id: s.sourceMovieId, source_title: s.title, title_key: usTitleKey(s.title), first_date: first, last_date: last, languages, updated_at: new Date().toISOString() });
    const settled = e && (e.match_status === 'rejected' || e.match_method === 'manual' || e.match_status === 'matched');
    if (!settled) toDecide.push({ sourceMovieId: s.sourceMovieId, title: s.title, firstDate: first, languages });
  }
  const taken = new Map<string, number[]>();
  if (toDecide.length) {
    for (const r of await must<any[]>(db.from('us_movie_map').select('source_movie_id,movie_id').eq('match_status', 'matched'), 'us_movie_map matched'))
      taken.set(r.movie_id, [...(taken.get(r.movie_id) ?? []), Number(r.source_movie_id)]);
  }
  const decisions = new Map(matchUsIds(toDecide, movies, taken).map((d) => [d.sourceMovieId, d]));
  const now = new Date().toISOString();
  const toCreate: { id: number; title: string; languages: string[]; firstDate: string | null }[] = [];
  if (discover && toDecide.length) {
    const india = await pendingIndiaTitles(date);
    const keyCount = new Map<string, number>();
    for (const t of toDecide) keyCount.set(usTitleKey(t.title), (keyCount.get(usTitleKey(t.title)) ?? 0) + 1);
    for (const t of toDecide) {
      const d = decisions.get(t.sourceMovieId)!;
      const key = usTitleKey(t.title);
      const st = statsOf.get(t.sourceMovieId) ?? { shows: 0, sold: 0 };
      // A related title (catalog movie, another undecided USA id, a waiting
      // India listing -- but not this exact title) -> review, never created.
      const related =
        d.status === 'unmatched'
          ? findRelated(t.title, movies.flatMap((m) => m.titles)) ??
            findRelated(t.title, toDecide.filter((o) => o.sourceMovieId !== t.sourceMovieId).map((o) => o.title)) ??
            findRelated(t.title, (india.titles ?? []).filter((x) => usTitleKey(x) !== key))
          : null;
      const act = discoveryAction(d, t.title, { kind: discover.kind, ...st }, { sameTitleElsewhere: (keyCount.get(key) ?? 0) > 1 || india.get(key) === 'needs_review', related });
      if (act.action === 'review') Object.assign(d, { status: 'needs_review', note: act.note });
      else if (act.action === 'wait') d.note = act.note;
      else if (act.action === 'create') {
        if (india.get(key) === 'unmatched') d.note = 'An India listing with this title is about to become a Fyre movie; matched to it next';
        else if (discover.budget.left > 0) {
          discover.budget.left--;
          toCreate.push({ id: t.sourceMovieId, title: t.title, languages: t.languages, firstDate: t.firstDate });
          d.note = 'Creating a Fyre movie';
        } else d.note = NOTE.deferred;
      }
    }
  }
  for (const r of rows) {
    const d = decisions.get(r.source_movie_id);
    if (d) Object.assign(r, { movie_id: d.movieId, match_status: d.status, match_confidence: d.confidence, match_method: d.method, match_note: d.note, candidates: d.candidates, ...(d.status === 'matched' ? { reviewed_at: null } : {}) });
  }
  // Two batches with uniform columns (PostgREST fills absent columns with
  // null in a mixed batch): decided rows carry the match fields, settled
  // rows only their seen-dates/title.
  const decided = rows.filter((r) => r.match_status !== undefined);
  const settledRows = rows.filter((r) => r.match_status === undefined);
  for (const c of chunks(decided, 200)) await must(db.from('us_movie_map').upsert(c, { onConflict: 'source_movie_id' }), 'us_movie_map upsert');
  for (const c of chunks(settledRows, 200)) await must(db.from('us_movie_map').upsert(c, { onConflict: 'source_movie_id' }), 'us_movie_map upsert');
  // Automatic matches go on the movie's permanent mapping record too.
  const autoRows = decided
    .filter((r) => r.match_status === 'matched' && r.movie_id)
    .map((r) => ({ movie_id: r.movie_id, source: 'bfilmy_usa', source_title: r.source_title, source_key: r.title_key, source_movie_id: String(r.source_movie_id), match_method: r.match_method, match_confidence: r.match_confidence, decision: 'matched', decided_by: 'auto', note: r.match_note }));
  if (autoRows.length) await db.from('fyre_movie_alias').insert(autoRows);
  // New Fyre movies (each also maps its USA id and requests its history).
  for (const c of toCreate) {
    try {
      const m = await createCatalogMovie({ source: 'bfilmy_usa', sourceId: String(c.id), sourceTitle: c.title, languages: c.languages, firstDate: c.firstDate, decidedBy: 'auto', metadata: { checkedAt: undefined } });
      const r = rows.find((x) => x.source_movie_id === c.id);
      if (r) Object.assign(r, { movie_id: m.movieId, match_status: 'matched', match_method: 'discovered', match_note: 'Discovered by the BFILMY sync' });
      movies.push({ movieId: m.movieId, slug: m.slug, titles: [m.title, c.title], dayOne: c.firstDate, languages: c.languages, ...({ active: true, indiaDayOne: null, origin: 'bfilmy_usa', title: m.title, hasIndia: false } as any) });
    } catch {
      // e.g. an overlapping run created it first (unique created_from)
    }
  }
  void now;
  const out = new Map<number, MapRow>();
  for (const r of rows) {
    const e = existing.get(r.source_movie_id);
    out.set(r.source_movie_id, { ...(e ?? {}), ...r, match_status: r.match_status ?? e?.match_status, movie_id: r.movie_id !== undefined ? r.movie_id : e?.movie_id ?? null } as MapRow);
  }
  return out;
}

export type UsFileResult = {
  kind: UsKind;
  date: string;
  status: 'ok' | 'not_modified' | 'missing' | 'error';
  requests?: number; // HTTP requests made to the source for this file (0 or 1)
  writes?: number; // rows written to Supabase
  movies?: number;
  imported?: number;
  rows?: number;
  rowsImported?: number;
  showsStored?: number;
  snapshots?: number;
  mismatches?: string[];
  listings?: number; // distinct source ids in the file
  error?: string;
};

export type UsSyncOptions = {
  force?: boolean; // ignore the stored ETag
  now?: Date;
  onlyMovieIds?: Set<string>; // import just these Fyre movies (history for a new match)
  includeEnded?: boolean; // legacy flag: 'ended' movies are always imported now; an admin-'stopped' movie never is
  movies?: Awaited<ReturnType<typeof loadTrackedMovies>>;
  file?: UsFetch; // already fetched (backfill cache)
  skipReleaseDays?: boolean; // backfill: refreshReleaseDays once at the end
  discover?: { left: number } | null; // scheduled runs: create Fyre movies for new listings (shared budget)
};

// One source file -> the us_* tables, for every matched tracked movie in it.
export async function syncUsFile(kind: UsKind, date: string, opts: UsSyncOptions = {}): Promise<UsFileResult> {
  const now = opts.now ?? new Date();
  const today = usToday(now);
  try {
    const { data: prev } = await db.from('us_sync_file').select('etag,first_seen_at').eq('kind', kind).eq('report_date', date).maybeSingle();
    const requests = opts.file ? 0 : 1;
    // Unchanged file (304 via If-None-Match): no parsing, no data writes --
    // only last_checked_at.
    const got = opts.file ?? (await fetchUsFile(kind, date, opts.force || opts.onlyMovieIds ? null : prev?.etag));
    if (got.status === 'missing') return { kind, date, status: 'missing', requests, writes: 0 };
    if (got.status === 'not_modified') {
      await db.from('us_sync_file').update({ last_checked_at: now.toISOString() }).eq('kind', kind).eq('report_date', date);
      return { kind, date, status: 'not_modified', requests, writes: 1 };
    }
    const file = parseUsFile(got.json);
    const seenAt = prev?.etag && prev.etag === got.etag ? prev.first_seen_at : now.toISOString();
    const movies = opts.movies ?? (await loadTrackedMovies());
    const before = movies.length;
    const map = await recordSeenIds(file, date, movies, opts.discover ? { budget: opts.discover, kind } : null);
    // Movies discovered from this file are imported from it too (also when
    // the caller limits the import to a set of movies, e.g. the bootstrap).
    if (opts.onlyMovieIds) for (const m of movies.slice(before)) opts.onlyMovieIds.add(m.movieId);
    const movieById = new Map(movies.map((m) => [m.movieId, m]));
    const mapWrites = map.size;

    // Source ids per Fyre movie (a movie can own more than one id).
    const byMovie = new Map<string, number[]>();
    for (const [id, r] of map) {
      if (r.match_status !== 'matched' || !r.movie_id) continue;
      const m = movieById.get(r.movie_id);
      // Only an admin 'stopped' (m.active false) is skipped -- by every job.
      if (!m || !m.active) continue;
      if (opts.onlyMovieIds && !opts.onlyMovieIds.has(r.movie_id)) continue;
      byMovie.set(r.movie_id, [...(byMovie.get(r.movie_id) ?? []), id]);
    }

    const final = usFinal(date, now);
    const keepDims = date >= addDays(today, -US_BREAKDOWN_DAYS);
    const keepDetail = date >= addDays(today, -US_DETAIL_DAYS);
    const keepShows = kind === 'boxoffice' ? date >= addDays(today, -US_SHOW_DAYS) : date >= today;
    const syncedAt = now.toISOString();
    const dayRows: any[] = [];
    const dimRows: any[] = [];
    const showRows: any[] = [];
    const snapRows: any[] = [];
    const mismatches: string[] = [];
    const aggs = new Map<string, UsMovieDay>();
    for (const [movieId, ids] of byMovie) {
      const a = aggregateMovie(file, ids);
      if (!a) continue;
      aggs.set(movieId, a);
      for (const [k, v] of Object.entries(a.recon)) if (v && typeof v === 'object' && (v as any).status === 'MISMATCH' && k !== 'occupancy') mismatches.push(`${movieId}:${k}`);
      dayRows.push({
        movie_id: movieId,
        kind,
        report_date: date,
        source_movie_ids: ids,
        source_url: got.url,
        source_etag: got.etag,
        source_seen_at: seenAt,
        source_updated_at: null,
        synced_at: syncedAt,
        final,
        gross: a.gross,
        tickets: a.tickets,
        seats: a.seats,
        shows: a.shows,
        shows_source: a.showsSource,
        zero_seat_shows: a.zeroSeatShows,
        occupancy: a.occupancy,
        occupancy_source: a.occupancySource,
        theatres: a.theatres,
        cities: a.cities,
        states: a.states,
        source_summary: a.summaries,
        recon: a.recon,
        metric_origin: METRIC_ORIGIN,
        breakdown_pruned: !keepDims,
        detail_pruned: !keepDetail
      });
      for (const d of US_DIMENSIONS) {
        const detail = US_DETAIL_DIMENSIONS.includes(d);
        if (detail ? !keepDetail : !keepDims) continue;
        dimRows.push({ movie_id: movieId, kind, report_date: date, dimension: d, rows: a.dims[d], row_count: a.dims[d].length });
      }
      if (keepShows) {
        for (const s of a.shows_) {
          showRows.push({
            kind,
            report_date: date,
            show_id: s.showId,
            movie_id: movieId,
            source_movie_id: s.sourceMovieId,
            show_local: s.local,
            show_date_local: s.dateLocal,
            show_time_local: s.timeLocal,
            format: s.format,
            language: s.language,
            theater: s.theater,
            city: s.city,
            state: s.state,
            chain: s.chain,
            sold: s.sold,
            seats: s.seats,
            price: s.price,
            gross: s.gross,
            occupancy_source: s.occupancySource,
            synced_at: syncedAt
          });
        }
      }
      if (kind === 'advance' && date >= today) {
        snapRows.push({
          movie_id: movieId,
          show_date: date,
          captured_on: today,
          captured_at: syncedAt,
          source_etag: got.etag,
          gross: a.gross,
          tickets: a.tickets,
          seats: a.seats,
          shows: a.shows,
          theatres: a.theatres,
          cities: a.cities,
          states: a.states,
          dims: { state: a.dims.state, chain: a.dims.chain, format: a.dims.format, language: a.dims.language, format_language: a.dims.format_language }
        });
      }
    }

    for (const c of chunks(dayRows, 100)) await must(db.from('us_movie_day').upsert(c, { onConflict: 'movie_id,kind,report_date' }), 'us_movie_day');
    for (const c of chunks(dimRows, 50)) await must(db.from('us_movie_breakdown').upsert(c, { onConflict: 'movie_id,kind,report_date,dimension' }), 'us_movie_breakdown');
    if (keepShows && aggs.size) {
      await must(db.from('us_show').delete().eq('kind', kind).eq('report_date', date).in('movie_id', [...aggs.keys()]), 'us_show delete');
      for (const c of chunks(showRows, 500)) await must(db.from('us_show').insert(c), 'us_show insert');
    }
    // First capture of the day only (never overwritten): DoD compares
    // captures taken at the same point of consecutive US days.
    for (const c of chunks(snapRows, 50)) await must(db.from('us_advance_snapshot').upsert(c, { onConflict: 'movie_id,show_date,captured_on', ignoreDuplicates: true }), 'us_advance_snapshot');
    if (aggs.size && !opts.skipReleaseDays) await refreshReleaseDays([...aggs.keys()], movies);

    const rowsImported = [...aggs.values()].reduce((a, x) => a + x.shows, 0);
    await must(
      db.from('us_sync_file').upsert(
        { kind, report_date: date, url: got.url, etag: got.etag, first_seen_at: seenAt, last_checked_at: syncedAt, synced_at: syncedAt, status: 'ok', movies_total: file.summary.length, movies_imported: aggs.size, rows_total: file.shows.length, rows_imported: rowsImported, error: null },
        { onConflict: 'kind,report_date' }
      ),
      'us_sync_file'
    );
    const writes = mapWrites + dayRows.length + dimRows.length + showRows.length + snapRows.length + 1;
    return { kind, date, status: 'ok', requests, writes, listings: mapWrites, movies: file.summary.length, imported: aggs.size, rows: file.shows.length, rowsImported, showsStored: showRows.length, snapshots: snapRows.length, mismatches };
  } catch (err: any) {
    const message = String(err?.message ?? err).slice(0, 500);
    await db.from('us_sync_file').upsert({ kind, report_date: date, url: '', status: 'error', error: message, synced_at: new Date().toISOString() }, { onConflict: 'kind,report_date' });
    return { kind, date, status: 'error', error: message };
  }
}

// Where each stored number comes from (us_movie_day.metric_origin).
export const METRIC_ORIGIN = {
  gross: { origin: 'DERIVED', formula: 'sum of show gross (source gross = sold x price per show); equals source summary gross' },
  tickets: { origin: 'DERIVED', formula: 'sum of show sold; equals source summary sold' },
  seats: { origin: 'DERIVED', formula: 'sum of show seats; equals source summary seats' },
  shows: { origin: 'DERIVED', formula: 'count of imported show rows' },
  shows_source: { origin: 'SOURCE', formula: 'summary show count (can differ from the row count)' },
  occupancy: { origin: 'DERIVED', formula: 'sold on shows with seats / seats x 100 (zero-seat shows excluded)' },
  occupancy_source: { origin: 'SOURCE', formula: 'summary occupancy (not seat-weighted)' },
  theatres: { origin: 'DERIVED', formula: 'distinct theater name + city + state' },
  cities: { origin: 'DERIVED', formula: 'distinct city + state' },
  states: { origin: 'DERIVED', formula: 'distinct state' },
  release_day: { origin: 'DERIVED', formula: 'Day 1 = first US box-office date on/after India Day 1; Day 0 = the date before' },
  atp: { origin: 'DERIVED', formula: 'gross / tickets' },
  dod: { origin: 'DERIVED', formula: 'advance: capture(show date, day) - capture(show date, previous day)' },
  source_updated_at: { origin: 'UNAVAILABLE', formula: 'the source publishes no timestamp; source_seen_at = when Fyre first saw this ETag' }
};

// release_day for every stored row of these movies.
export async function refreshReleaseDays(movieIds: string[], movies?: Awaited<ReturnType<typeof loadTrackedMovies>>) {
  const list = movies ?? (await loadTrackedMovies());
  const india = new Map(list.map((m) => [m.movieId, m.indiaDayOne]));
  for (const id of movieIds) {
    const rows = await must<any[]>(db.from('us_movie_day').select('kind,report_date,release_day').eq('movie_id', id), 'us_movie_day days');
    const dayOne = usDayOne(rows.filter((r) => r.kind === 'boxoffice').map((r) => r.report_date), india.get(id) ?? null);
    for (const r of rows) {
      const want = usReleaseDay(r.report_date, dayOne);
      if (want !== r.release_day) await must(db.from('us_movie_day').update({ release_day: want }).eq('movie_id', id).eq('kind', r.kind).eq('report_date', r.report_date), 'release_day');
    }
  }
}

// One USA sync at a time: a lease row in bf_sync_state. A second
// invocation while one is running (or within the lease) does nothing.
export async function acquireUsLock(ms = 120_000): Promise<string | null> {
  const now = new Date();
  const token = `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  const value = { token, until: new Date(now.getTime() + ms).toISOString() };
  const { data } = await db.from('bf_sync_state').update({ value, updated_at: now.toISOString() }).eq('key', 'us_sync_lock').lt('value->>until', now.toISOString()).select('key');
  if (data?.length) return token;
  const { error } = await db.from('bf_sync_state').insert({ key: 'us_sync_lock', value, updated_at: now.toISOString() });
  return error ? null : token;
}

export async function releaseUsLock(token: string) {
  await db.from('bf_sync_state').update({ value: { token: null, until: new Date(0).toISOString() }, updated_at: new Date().toISOString() }).eq('key', 'us_sync_lock').eq('value->>token', token);
}

// The files a scheduled run looks at: box office for today and (until it
// is final) yesterday; advance for today and the next three days.
export function defaultUsTargets(now: Date = new Date()): { kind: UsKind; date: string }[] {
  const today = usToday(now);
  const out: { kind: UsKind; date: string }[] = [];
  const y = usToday(now, -1);
  if (!usFinal(y, now)) out.push({ kind: 'boxoffice', date: y });
  out.push({ kind: 'boxoffice', date: today });
  for (let i = 0; i <= 3; i++) out.push({ kind: 'advance', date: usToday(now, i) });
  return out;
}

// USA history for ids the admin matched later. One pass over the dates,
// oldest first: each date file is fetched ONCE and imported for every
// pending movie that needs it (never one request per movie). Resumes on
// the next run where the deadline stopped it; finished ids are never
// fetched again.
// A Fyre movie's USA history range, written once its USA import is done.
export async function recordUsHistory(movieId: string, range: { start: string; clamped: boolean }) {
  const { data } = await db.from('us_movie_day').select('report_date').eq('movie_id', movieId).eq('kind', 'boxoffice').order('report_date').limit(1);
  const first = data?.[0]?.report_date ?? null;
  await db
    .from('fyre_tracked_movie')
    .update({ us_history_start_date: first, us_history_complete: historyComplete(first, range) })
    .eq('moviemint_id', movieId)
    .then(() => undefined, () => undefined);
}

// 90-day rule: never before today - 89 days (lib/catalog/core). Waits while
// the catalog bootstrap is importing the same dates.
export async function processUsBackfills(deadline: number): Promise<{ sourceMovieId: number; status: string; next?: string }[]> {
  if (await bootstrapRunning()) return [];
  const rows = await must<any[]>(db.from('us_movie_map').select('source_movie_id,movie_id,first_date,last_date,backfill_next').eq('backfill_status', 'requested').eq('match_status', 'matched'), 'us_movie_map backfills');
  if (!rows.length) return [];
  const movies = await loadTrackedMovies();
  const today = usToday();
  const floor = windowStart(today);
  const from = (r: any): string => {
    const f = r.backfill_next ?? r.first_date ?? today;
    return f < floor ? floor : f;
  };
  const to = (r: any): string => r.last_date ?? today;
  let date = rows.map(from).sort()[0];
  const end = rows.map(to).sort().pop()!;
  const touched = new Set<string>();
  while (date <= end && Date.now() < deadline) {
    const ids = new Set(rows.filter((r) => from(r) <= date && date <= to(r)).map((r) => r.movie_id as string));
    if (ids.size) {
      for (const kind of ['boxoffice', 'advance'] as UsKind[]) {
        const res = await syncUsFile(kind, date, { onlyMovieIds: ids, includeEnded: true, movies, skipReleaseDays: true });
        if (res.status === 'error') throw new Error(`${kind} ${date}: ${res.error}`);
      }
      ids.forEach((id) => touched.add(id));
    }
    date = addDays(date, 1);
  }
  if (touched.size) await refreshReleaseDays([...touched], movies);
  const out: { sourceMovieId: number; status: string; next?: string }[] = [];
  for (const r of rows) {
    const done = date > to(r);
    const next = done ? null : from(r) > date ? from(r) : date;
    await must(db.from('us_movie_map').update({ backfill_status: done ? 'done' : 'requested', backfill_next: next }).eq('source_movie_id', r.source_movie_id), 'us_movie_map backfill');
    if (done && r.movie_id) {
      const start = r.first_date && r.first_date > floor ? r.first_date : floor;
      await recordUsHistory(r.movie_id, { start, clamped: start === floor });
    }
    out.push({ sourceMovieId: r.source_movie_id, status: done ? 'done' : 'running', next: next ?? undefined });
  }
  return out;
}

export async function runUsRetention(dryRun = false) {
  const { data, error } = await db.rpc('us_prune', {
    p_breakdown_days: US_BREAKDOWN_DAYS,
    p_detail_days: US_DETAIL_DAYS,
    p_show_days: US_SHOW_DAYS,
    p_snapshot_days: US_SNAPSHOT_DAYS,
    p_dry_run: dryRun
  });
  if (error) throw new Error(`us_prune: ${error.message}`);
  return data;
}
