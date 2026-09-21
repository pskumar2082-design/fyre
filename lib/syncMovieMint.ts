import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchMovieMintPage, type MovieMintFetchResult } from '@/lib/moviemintClient';
import { closeSharedBrowser, NAVIGATION_TIMEOUT_MS, DATA_WAIT_TIMEOUT_MS } from '@/lib/moviemintBrowserRenderer';
import {
  parseMovieMeta,
  parsePosterUrl,
  parseAdvanceStats,
  parseTrackedStats,
  parseDailySeries,
  parseBreakdownTable,
  parseListingSlugs,
  parseMultiplexReport,
  type ParsedMovieMeta,
  type ParsedAdvanceStats,
  type ParsedTrackedStats
} from '@/lib/moviemintParser';
import {
  mapAdvanceSnapshot,
  mapTrackedSnapshot,
  mapDailySeriesEntry,
  mapBreakdownRow,
  mapMultiplexChain,
  normalizeTitleForMatch,
  type MappedSnapshot
} from '@/lib/moviemintMapper';

// ---------------------------------------------------------------------------
// Orchestration only: movie matching, persistence, snapshots, breakdown
// upserts, provenance, error isolation. Fetching is moviemintClient.ts's
// job, parsing is moviemintParser.ts's, semantic mapping is
// moviemintMapper.ts's -- this file wires them together and is the only
// one of the four that touches Supabase.
//
// Source isolation:
//   - Every box_office_breakdown/source_snapshots/multiplex_breakdown row
//     this writes carries source = 'moviemint' (or is scoped to it via the
//     unique constraints added in migration_moviemint.sql).
//   - Sacnilk is discontinued (2026-09) -- fyre no longer syncs from it at
//     all (app/api/sync-boxoffice and app/api/admin-sync-boxoffice are
//     unused now). MovieMint is the sole box-office source: this file both
//     DISCOVERS movies (inserting a new now_showing/upcoming row for a
//     slug fyre has never seen -- see createNowShowingFromMovieMint) and
//     writes now_showing's lifetime_*/advance_* scalar columns directly
//     (see updateNowShowingTopLine), which earlier versions of this file
//     deliberately left untouched while Sacnilk still owned them.
// ---------------------------------------------------------------------------

export type SyncMovieMintSummary = {
  slugsSeen: number;
  matched: number;
  unmatched: number;
  moviesUpdated: string[]; // titles
  snapshotsInserted: number;
  snapshotsSkippedDuplicate: number;
  dailySeriesInserted: number; // historical source_snapshots rows backfilled from a movie's dailySeries
  dailySeriesSkippedDuplicate: number;
  breakdownsUpserted: number;
  multiplexRowsUpserted: number;
  errors: { context: string; message: string }[];
  // Set when the run stopped early because MAX_MOVIES_PER_RUN or the
  // soft time budget was hit -- so a caller/admin can tell "finished"
  // apart from "cut short, run it again to pick up the rest."
  truncated: { reason: 'max_movies' | 'time_budget'; slugsRemaining: number } | null;
};

type NowShowingRow = {
  id: string;
  title: string;
  release_date: string | null;
  language: string | null;
  moviemint_slug: string | null;
  source_synced_at: string | null;
  image_url: string | null;
};

// ---------------------------------------------------------------------------
// Matching -- pure function, no DB, so it's directly testable. Preferred
// order per the brief:
//   1. exact moviemint_slug mapping (caller checks this before calling in,
//      via candidateRows already filtered/including the slug match)
//   2. normalized title + release date
//   3. normalized title + language + release date
//   4. otherwise: ambiguous or no match -> caller logs to the review queue
//
// Never returns a single match when more than one candidate is plausible
// at whichever step produced candidates -- that's "ambiguous", not "close
// enough".
// ---------------------------------------------------------------------------
export type MatchResult =
  | { outcome: 'matched'; movieId: string; via: 'slug' | 'title+date' | 'title+language+date' }
  | { outcome: 'ambiguous'; candidateIds: string[]; reason: string }
  | { outcome: 'none'; reason: string };

function parseReleaseDateText(text: string | null): string | null {
  // "Release: August 7, 2026" -> "2026-08-07"
  if (!text) return null;
  const m = text.match(/Release:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const parsed = new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function resolveMatchCandidates(rows: NowShowingRow[], meta: ParsedMovieMeta): MatchResult {
  const bySlug = rows.find((r) => false); // slug is checked by the caller before this is reached
  void bySlug;

  const normTarget = meta.title ? normalizeTitleForMatch(meta.title) : '';
  if (!normTarget) return { outcome: 'none', reason: 'no title parsed from MovieMint page' };

  const releaseDate = parseReleaseDateText(meta.releaseDateText);
  const titleMatches = rows.filter((r) => normalizeTitleForMatch(r.title) === normTarget);

  if (titleMatches.length === 0) {
    return { outcome: 'none', reason: `no now_showing row with normalized title "${normTarget}"` };
  }

  if (releaseDate) {
    const titleAndDate = titleMatches.filter((r) => r.release_date === releaseDate);
    if (titleAndDate.length === 1) {
      return { outcome: 'matched', movieId: titleAndDate[0].id, via: 'title+date' };
    }
    if (titleAndDate.length > 1) {
      // Same title AND same release date on more than one row -- genuinely
      // ambiguous (e.g. a dubbed re-release entered twice), don't guess.
      if (meta.language) {
        const normLang = meta.language.trim().toLowerCase();
        const titleDateLang = titleAndDate.filter((r) => (r.language ?? '').trim().toLowerCase() === normLang);
        if (titleDateLang.length === 1) {
          return { outcome: 'matched', movieId: titleDateLang[0].id, via: 'title+language+date' };
        }
      }
      return {
        outcome: 'ambiguous',
        candidateIds: titleAndDate.map((r) => r.id),
        reason: `${titleAndDate.length} now_showing rows share title "${normTarget}" and release date ${releaseDate}`
      };
    }
    // Title matched, but no row shares this exact release date -- try
    // title + language alone as the next rung, rather than assuming none
    // of the title matches are right (FYRE's release_date can be a few
    // days off from MovieMint's on some rows).
  }

  if (meta.language) {
    const normLang = meta.language.trim().toLowerCase();
    const titleAndLang = titleMatches.filter((r) => (r.language ?? '').trim().toLowerCase() === normLang);
    if (titleAndLang.length === 1) {
      return { outcome: 'matched', movieId: titleAndLang[0].id, via: 'title+language+date' };
    }
    if (titleAndLang.length > 1) {
      return {
        outcome: 'ambiguous',
        candidateIds: titleAndLang.map((r) => r.id),
        reason: `${titleAndLang.length} now_showing rows share title "${normTarget}" and language "${meta.language}"`
      };
    }
  }

  if (titleMatches.length === 1) {
    // Title alone is unique across all of now_showing and nothing above
    // contradicted it (either no release date was parseable, or FYRE's
    // date just doesn't line up) -- accept it, since "multiple plausible
    // candidates" is the case this function refuses, not "only one
    // candidate but with slightly imperfect corroborating fields".
    return { outcome: 'matched', movieId: titleMatches[0].id, via: 'title+date' };
  }

  return {
    outcome: 'ambiguous',
    candidateIds: titleMatches.map((r) => r.id),
    reason: `${titleMatches.length} now_showing rows share title "${normTarget}" with no release date/language to disambiguate`
  };
}

// ---------------------------------------------------------------------------
// Duplicate-snapshot prevention -- pure comparison, testable without DB.
// "Nothing changed" means every metric AND the source's own freshness
// text are identical to the immediately preceding snapshot for this
// movie/source/kind/market.
// ---------------------------------------------------------------------------
export function shouldInsertSnapshot(prev: MappedSnapshot | null, next: MappedSnapshot): boolean {
  if (!prev) return true;
  const fields: (keyof MappedSnapshot)[] = ['gross', 'tickets', 'shows', 'theatres', 'cities', 'capacity', 'occupancy'];
  const metricsChanged = fields.some((f) => prev[f] !== next[f]);
  const freshnessChanged = prev.sourceUpdatedText !== next.sourceUpdatedText;
  return metricsChanged || freshnessChanged;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDayLabelDate(text: string | null): string | null {
  // "Advance data: Day 45 — September 20, 2026" / "Breakdown for: Day 44 — September 18, 2026"
  if (!text) return null;
  const m = text.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const parsed = new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function fetchAllNowShowing(): Promise<NowShowingRow[]> {
  const { data, error } = await supabaseAdmin
    .from('now_showing')
    .select('id, title, release_date, language, moviemint_slug, source_synced_at, image_url');
  if (error) throw new Error(`now_showing lookup: ${error.message}`);
  return (data ?? []) as NowShowingRow[];
}

async function logMatchReview(
  meta: ParsedMovieMeta,
  slug: string,
  reason: string,
  candidateIds: string[]
) {
  // Never downgrades a row a human already resolved/ignored -- only touch
  // rows still 'pending' (or not yet seen at all).
  const { data: existing } = await supabaseAdmin
    .from('moviemint_match_review')
    .select('id, status')
    .eq('moviemint_slug', slug)
    .maybeSingle();

  if (existing && existing.status !== 'pending') return;

  await supabaseAdmin.from('moviemint_match_review').upsert(
    {
      moviemint_slug: slug,
      moviemint_title: meta.title ?? '(untitled)',
      moviemint_release_date: parseReleaseDateText(meta.releaseDateText),
      moviemint_language: meta.language,
      candidate_movie_ids: candidateIds,
      reason,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: 'moviemint_slug' }
  );
}

// MovieMint used to only ENRICH movies fyre already had from Sacnilk -- an
// unmatched slug was just logged to moviemint_match_review for a human to
// resolve. Now that MovieMint is fyre's only box-office source, a
// genuinely new title (outcome 'none' -- no title match at all, not an
// ambiguous one) is created directly instead of sitting in a review queue
// forever. An 'ambiguous' outcome (more than one plausible existing row)
// still goes to review -- that's a real judgment call, not "unknown".
async function matchAndPersistSlug(
  nowShowingRows: NowShowingRow[],
  meta: ParsedMovieMeta,
  slug: string,
  posterUrl: string | null
): Promise<{ movieId: string } | null> {
  const bySlug = nowShowingRows.find((r) => r.moviemint_slug === slug);
  if (bySlug) {
    // Only fills a gap -- never overwrites an existing image with a
    // possibly-worse later parse.
    if (posterUrl && !bySlug.image_url) {
      await supabaseAdmin.from('now_showing').update({ image_url: posterUrl }).eq('id', bySlug.id);
      bySlug.image_url = posterUrl;
    }
    return { movieId: bySlug.id };
  }

  const result = resolveMatchCandidates(nowShowingRows, meta);
  if (result.outcome === 'matched') {
    const patch: Record<string, unknown> = { moviemint_slug: slug };
    const matchedRow = nowShowingRows.find((r) => r.id === result.movieId);
    if (posterUrl && !matchedRow?.image_url) patch.image_url = posterUrl;
    await supabaseAdmin.from('now_showing').update(patch).eq('id', result.movieId);
    if (matchedRow) {
      matchedRow.moviemint_slug = slug;
      if (patch.image_url) matchedRow.image_url = posterUrl;
    }
    return { movieId: result.movieId };
  }

  if (result.outcome === 'none') {
    const created = await createNowShowingFromMovieMint(meta, slug, posterUrl);
    if (created) {
      nowShowingRows.push(created);
      return { movieId: created.id };
    }
  }

  const candidateIds = result.outcome === 'ambiguous' ? result.candidateIds : [];
  await logMatchReview(meta, slug, result.reason, candidateIds);
  return null;
}

// Best-effort Rs Cr display text, matching the format every other part of
// fyre already stores in now_showing's lifetime_*/advance_* text columns
// (e.g. "Rs10.52 Cr") -- see lib/movieStatus.ts's collectionCr, which
// parses this same shape back out for ranking.
function formatCr(n: number | null): string {
  if (n == null) return '';
  return `₹${n.toFixed(2)} Cr`;
}

// Same Indian short-form (K/L/Cr) MovieMint's own UI uses for plain
// counts (tickets, shows), so a synced value reads the same as it did on
// moviemintbo.com itself.
function formatCount(n: number | null): string {
  if (n == null) return '';
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} K`;
  return String(Math.round(n));
}

// Inserts a movie MovieMint reports that fyre has never seen before.
// Best-effort: a failed insert (e.g. a genuine race against another call)
// just means this slug gets picked up again on the next sync rather than
// crashing the whole run.
async function createNowShowingFromMovieMint(
  meta: ParsedMovieMeta,
  slug: string,
  posterUrl: string | null
): Promise<NowShowingRow | null> {
  if (!meta.title) return null;
  const releaseDate = parseReleaseDateText(meta.releaseDateText);

  const { data, error } = await supabaseAdmin
    .from('now_showing')
    .insert({
      title: meta.title,
      language: meta.language ?? '',
      genre: meta.genre ?? '',
      release_date: releaseDate,
      image_url: posterUrl,
      moviemint_slug: slug,
      status: '',
      amt: ''
    })
    .select('id, title, release_date, language, moviemint_slug, source_synced_at, image_url')
    .single();

  if (error || !data) return null;

  // A movie with a future release date is also worth surfacing on the
  // lightweight Upcoming countdown -- best-effort, never fatal to the
  // main sync if this one write fails.
  if (releaseDate && new Date(releaseDate).getTime() > Date.now()) {
    await supabaseAdmin
      .from('upcoming')
      .upsert(
        { title: meta.title, release_date: releaseDate, image_url: posterUrl, moviemint_slug: slug },
        { onConflict: 'moviemint_slug' }
      );
  }

  return data as NowShowingRow;
}

// Writes MovieMint's own top-line numbers onto now_showing's
// lifetime_*/advance_* columns. These used to be Sacnilk-only (MovieMint's
// numbers lived solely in source_snapshots/box_office_breakdown) as a
// deliberate, temporary scope limit -- now that Sacnilk is discontinued
// and MovieMint is fyre's only box-office source, that limit no longer
// applies: this is the only place these columns get written at all.
// Never blanks out an existing value just because this tick didn't parse
// a number for some field -- only the keys MovieMint actually reported
// get patched.
async function updateNowShowingTopLine(
  movieId: string,
  kind: 'advance' | 'tracked',
  stats: ParsedAdvanceStats | ParsedTrackedStats
) {
  const patch: Record<string, string | number | null> =
    kind === 'tracked'
      ? (() => {
          const t = stats as ParsedTrackedStats;
          return {
            lifetime_gross: formatCr(t.lifetimeGross),
            lifetime_tickets: formatCount(t.lifetimeTickets),
            lifetime_shows: formatCount(t.lifetimeShows),
            cities: t.cities,
            lifetime_occupancy: t.lifetimeOccupancyPct,
            amt: formatCr(t.lifetimeGross),
            last_day_date: todayIso(),
            source_synced_at: new Date().toISOString()
          };
        })()
      : (() => {
          const a = stats as ParsedAdvanceStats;
          return {
            advance_gross: formatCr(a.gross),
            advance_tickets: formatCount(a.tickets),
            advance_shows: formatCount(a.shows),
            advance_cities: a.cities,
            advance_occupancy: a.occupancyPct
          };
        })();

  for (const k of Object.keys(patch)) {
    if (patch[k] === null || patch[k] === '') delete patch[k];
  }
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabaseAdmin.from('now_showing').update(patch).eq('id', movieId);
  if (error) throw new Error(`now_showing top-line update: ${error.message}`);
}

async function upsertSnapshotIfChanged(movieId: string, mapped: MappedSnapshot, summary: SyncMovieMintSummary) {
  const { data: prevRow } = await supabaseAdmin
    .from('source_snapshots')
    .select('*')
    .eq('movie_id', movieId)
    .eq('source', 'moviemint')
    .eq('kind', mapped.kind)
    .eq('market', mapped.market)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev: MappedSnapshot | null = prevRow
    ? {
        source: 'moviemint',
        kind: prevRow.kind,
        market: prevRow.market,
        sourceCapturedAt: prevRow.source_captured_at,
        gross: prevRow.gross,
        tickets: prevRow.tickets,
        shows: prevRow.shows,
        theatres: prevRow.theatres,
        cities: prevRow.cities,
        capacity: prevRow.capacity,
        occupancy: prevRow.occupancy,
        sourceUpdatedText: prevRow.source_updated_text
      }
    : null;

  if (!shouldInsertSnapshot(prev, mapped)) {
    summary.snapshotsSkippedDuplicate++;
    return;
  }

  const { error } = await supabaseAdmin.from('source_snapshots').insert(buildSnapshotPayload(movieId, mapped));
  if (error) {
    // Same reasoning as backfillDailySeriesSnapshots: the (movie_id,
    // source, kind, market, source_captured_at) unique constraint can
    // already be satisfied by a row backfillDailySeriesSnapshots wrote
    // for this exact captured_at (or a concurrent run), even though the
    // prev-row check above only compared against the latest row. Either
    // way the data's already there, so treat it as a duplicate-skip
    // rather than a hard error.
    if (error.code === '23505') {
      summary.snapshotsSkippedDuplicate++;
      return;
    }
    throw new Error(`source_snapshots insert: ${error.message}`);
  }
  summary.snapshotsInserted++;
}

// Full historical day-by-day data for a movie (see parseDailySeries /
// mapDailySeriesEntry), not just its latest snapshot. Unlike
// upsertSnapshotIfChanged -- which only ever compares against the single
// most recent row, because it's deduping consecutive polls of the SAME
// moment -- this needs to know about every existing row for the movie, so
// a day it already has is never re-inserted while every day it's missing
// gets backfilled. Safe to call every run: once a movie's history is
// fully backfilled, this is one cheap SELECT and no writes.
async function backfillDailySeriesSnapshots(
  movieId: string,
  entries: (MappedSnapshot | null)[],
  summary: SyncMovieMintSummary
) {
  const mapped = entries.filter((e): e is MappedSnapshot => e !== null);
  if (mapped.length === 0) return;

  const { data: existingRows, error: fetchError } = await supabaseAdmin
    .from('source_snapshots')
    .select('source_captured_at')
    .eq('movie_id', movieId)
    .eq('source', 'moviemint')
    .eq('kind', 'tracked');
  if (fetchError) throw new Error(`source_snapshots daily-series lookup: ${fetchError.message}`);

  const existing = new Set((existingRows ?? []).map((r) => r.source_captured_at));
  const missing = mapped.filter((m) => m.sourceCapturedAt && !existing.has(m.sourceCapturedAt));
  if (missing.length === 0) return;

  const payload = missing.map((m) => buildSnapshotPayload(movieId, m));
  const { error: insertError } = await supabaseAdmin.from('source_snapshots').insert(payload);
  if (insertError) {
    // A concurrent run inserting the exact same day between our lookup
    // and this insert is the only expected cause (unique_violation,
    // 23505) -- the data's already there either way, not worth failing
    // the whole sync over. Anything else is a real error worth surfacing.
    if (insertError.code === '23505') {
      summary.dailySeriesSkippedDuplicate += missing.length;
      return;
    }
    throw new Error(`source_snapshots daily-series insert: ${insertError.message}`);
  }
  summary.dailySeriesInserted += payload.length;
}

// Same reasoning as buildBreakdownPayload above.
export function buildSnapshotPayload(movieId: string, mapped: MappedSnapshot) {
  return {
    movie_id: movieId,
    source: mapped.source,
    kind: mapped.kind,
    market: mapped.market,
    source_captured_at: mapped.sourceCapturedAt,
    gross: mapped.gross,
    tickets: mapped.tickets,
    shows: mapped.shows,
    theatres: mapped.theatres,
    cities: mapped.cities,
    capacity: mapped.capacity,
    occupancy: mapped.occupancy,
    source_updated_text: mapped.sourceUpdatedText
  };
}

// Pure builder, split out so a test can assert every MovieMint breakdown
// row carries source: 'moviemint' -- the exact thing that keeps a
// MovieMint sync from ever landing in / colliding with a Sacnilk or
// manually-entered row (see the box_office_breakdown_unique_row
// constraint in supabase/migration_moviemint.sql, which is keyed
// partly on this field) -- without needing a live Supabase connection.
export function buildBreakdownPayload(
  movieId: string,
  kind: 'advance' | 'tracked',
  dayDate: string,
  rows: ReturnType<typeof mapBreakdownRow>[]
) {
  return rows.map((r) => ({
    movie_id: movieId,
    kind,
    breakdown_type: r.breakdownType,
    label: r.label,
    day_date: dayDate,
    gross: r.gross,
    shows: r.shows,
    tickets_sold: r.ticketsSold,
    sold_out: r.soldOut,
    occ_pct: r.occPct,
    raw_ff: r.rawFf,
    source: r.source
  }));
}

async function upsertBreakdownRows(
  movieId: string,
  kind: 'advance' | 'tracked',
  dayDate: string,
  rows: ReturnType<typeof mapBreakdownRow>[],
  summary: SyncMovieMintSummary
) {
  if (rows.length === 0) return;
  const payload = buildBreakdownPayload(movieId, kind, dayDate, rows);
  const { error } = await supabaseAdmin
    .from('box_office_breakdown')
    .upsert(payload, { onConflict: 'movie_id,kind,breakdown_type,label,day_date,source' });
  if (error) throw new Error(`box_office_breakdown upsert: ${error.message}`);
  summary.breakdownsUpserted += payload.length;
}

async function syncOneMovieKind(
  nowShowingRows: NowShowingRow[],
  slug: string,
  kind: 'advance' | 'tracked',
  summary: SyncMovieMintSummary
) {
  const page = await fetchMovieMintPage(`/movie/${slug}?kind=${kind}`);
  if (page.status !== 'ok') {
    summary.errors.push({ context: `movie/${slug}?kind=${kind}`, message: describeFetchFailure(page) });
    return;
  }

  const meta = parseMovieMeta(page.html);
  if (!meta.title) {
    summary.errors.push({ context: `movie/${slug}?kind=${kind}`, message: 'could not parse a title from the page' });
    return;
  }

  const posterUrl = parsePosterUrl(page.html);
  const match = await matchAndPersistSlug(nowShowingRows, meta, slug, posterUrl);
  if (!match) {
    summary.unmatched++;
    return;
  }
  summary.matched++;

  const stats = kind === 'advance' ? parseAdvanceStats(page.html) : parseTrackedStats(page.html);
  const mappedSnapshot = kind === 'advance' ? mapAdvanceSnapshot(stats as any) : mapTrackedSnapshot(stats as any);
  await upsertSnapshotIfChanged(match.movieId, mappedSnapshot, summary);
  await updateNowShowingTopLine(match.movieId, kind, stats as any);

  const dayLabelText = kind === 'advance' ? (stats as any).dayLabelText : (stats as any).dayLabelText;
  const dayDate = parseDayLabelDate(dayLabelText) ?? todayIso();

  const breakdown = parseBreakdownTable(page.html);
  const mappedRows = breakdown.rows.map(mapBreakdownRow);
  await upsertBreakdownRows(match.movieId, kind, dayDate, mappedRows, summary);

  if (kind === 'tracked') {
    // Every completed-day entry MovieMint has for this movie, backfilled
    // once per day (not just today's) -- see backfillDailySeriesSnapshots.
    const dailySeries = parseDailySeries(page.html);
    if (dailySeries.length > 0) {
      await backfillDailySeriesSnapshots(match.movieId, dailySeries.map(mapDailySeriesEntry), summary);
    }
  }

  if (!summary.moviesUpdated.includes(meta.title)) summary.moviesUpdated.push(meta.title);
}

// A non-'ok' MovieMintFetchResult's shape differs by status ('blocked' has
// `reason`, 'error' has `message`, 'render_required' has neither -- it
// just means the page loaded but never showed real data within
// DATA_WAIT_TIMEOUT_MS, see moviemintBrowserRenderer.ts). Centralized here
// so every call site reports something readable instead of
// "render_required: undefined".
function describeFetchFailure(page: Exclude<MovieMintFetchResult, { status: 'ok' }>): string {
  switch (page.status) {
    case 'blocked':
      return `blocked: ${page.reason}`;
    case 'error':
      return `error: ${page.message}`;
    case 'render_required':
      return `render_required: page loaded but did not show recognizable data within the render wait window -- body text at timeout: ${JSON.stringify(page.snippet)}`;
    default: {
      const _exhaustive: never = page;
      return `unknown status: ${JSON.stringify(_exhaustive)}`;
    }
  }
}

async function syncMultiplexReport(nowShowingRows: NowShowingRow[], summary: SyncMovieMintSummary) {
  const page = await fetchMovieMintPage('/multiplex-report');
  if (page.status !== 'ok') {
    summary.errors.push({ context: 'multiplex-report', message: describeFetchFailure(page) });
    return;
  }

  const chains = parseMultiplexReport(page.html);
  const reportDate = todayIso();

  for (const chain of chains) {
    const mappedRows = mapMultiplexChain(chain);
    for (const row of mappedRows) {
      const normTitle = normalizeTitleForMatch(row.rawTitle);
      const candidates = nowShowingRows.filter((r) => normalizeTitleForMatch(r.title) === normTitle);
      const movieId = candidates.length === 1 ? candidates[0].id : null;

      const { error } = await supabaseAdmin.from('multiplex_breakdown').upsert(
        {
          movie_id: movieId,
          raw_title: row.rawTitle,
          chain: row.chain,
          report_date: reportDate,
          gross: row.gross,
          shows: row.shows,
          source: 'moviemint'
        },
        { onConflict: 'chain,report_date,raw_title,source' }
      );
      if (error) {
        summary.errors.push({ context: `multiplex-report:${row.chain}:${row.rawTitle}`, message: error.message });
        continue;
      }
      summary.multiplexRowsUpserted++;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point. `slug` limits the run to one movie (the admin panel's
// "Refresh" button); omitted, it discovers from /advance (top 10) and
// /tracked (MovieMint's full tracked list, scrolled into view -- see
// moviemintBrowserRenderer.ts), creating any now_showing/upcoming row that
// doesn't exist yet (see matchAndPersistSlug) -- not a full historical
// crawl, just "what MovieMint is currently tracking right now."
// ---------------------------------------------------------------------------
// A full run processes at most this many movies per invocation. MovieMint
// tracks dozens of movies at once (/tracked alone runs to 80+), far more
// than one serverless invocation's time budget can render two pages each
// for -- this caps a single run's cost and lets repeated runs (manual
// "Sync now" clicks, or eventually a cron tick) work through the backlog
// incrementally via `truncated` below, rather than trying it all at once.
const MAX_MOVIES_PER_RUN = 20;

// The routes' hard ceiling (see maxDuration in app/api/*-sync-moviemint/
// route.ts) -- once Vercel hits this, the function is killed outright and
// the browser gets Vercel's own error page instead of anything this code
// returns, however good its own try/catch is. Duplicated as a literal
// (not imported) because it's a route-file export, not a value this
// module can read at runtime -- keep the two in sync by hand.
//
// 280000, not 60000: corrected 2026-09-20 after a real production
// FUNCTION_INVOCATION_TIMEOUT at the old 60s value. Verified against
// Vercel's current docs that Hobby plan functions with fluid compute
// support up to 300s max duration for free -- 60s was a stale assumption,
// not a real platform limit. 280000 mirrors the routes' maxDuration = 280.
const HARD_MAX_DURATION_MS = 280000;

// A single render's real worst case: the navigation itself can take up to
// NAVIGATION_TIMEOUT_MS, and if it succeeds, waiting for real data can
// take up to DATA_WAIT_TIMEOUT_MS on top of that (see
// moviemintBrowserRenderer.ts, and the 2026-09-20 production run that
// motivated raising the latter to 25s). A run must never START a render
// that couldn't finish inside the hard ceiling with room to spare.
const WORST_CASE_RENDER_MS = NAVIGATION_TIMEOUT_MS + DATA_WAIT_TIMEOUT_MS;

// Headroom reserved after the LAST render for closeSharedBrowser(),
// whatever DB writes are still pending, and building/returning the JSON
// response -- so a run stops proactively instead of gambling that
// cleanup is instant.
const RESPONSE_OVERHEAD_MS = 5000;

// True only if there's enough time left to attempt one more render and
// still finish (cleanly) inside HARD_MAX_DURATION_MS. This is checked
// before EVERY render this module attempts -- both discovery pages and
// every movie -- not just between movies. A run that runs out of budget
// simply stops early and reports `truncated`; the next click (or, once
// cron is enabled, the next tick) picks up where it left off.
function hasTimeForAnotherRender(startedAt: number): boolean {
  return Date.now() - startedAt + WORST_CASE_RENDER_MS + RESPONSE_OVERHEAD_MS < HARD_MAX_DURATION_MS;
}

export async function syncMovieMint(slug?: string): Promise<SyncMovieMintSummary> {
  const startedAt = Date.now();
  const summary: SyncMovieMintSummary = {
    slugsSeen: 0,
    matched: 0,
    unmatched: 0,
    moviesUpdated: [],
    snapshotsInserted: 0,
    snapshotsSkippedDuplicate: 0,
    dailySeriesInserted: 0,
    dailySeriesSkippedDuplicate: 0,
    breakdownsUpserted: 0,
    multiplexRowsUpserted: 0,
    errors: [],
    truncated: null
  };

  // The browser (if this run ends up needing to render anything -- see
  // moviemintClient.ts's tier order) is launched lazily on first use and
  // reused across every movie below. This is the one place it's closed,
  // in a finally block, so it always happens: on success, on a thrown
  // error, and on an early return from the time/count budget checks.
  try {
    const nowShowingRows = await fetchAllNowShowing();

    let slugs: string[];
    if (slug) {
      slugs = [slug];
    } else {
      const slugSet = new Set<string>();
      for (const path of ['/advance', '/tracked'] as const) {
        if (!hasTimeForAnotherRender(startedAt)) {
          summary.truncated = { reason: 'time_budget', slugsRemaining: 0 };
          break;
        }
        // /tracked is infinite-scroll (84 movies total, ~12 on initial
        // load) -- scroll it into view so discovery isn't stuck seeing
        // only the first screenful every run. /advance is a fixed top-10
        // list with nothing more to scroll for, so it stays at 0.
        const scrollRounds = path === '/tracked' ? 6 : 0;
        const page = await fetchMovieMintPage(path, { scrollRounds });
        if (page.status !== 'ok') {
          summary.errors.push({ context: path, message: describeFetchFailure(page) });
          continue;
        }
        for (const entry of parseListingSlugs(page.html)) {
          if (entry.slug) slugSet.add(entry.slug);
        }
      }
      slugs = Array.from(slugSet);
    }

    summary.slugsSeen = slugs.length;

    // Highest priority: a slug this run just discovered that no
    // now_showing row is linked to yet (brand new, or still pending a
    // match). Next: a linked movie that's never actually completed a
    // 'tracked' sync (source_synced_at null). Last: linked movies sorted
    // oldest-synced-first, so a movie this run doesn't get to still moves
    // up the queue for next time instead of being stuck behind the same
    // handful forever.
    const syncedAtBySlug = new Map<string, string | null>();
    for (const row of nowShowingRows) {
      if (row.moviemint_slug) syncedAtBySlug.set(row.moviemint_slug, row.source_synced_at);
    }
    const priority = (s: string): number => {
      if (!syncedAtBySlug.has(s)) return -2;
      const syncedAt = syncedAtBySlug.get(s);
      return syncedAt ? new Date(syncedAt).getTime() : -1;
    };
    slugs = [...slugs].sort((a, b) => priority(a) - priority(b));

    const slugsToProcess = slugs.slice(0, MAX_MOVIES_PER_RUN);
    if (slugs.length > MAX_MOVIES_PER_RUN) {
      summary.truncated = { reason: 'max_movies', slugsRemaining: slugs.length - MAX_MOVIES_PER_RUN };
    }

    // Sequential, one movie at a time -- deliberately NOT parallelized.
    // The browser is a single shared Chromium process (see
    // moviemintBrowserRenderer.ts); running movies concurrently would mean
    // several pages fighting over the same process's memory/CPU for no
    // real speed benefit at this scale, and it would multiply MovieMint
    // traffic instead of keeping it conservative.
    for (const s of slugsToProcess) {
      if (!hasTimeForAnotherRender(startedAt)) {
        const doneCount = slugsToProcess.indexOf(s);
        summary.truncated = { reason: 'time_budget', slugsRemaining: slugsToProcess.length - doneCount };
        break;
      }
      try {
        await syncOneMovieKind(nowShowingRows, s, 'advance', summary);
      } catch (err: any) {
        summary.errors.push({ context: `movie/${s}?kind=advance`, message: err?.message ?? String(err) });
      }

      // Re-check between a single movie's two renders, not just between
      // movies -- 'advance' alone can already use up most of the budget.
      if (!hasTimeForAnotherRender(startedAt)) {
        const doneCount = slugsToProcess.indexOf(s) + 1;
        summary.truncated = { reason: 'time_budget', slugsRemaining: slugsToProcess.length - doneCount };
        break;
      }

      try {
        await syncOneMovieKind(nowShowingRows, s, 'tracked', summary);
      } catch (err: any) {
        summary.errors.push({ context: `movie/${s}?kind=tracked`, message: err?.message ?? String(err) });
      }
    }

    if (!slug && !summary.truncated && hasTimeForAnotherRender(startedAt)) {
      try {
        await syncMultiplexReport(nowShowingRows, summary);
      } catch (err: any) {
        summary.errors.push({ context: 'multiplex-report', message: err?.message ?? String(err) });
      }
    } else if (!slug && !summary.truncated) {
      // The movie loop finished (nothing left to process) but the clock
      // is too close to HARD_MAX_DURATION_MS to safely start one more
      // render -- report it rather than silently skipping.
      summary.truncated = { reason: 'time_budget', slugsRemaining: 0 };
    }

    return summary;
  } finally {
    await closeSharedBrowser();
  }
}
