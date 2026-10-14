// MovieMint India page data -> Fyre's stored shapes. Pure, unit-tested.
//
// Rows go to mmi_movie_day / mmi_movie, which use the column layout of
// bf_movie_day / bf_movie (totals + breakdown JSON, city tuples in the same
// leading positions), so every existing reader works on them unchanged.
//
// Two kinds of day (mmi_movie_day.day_window):
//   tracked -- a date in MovieMint's own day series (its official tracking
//              window). Totals come from that series: the figures MovieMint
//              shows and sums into its published total.
//   later   -- a day MovieMint captured AFTER the window and leaves out of its
//              own totals (fetched one date at a time). Totals come from that
//              date's report. Never added to the official total.
// A per-date report adds what the series lacks (live-day seats, fast-filling
// / housefull, venues, city and state counts) and the breakdown lists.
// Nothing is estimated: a figure MovieMint does not give stays null.
//
// Occupancy is kept twice, never mixed: `occupancy` = tickets / seats as
// Fyre recomputes it (null without seats); `occupancySource` = MovieMint's
// own published figure.
import type { MmiDay, MmiKind, MmiNamed, MmiPage, MmiSeriesPoint, MmiTerritory } from './parse';

export type DayWindow = 'tracked' | 'later';

export type StoredTotals = {
  gross: number;
  sold: number;
  shows: number;
  totalSeats: number | null;
  fastfilling: number | null;
  housefull: number | null;
  occupancy: number | null; // tickets / seats (Fyre)
  occupancySource: number | null; // MovieMint's own figure
  cities: number | null;
  states: number | null;
  venues: number | null;
  languages: string[];
  formats: string[];
  completedAsOf?: string | null; // live day: completed shows up to this time
  raw?: Record<string, number | null> | null; // MovieMint's summary as published (rounded gross, 2-dp occupancy)
};

// City tuple. Positions 0-8 are the bf_* layout every SQL helper reads;
// 9-12 are MovieMint additions that existing readers ignore.
//   [0 name, 1 state, 2 gross, 3 sold, 4 shows, 5 seats, 6 ff, 7 hf, 8 venues,
//    9 tradeRegion, 10 tradeDistrict, 11 [[format, gross], ...], 12 occupancySource]
export type CityTuple = [string, string | null, number, number, number, number | null, number | null, number | null, number | null, string | null, string | null, [string, number][], number | null];

export type StoredNamed = {
  name: string;
  gross: number;
  sold: number;
  shows: number;
  totalSeats: number | null;
  fastfilling: number | null;
  housefull: number | null;
  occupancy: number | null;
  occupancySource: number | null;
  venues: number | null;
  cities: number | null;
};

export type StoredTerritory = StoredNamed & { subRegion: boolean };

export type StoredBreakdown = {
  entries: never[];
  states: StoredNamed[];
  cities: CityTuple[];
  chains: never[];
  languages: StoredNamed[];
  formats: StoredNamed[];
  territories: StoredTerritory[];
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
  day_window: DayWindow;
  totals_synced_at: string;
  // present only when this row carries a breakdown
  breakdown?: StoredBreakdown;
  breakdown_status?: BreakdownStatus;
  breakdown_synced_at?: string;
};

export type Ctx = { slug: string; moviemintId: string; title: string; now: string; today: string };

const r2 = (v: number) => Math.round(v * 100) / 100;

export function occupancyOf(sold: number, seats: number | null): number | null {
  return seats != null && seats > 0 ? r2((sold / seats) * 100) : null;
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
    occupancy: occupancyOf(r.sold, r.seats),
    occupancySource: r.occupancy,
    venues: r.venues,
    cities: r.cities
  };
}

export function toBreakdown(day: MmiDay): StoredBreakdown {
  return {
    entries: [],
    states: day.states.map(named),
    cities: day.cities.map(
      (c) =>
        [c.name, c.state, c.gross, c.sold, c.shows, c.seats, c.ff, c.hf, c.venues, c.tradeRegion, c.tradeDistrict, c.formats.map((f) => [f.name, f.gross] as [string, number]), c.occupancy] as CityTuple
    ),
    chains: [],
    languages: day.languages.map(named),
    formats: day.formats.map(named),
    territories: day.territories.map((t: MmiTerritory) => ({ ...named(t), subRegion: t.subRegion })),
    source: day.source
  };
}

// AP/TS trade territories: sub-regions (e.g. "Nizam / Hyderabad") are
// already inside their parent, so totals use top-level rows only.
export function territoryTotal(rows: { gross: number; sold: number; shows: number; subRegion: boolean }[]) {
  const top = rows.filter((r) => !r.subRegion);
  return { gross: r2(top.reduce((a, r) => a + r.gross, 0)), sold: top.reduce((a, r) => a + r.sold, 0), shows: top.reduce((a, r) => a + r.shows, 0) };
}

// Totals for one date: the series point's figures (MovieMint's day total),
// with what the series lacks filled from the same date's report or from
// what was stored before. Never mixes two different dates.
export function mergeTotals(point: MmiSeriesPoint | null, day: MmiDay | null, stored: Partial<StoredTotals> | null, completedAsOf: string | null = null): StoredTotals {
  const s = day?.summary ?? null;
  const gross = point ? point.gross : s ? s.gross : Number(stored?.gross ?? 0);
  const sold = point ? point.sold : s ? s.sold : Number(stored?.sold ?? 0);
  const shows = point ? point.shows : s ? s.shows : Number(stored?.shows ?? 0);
  // Seats: the series' own count when it has one; else the report's, but
  // only when the report shows the same tickets (same moment), so occupancy
  // never mixes two snapshots.
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
    occupancy: occupancyOf(sold, seats),
    occupancySource: point?.occupancy ?? (sameMoment ? s!.occupancy : null) ?? (stored?.occupancySource ?? null),
    cities: pick('cities', s ? s.cities : undefined),
    states: pick('states', s ? s.states : undefined),
    venues: pick('venues', s?.venues ?? undefined),
    languages: day ? day.languages.map((l) => l.name) : (stored?.languages ?? []),
    formats: day ? day.formats.map((f) => f.name) : (stored?.formats ?? []),
    completedAsOf: completedAsOf ?? stored?.completedAsOf ?? null,
    raw: day ? day.summaryRaw : (stored?.raw ?? null)
  };
}

const IST_DAY_END_HOUR = 23;

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

// Is a day report "final" (the day is over) rather than a live snapshot?
// MovieMint stamps every figure with its update time; a box-office day is
// final once its date is before today (IST) and the stamp is from late on
// that day or later -- or two days have passed.
export function isFinalDay(kind: MmiKind, date: string, today: string, lastUpdated: string | null): boolean {
  if (kind === 'advance') return false;
  if (date >= today) return false;
  if (date <= addDays(today, -2)) return true;
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/.exec(lastUpdated ?? '');
  if (!m) return true;
  if (m[1] > date) return true;
  return m[1] === date && Number(m[2]) >= IST_DAY_END_HOUR;
}

// Every stored row a fetched page yields.
//  - box-office page: one totals row per tracked-window date (the whole day
//    series); the selected report as that date's breakdown when it is a
//    window date; or, when the selected report is a date AFTER the window
//    (MovieMint's later-day capture, verified by the caller), a 'later' row
//  - advance page: one row for the selected show date
export function pageRows(page: MmiPage, ctx: Ctx, stored: Map<string, Partial<StoredTotals>>): DayRow[] {
  const out: DayRow[] = [];
  const day = page.day && page.day.date !== 'cumulative' ? page.day : null;
  const live = (d: string) => d >= ctx.today;
  if (page.kind === 'boxoffice') {
    const windowDates = new Set(page.series.map((p) => p.date));
    for (const p of page.series) {
      const sameDay = day && day.date === p.date ? day : null;
      out.push({
        slug: ctx.slug,
        moviemint_id: ctx.moviemintId,
        kind: 'boxoffice',
        date: p.date,
        title: ctx.title,
        totals: mergeTotals(p, sameDay, stored.get(`boxoffice:${p.date}`) ?? null, sameDay && live(p.date) ? page.completedAsOf : null),
        source_updated: p.lastUpdated ?? sameDay?.lastUpdated ?? null,
        in_source: true,
        day_window: 'tracked',
        totals_synced_at: ctx.now,
        ...(sameDay ? withBreakdown(sameDay, ctx) : {})
      });
    }
    const lastWindow = page.series[page.series.length - 1]?.date ?? null;
    if (day && !windowDates.has(day.date) && lastWindow && day.date > lastWindow) {
      out.push({
        slug: ctx.slug,
        moviemint_id: ctx.moviemintId,
        kind: 'boxoffice',
        date: day.date,
        title: ctx.title,
        totals: mergeTotals(null, day, stored.get(`boxoffice:${day.date}`) ?? null, live(day.date) ? page.completedAsOf : null),
        source_updated: day.lastUpdated,
        in_source: true,
        day_window: 'later',
        totals_synced_at: ctx.now,
        ...withBreakdown(day, ctx)
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
      day_window: 'tracked',
      totals_synced_at: ctx.now,
      breakdown: toBreakdown(day),
      breakdown_status: 'live',
      breakdown_synced_at: ctx.now
    });
  }
  return out;
}

function withBreakdown(day: MmiDay, ctx: Ctx) {
  return {
    breakdown: toBreakdown(day),
    breakdown_status: isFinalDay('boxoffice', day.date, ctx.today, day.lastUpdated) ? ('final' as const) : ('live' as const),
    breakdown_synced_at: ctx.now
  };
}

// ---------------------------------------------------------------------------
// Snapshots: one row per MovieMint refresh of a live day or an advance date
// ---------------------------------------------------------------------------

export type SnapshotRow = {
  moviemint_id: string;
  slug: string;
  kind: MmiKind;
  show_date: string;
  source_updated: string;
  completed_as_of: string | null;
  captured_at: string;
  totals: Record<string, number | null>;
  states: [string, number, number, number, number | null][] | null;
};

// Only a figure that is still moving is a snapshot: today's live day, or an
// advance show date. A finished day has one final value (mmi_movie_day).
export function snapshotRow(page: MmiPage, ctx: Ctx): SnapshotRow | null {
  const day = page.day;
  if (!day || day.date === 'cumulative' || !day.lastUpdated) return null;
  if (page.kind === 'boxoffice' && day.date < ctx.today) return null;
  if (day.summary.shows <= 0) return null; // nothing played / booked yet
  const s = day.summary;
  return {
    moviemint_id: ctx.moviemintId,
    slug: ctx.slug,
    kind: page.kind,
    show_date: day.date,
    source_updated: day.lastUpdated,
    completed_as_of: page.kind === 'boxoffice' ? page.completedAsOf : null,
    captured_at: ctx.now,
    totals: { gross: s.gross, sold: s.sold, shows: s.shows, totalSeats: s.seats, occupancy: occupancyOf(s.sold, s.seats), occupancySource: s.occupancy, venues: s.venues, ff: s.ff, hf: s.hf },
    states: day.states.map((r) => [r.name, r.gross, r.sold, r.shows, r.seats])
  };
}

// ---------------------------------------------------------------------------
// Cumulative report (?date=cumulative): whole tracked window in one report
// ---------------------------------------------------------------------------

export function cumulativeReport(page: MmiPage) {
  const d = page.day;
  if (!d || d.date !== 'cumulative') return null;
  const b = toBreakdown(d);
  return {
    summary: {
      gross: d.summary.gross,
      sold: d.summary.sold,
      shows: d.summary.shows,
      totalSeats: d.summary.seats,
      occupancy: occupancyOf(d.summary.sold, d.summary.seats),
      occupancySource: d.summary.occupancy,
      venues: d.summary.venues, // exact distinct venues over the window
      cities: d.summary.cities, // exact distinct cities
      states: d.summary.states,
      fastfilling: d.summary.ff,
      housefull: d.summary.hf
    },
    raw: d.summaryRaw,
    dates: page.availableDates,
    ...b,
    lastUpdated: d.lastUpdated
  };
}

// The tracked window three ways: Fyre's sum of the day series, MovieMint's
// "Cumulative - All Days" report and MovieMint's /tracked list total. They
// must agree within rounding (the list rounds gross to the rupee); a gap
// is reported, never papered over. Later days are never part of any of them.
export function reconcileWindow(seriesGross: number[], cumulativeGross: number | null, officialGross: number | null, tolerance = 1) {
  const sum = Math.round(seriesGross.reduce((a, g) => a + g, 0) * 100) / 100;
  const diffCumulative = cumulativeGross == null ? null : Math.round((cumulativeGross - sum) * 100) / 100;
  const diffOfficial = officialGross == null ? null : Math.round((officialGross - sum) * 100) / 100;
  const ok = (diffCumulative == null || Math.abs(diffCumulative) <= tolerance) && (diffOfficial == null || Math.abs(diffOfficial) <= tolerance);
  return { sum, cumulative: cumulativeGross, official: officialGross, diffCumulative, diffOfficial, ok, checked: cumulativeGross != null || officialGross != null };
}

// ---------------------------------------------------------------------------
// Movie summary (mmi_movie) -- the bf_movie fields, with Day 1 from
// MovieMint's release date, plus the tracked / later split.
// ---------------------------------------------------------------------------

export type StoredDay = {
  kind: MmiKind;
  date: string;
  totals: Partial<StoredTotals>;
  breakdown?: Partial<StoredBreakdown> | null;
  breakdown_status: BreakdownStatus;
  source_updated: string | null;
  synced_at?: string | null;
  day_window?: DayWindow;
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

function rank(days: StoredDay[], list: 'languages' | 'formats'): string[] {
  const sum = new Map<string, number>();
  for (const d of days) for (const r of (d.breakdown?.[list] ?? []) as StoredNamed[]) if (r?.name) sum.set(r.name, (sum.get(r.name) ?? 0) + (Number(r.gross) || 0));
  if (sum.size) return [...sum.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const seen: string[] = [];
  for (const d of [...days].reverse()) for (const n of (d.totals[list] ?? []) as string[]) if (!seen.includes(n)) seen.push(n);
  return seen;
}

const snap = (d: StoredDay) => ({ date: d.date, window: d.day_window ?? 'tracked', ...d.totals });

export function movieRow(meta: MovieMeta, days: StoredDay[], today: string) {
  const allBo = days.filter((d) => d.kind === 'boxoffice').sort((a, b) => a.date.localeCompare(b.date));
  const bo = allBo.filter((d) => (d.day_window ?? 'tracked') === 'tracked');
  const later = allBo.filter((d) => d.day_window === 'later');
  const adv = days.filter((d) => d.kind === 'advance').sort((a, b) => a.date.localeCompare(b.date));
  const first = bo[0]?.date ?? later[0]?.date ?? null;
  // last_date drives "running" (state): a film MovieMint still captures
  // after its window is still in cinemas.
  const last = allBo[allBo.length - 1]?.date ?? null;
  const rel = meta.releaseDate;
  // Tracking began after the release: a tracked period, never lifetime.
  const carriedOver = !!(first && rel && first > addDays(rel, 1));
  const releaseDate = first ? (carriedOver ? null : rel && rel >= first ? rel : first) : (rel ?? adv[0]?.date ?? null);
  const premiere = releaseDate && first && !carriedOver && bo.some((d) => d.date === addDays(releaseDate, -1)) ? addDays(releaseDate, -1) : null;
  const sum = (list: StoredDay[], k: 'gross' | 'sold' | 'shows' | 'totalSeats') => list.reduce((a, d) => a + (Number(d.totals[k]) || 0), 0);
  const best = bo.length ? bo.reduce((b, d) => ((Number(d.totals.gross) || 0) > (Number(b.totals.gross) || 0) ? d : b)) : null;
  const upcomingAdv = adv.find((d) => d.date >= (first ? addDays(today, 1) : today)) ?? adv[adv.length - 1] ?? null;
  // Gaps inside the tracked window MovieMint has no figures for.
  const have = new Set(bo.map((d) => d.date));
  const missing: string[] = [];
  const wStart = bo[0]?.date ?? null;
  const wEnd = bo[bo.length - 1]?.date ?? null;
  if (wStart && wEnd) for (let d = wStart; d < wEnd; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  // Newest source stamp ("YYYY-MM-DD HH:MM IST" sorts as text). Rows
  // written in one run share a sync time, so that can't pick it.
  const latestStamp = days.map((d) => d.source_updated).filter((x): x is string => !!x).sort().pop() ?? null;
  const languages = rank(allBo.length ? allBo : adv, 'languages');
  return {
    slug: meta.slug,
    moviemint_id: meta.moviemintId,
    title: meta.title,
    languages: languages.length ? languages : meta.language ? [meta.language] : [],
    formats: rank(allBo.length ? allBo : adv, 'formats'),
    poster: meta.poster,
    release_date: releaseDate,
    premiere_date: premiere,
    carried_over: carriedOver,
    first_date: first,
    last_date: last,
    // the official (tracked-window) totals -- later days never added here
    days_tracked: bo.length,
    total_gross: Math.round(sum(bo, 'gross') * 100) / 100,
    total_sold: sum(bo, 'sold'),
    total_shows: sum(bo, 'shows'),
    total_seats: sum(bo, 'totalSeats'),
    latest: allBo.length ? snap(allBo[allBo.length - 1]) : null,
    best: best ? snap(best) : null,
    advance: upcomingAdv ? snap(upcomingAdv) : null,
    advance_date: adv[adv.length - 1]?.date ?? null,
    source_updated: latestStamp,
    breakdown_days: allBo.filter((d) => d.breakdown_status === 'final').length,
    missing_dates: missing,
    available_dates: meta.availableDates,
    window_start: wStart,
    window_end: wEnd,
    tracked_days: bo.length,
    later_days: later.length,
    later_gross: Math.round(sum(later, 'gross') * 100) / 100,
    later_sold: sum(later, 'sold'),
    later_first: later[0]?.date ?? null,
    later_last: later[later.length - 1]?.date ?? null,
    updated_at: new Date().toISOString()
  };
}

export type MovieRow = ReturnType<typeof movieRow>;
