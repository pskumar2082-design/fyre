import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchMovieMintPage, type MovieMintFetchResult } from '@/lib/moviemintClient';
import { closeSharedBrowser, NAVIGATION_TIMEOUT_MS, DATA_WAIT_TIMEOUT_MS } from '@/lib/moviemintBrowserRenderer';
import {
  htmlToLines,
  parseMovieMeta,
  parseAdvanceStats,
  parseTrackedStats,
  parseBreakdownTable,
  parseListingSlugs,
  parseMultiplexReport,
  type ParsedMovieMeta
} from '@/lib/moviemintParser';
import {
  mapAdvanceSnapshot,
  mapTrackedSnapshot,
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
// Source isolation, enforced throughout:
//   - Every row this writes carries source = 'moviemint' (or is scoped to
//     it via the unique constraints added in migration_moviemint.sql).
//   - Sacnilk's rows (source = 'sacnilk'/'manual' in box_office_breakdown,
//     everything in daily_collections, every now_showing.lifetime_*/
//     advance_* column) are never read for comparison and never written
//     to by this file. A MovieMint sync run cannot touch a Sacnilk row --
//     they don't share a conflict target, full stop.
//   - Per Phase 7 of the brief: now_showing's existing lifetime_*/advance_*
//     scalar columns are NOT written here at all, even for movies matched
//     to MovieMint. MovieMint's numbers live only in source_snapshots and
//     box_office_breakdown (source='moviemint'); the frontend reads those
//     directly for MovieMint-attributed sections. That's a deliberate,
//     temporary scope limit until source-priority rules are approved
//     separately, not an oversight.
// ---------------------------------------------------------------------------

export type SyncMovieMintSummary = {
  slugsSeen: number;
  matched: number;
  unmatched: number;
  moviesUpdated: string[]; // titles
  snapshotsInserted: number;
  snapshotsSkippedDuplicate: number;
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
  const { data, error } = await supabaseAdmin.from('now_showing').select('id, title, release_date, language, moviemint_slug');
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

async function matchAndPersistSlug(
  nowShowingRows: NowShowingRow[],
  meta: ParsedMovieMeta,
  slug: string
): Promise<{ movieId: string } | null> {
  const bySlug = nowShowingRows.find((r) => r.moviemint_slug === slug);
  if (bySlug) return { movieId: bySlug.id };

  const result = resolveMatchCandidates(nowShowingRows, meta);
  if (result.outcome === 'matched') {
    await supabaseAdmin.from('now_showing').update({ moviemint_slug: slug }).eq('id', result.movieId);
    return { movieId: result.movieId };
  }

  const candidateIds = result.outcome === 'ambiguous' ? result.candidateIds : [];
  await logMatchReview(meta, slug, result.reason, candidateIds);
  return null;
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
  if (error) throw new Error(`source_snapshots insert: ${error.message}`);
  summary.snapshotsInserted++;
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

  const lines = htmlToLines(page.html);
  const meta = parseMovieMeta(lines);
  if (!meta.title) {
    summary.errors.push({ context: `movie/${slug}?kind=${kind}`, message: 'could not parse a title from the page' });
    return;
  }

  const match = await matchAndPersistSlug(nowShowingRows, meta, slug);
  if (!match) {
    summary.unmatched++;
    return;
  }
  summary.matched++;

  const stats = kind === 'advance' ? parseAdvanceStats(lines) : parseTrackedStats(lines);
  const mappedSnapshot = kind === 'advance' ? mapAdvanceSnapshot(stats as any) : mapTrackedSnapshot(stats as any);
  await upsertSnapshotIfChanged(match.movieId, mappedSnapshot, summary);

  const dayLabelText = kind === 'advance' ? (stats as any).dayLabelText : (stats as any).dayLabelText;
  const dayDate = parseDayLabelDate(dayLabelText) ?? todayIso();

  const breakdown = parseBreakdownTable(page.html);
  const mappedRows = breakdown.rows.map(mapBreakdownRow);
  await upsertBreakdownRows(match.movieId, kind, dayDate, mappedRows, summary);

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
// "Refresh" button); omitted, it discovers from the /advance and /tracked
// top-10 listings, same "what's currently worth tracking" scope Sacnilk's
// discoverMovies() uses, not a full historical crawl.
// ---------------------------------------------------------------------------
// A full run processes at most this many movies -- the /advance + /tracked
// top-10 listings overlap heavily, so this is a generous ceiling on "what's
// currently worth tracking," not a real-world limit, and it keeps a single
// misbehaving sync from opening dozens of renders in one invocation.
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
        const page = await fetchMovieMintPage(path);
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
