// MovieMint India page data -> Fyre's stored shapes. Pure, unit-tested.
//
// Rows go to mmi_movie_day / mmi_movie, which use EXACTLY the column layout
// of bf_movie_day / bf_movie (totals + breakdown JSON, city tuples in the
// same positions), so every existing reader works on them unchanged. What
// differs is only where the figures come from: MovieMint, never BFILMY.
//
// Day totals come from MovieMint's own day series (the figures MovieMint
// shows for each day and sums into its cumulative). A per-date page adds
// what the series lacks for that date -- seat count on a live day, fast-
// filling / housefull, venues, city/state counts, languages, formats -- and
// the day's breakdown lists. Nothing is estimated: a figure MovieMint does
// not give stays null and is shown as unavailable.
import type { MmiDay, MmiKind, MmiNamed, MmiPage, MmiSeriesPoint } from './parse';

export type StoredTotals = {
  gross: number;
  sold: number;
  shows: number;
  totalSeats: number | null;
  fastfilling: number | null;
  housefull: number | null;
  occupancy: number | null;
  cities: number | null;
  states: number | null;
  venues: number | null;
  languages: string[];
  formats: string[];
};

export type CityTuple = [string, string | null, number, number, number, number | null, number | null, number | null, number | null];

export type StoredNamed = {
  name: string;
  gross: number;
  sold: number;
  shows: number;
  totalSeats: number | null;
  fastfilling: number | null;
  housefull: number | null;
  occupancy: number | null;
  venues: number | null;
};

export type StoredBreakdown = {
  entries: never[];
  states: StoredNamed[];
  cities: CityTuple[];
  chains: never[];
  languages: StoredNamed[];
  formats: StoredNamed[];
  territories: (StoredNamed & { subRegion: boolean })[];
  source: string | null; // MovieMint's stated underlying source
};

export type BreakdownStatus = 'none' | 'live' | 'final';

export type DayRow = {
  slug: string;
  moviemint_id: string;
  kind: MmiKind;
  date: string;
  title: string;
  totals: StoredTotals;
  source_updated: string | null;
  in_source: boolean;
  totals_synced_at: string;
  // present only when this row carries a breakdown
  breakdown?: StoredBreakdown;
  breakdown_status?: BreakdownStatus;
  breakdown_synced_at?: string;
};

export type Ctx = { slug: string; moviemintId: string; title: string; now: string; today: string };

const r2 = (v: number) => Math.round(v * 100) / 100;

export function occupancyOf(sold: number, seats: number | null, fallback: number | null): number | null {
  if (seats != null && seats > 0) return r2((sold / seats) * 100);
  return fallback == null ? null : r2(fallback);
}

function named(r: MmiNamed): StoredNamed {
  return {
    name: r.name,
    gross: r.gross,
    sold: r.sold,
    shows: r.shows,
    totalSeats: r.seats,
    fastfilling: r.ff,
    housefull: r.hf,
    occupancy: occupancyOf(r.sold, r.seats, r.occupancy),
    venues: r.venues
  };
}

export function toBreakdown(day: MmiDay): StoredBreakdown {
  return {
    entries: [],
    states: day.states.map(named),
    cities: day.cities.map((c) => [c.name, c.state, c.gross, c.sold, c.shows, c.seats, c.ff, c.hf, c.venues] as CityTuple),
    chains: [],
    languages: day.languages.map(named),
    formats: day.formats.map(named),
    territories: day.territories.map((t) => ({ ...named(t), subRegion: t.subRegion })),
    source: day.source
  };
}

// Totals for one date: the series point's figures (MovieMint's day total),
// with what the series lacks filled from the same date's day block or from
// what was stored before. Never mixes two different dates.
export function mergeTotals(point: MmiSeriesPoint | null, day: MmiDay | null, stored: Partial<StoredTotals> | null): StoredTotals {
  const s = day?.summary ?? null;
  const gross = point ? point.gross : s ? s.gross : Number(stored?.gross ?? 0);
  const sold = point ? point.sold : s ? s.sold : Number(stored?.sold ?? 0);
  const shows = point ? point.shows : s ? s.shows : Number(stored?.shows ?? 0);
  // Seats: the series' own count when it has one; else the day block's,
  // but only when the block reports the same tickets (same moment), so
  // occupancy never mixes two snapshots.
  const sameMoment = !!s && (!point || (s.sold === point.sold && Math.abs(s.gross - point.gross) < 1));
  const seats = point?.seats ?? (sameMoment ? s!.seats : null) ?? (stored && Number(stored.sold) === sold ? (stored.totalSeats ?? null) : null);
  const pick = <K extends keyof StoredTotals>(k: K, fromDay: StoredTotals[K] | null | undefined): StoredTotals[K] | null => {
    if (day && fromDay != null) return fromDay;
    const prev = stored?.[k];
    return prev == null ? null : (prev as StoredTotals[K]);
  };
  return {
    gross,
    sold,
    shows,
    totalSeats: seats,
    fastfilling: pick('fastfilling', s?.ff ?? undefined),
    housefull: pick('housefull', s?.hf ?? undefined),
    occupancy: occupancyOf(sold, seats, point?.occupancy ?? s?.occupancy ?? null),
    cities: pick('cities', s ? s.cities : undefined),
    states: pick('states', s ? s.states : undefined),
    venues: pick('venues', s?.venues ?? undefined),
    languages: day ? day.languages.map((l) => l.name) : (stored?.languages ?? []),
    formats: day ? day.formats.map((f) => f.name) : (stored?.formats ?? [])
  };
}

const IST_DAY_END_HOUR = 23;

// Is a day block "final" (the day is over) rather than a live snapshot?
// MovieMint stamps every figure with its update time; a box-office day is
// final once its date is before today (IST) and the stamp is from late on
// that day or later.
export function isFinalDay(kind: MmiKind, date: string, today: string, lastUpdated: string | null): boolean {
  if (kind === 'advance') return false;
  if (date >= today) return false;
  if (date <= addDays(today, -2)) return true; // two days on, nothing newer will come
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/.exec(lastUpdated ?? '');
  if (!m) return true; // past date, no stamp: MovieMint has nothing newer for it
  if (m[1] > date) return true;
  return m[1] === date && Number(m[2]) >= IST_DAY_END_HOUR;
}

// Every stored row a fetched page yields.
//  - box-office page: one totals row per series date (all MovieMint
//    dates), and the selected date's breakdown when MovieMint's own series
//    includes that date (a date MovieMint leaves out of its series -- e.g.
//    a below-threshold day -- is never added from the side block)
//  - advance page: one row for the selected show date
export function pageRows(page: MmiPage, ctx: Ctx, stored: Map<string, Partial<StoredTotals>>): DayRow[] {
  const out: DayRow[] = [];
  const day = page.day;
  if (page.kind === 'boxoffice') {
    for (const p of page.series) {
      const sameDay = day && day.date === p.date ? day : null;
      out.push({
        slug: ctx.slug,
        moviemint_id: ctx.moviemintId,
        kind: 'boxoffice',
        date: p.date,
        title: ctx.title,
        totals: mergeTotals(p, sameDay, stored.get(`boxoffice:${p.date}`) ?? null),
        source_updated: p.lastUpdated ?? sameDay?.lastUpdated ?? null,
        in_source: true,
        totals_synced_at: ctx.now,
        ...(sameDay
          ? {
              breakdown: toBreakdown(sameDay),
              breakdown_status: isFinalDay('boxoffice', sameDay.date, ctx.today, sameDay.lastUpdated) ? ('final' as const) : ('live' as const),
              breakdown_synced_at: ctx.now
            }
          : {})
      });
    }
    return out;
  }
  if (day && day.summary.shows > 0) {
    out.push({
      slug: ctx.slug,
      moviemint_id: ctx.moviemintId,
      kind: 'advance',
      date: day.date,
      title: ctx.title,
      totals: mergeTotals(null, day, null),
      source_updated: day.lastUpdated,
      in_source: true,
      totals_synced_at: ctx.now,
      breakdown: toBreakdown(day),
      breakdown_status: 'live',
      breakdown_synced_at: ctx.now
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Movie summary (mmi_movie) -- the same fields bf_refresh_movies computes,
// with Day 1 taken from MovieMint's own release date.
// ---------------------------------------------------------------------------

export type StoredDay = {
  kind: MmiKind;
  date: string;
  totals: Partial<StoredTotals>;
  breakdown?: Partial<StoredBreakdown> | null;
  breakdown_status: BreakdownStatus;
  source_updated: string | null;
  synced_at?: string | null;
};

export type MovieMeta = {
  slug: string;
  moviemintId: string;
  title: string;
  poster: string | null;
  language: string | null;
  releaseDate: string | null;
  availableDates: string[];
};

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function rank(days: StoredDay[], list: 'languages' | 'formats'): string[] {
  const sum = new Map<string, number>();
  for (const d of days) for (const r of (d.breakdown?.[list] ?? []) as StoredNamed[]) if (r?.name) sum.set(r.name, (sum.get(r.name) ?? 0) + (Number(r.gross) || 0));
  if (sum.size) return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  // No breakdowns yet: names from the day totals, most recent first.
  const seen: string[] = [];
  for (const d of [...days].reverse()) for (const n of (d.totals[list] ?? []) as string[]) if (!seen.includes(n)) seen.push(n);
  return seen;
}

const snap = (d: StoredDay) => ({ date: d.date, ...d.totals });

export function movieRow(meta: MovieMeta, days: StoredDay[], today: string) {
  const bo = days.filter((d) => d.kind === 'boxoffice').sort((a, b) => a.date.localeCompare(b.date));
  const adv = days.filter((d) => d.kind === 'advance').sort((a, b) => a.date.localeCompare(b.date));
  const first = bo[0]?.date ?? null;
  const last = bo[bo.length - 1]?.date ?? null;
  const rel = meta.releaseDate;
  // Tracking began after the release (an older film MovieMint picked up
  // later): totals are a tracked period, never lifetime, and no Day numbers.
  const carriedOver = !!(first && rel && first > addDays(rel, 1));
  const releaseDate = first ? (carriedOver ? null : rel && rel >= first ? rel : first) : (rel ?? adv[0]?.date ?? null);
  const premiere = releaseDate && first && !carriedOver && bo.some((d) => d.date === addDays(releaseDate, -1)) ? addDays(releaseDate, -1) : null;
  const sum = (k: 'gross' | 'sold' | 'shows' | 'totalSeats') => bo.reduce((a, d) => a + (Number(d.totals[k]) || 0), 0);
  const best = bo.length ? bo.reduce((b, d) => ((Number(d.totals.gross) || 0) > (Number(b.totals.gross) || 0) ? d : b)) : null;
  const upcomingAdv = adv.find((d) => d.date >= (first ? addDays(today, 1) : today)) ?? adv[adv.length - 1] ?? null;
  // Gaps: dates inside the run MovieMint has no figures for (today excluded
  // -- it may simply not have started).
  const have = new Set(bo.map((d) => d.date));
  const missing: string[] = [];
  if (first && last) for (let d = first; d < last; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  const latestStamp = [...days].sort((a, b) => (a.synced_at ?? '').localeCompare(b.synced_at ?? '') || a.date.localeCompare(b.date)).pop();
  const languages = rank(bo.length ? bo : adv, 'languages');
  return {
    slug: meta.slug,
    moviemint_id: meta.moviemintId,
    title: meta.title,
    languages: languages.length ? languages : meta.language ? [meta.language] : [],
    formats: rank(bo.length ? bo : adv, 'formats'),
    poster: meta.poster,
    release_date: releaseDate,
    premiere_date: premiere,
    carried_over: carriedOver,
    first_date: first,
    last_date: last,
    days_tracked: bo.length,
    total_gross: Math.round(sum('gross') * 100) / 100,
    total_sold: sum('sold'),
    total_shows: sum('shows'),
    total_seats: sum('totalSeats'),
    latest: bo.length ? snap(bo[bo.length - 1]) : null,
    best: best ? snap(best) : null,
    advance: upcomingAdv ? snap(upcomingAdv) : null,
    advance_date: adv[adv.length - 1]?.date ?? null,
    source_updated: latestStamp?.source_updated ?? null,
    breakdown_days: bo.filter((d) => d.breakdown_status === 'final').length,
    missing_dates: missing,
    available_dates: meta.availableDates,
    updated_at: new Date().toISOString()
  };
}

export type MovieRow = ReturnType<typeof movieRow>;
