// Movie Stats dashboard: view model + pure helpers (client-safe; no I/O).
//
// Built from the same MovieAnalytics every other Fyre page reads, so the
// dashboard can never disagree with the cards, the comparison or the
// poster. Rules carried through:
//   - the official total is the tracked window only; days captured after
//     it ("later days") are a separate figure, never added, never lifetime
//   - a figure the source does not give is null (shown as "—"), never 0
//   - occupancy is tickets / seats; the source's own published occupancy
//     is kept apart (occupancySource) and labelled when shown
//   - INR and USD are never added or drawn on one scale
import type { Currency, DayPoint, MovieAnalytics, Territory } from './types';

export type StatsPoint = {
  date: string;
  day: number | null;
  label: string;
  window: 'tracked' | 'later';
  final: boolean;
  gross: number;
  tickets: number;
  shows: number;
  seats: number | null;
  occupancy: number | null;
  occupancySource: number | null;
  atp: number | null;
  venues: number | null;
  ff: number | null;
  hf: number | null;
  cities: number | null;
  states: number | null;
  breakdowns: boolean;
  sourceUpdated: string | null;
  completedAsOf: string | null;
};

export type StatsTotals = {
  gross: number;
  tickets: number;
  shows: number;
  seats: number | null;
  occupancy: number | null;
  atp: number | null;
  venues: number | null;
  cities: number | null;
  days: number;
};

export type StatsDimension = 'state' | 'city' | 'language' | 'format' | 'territory' | 'city_format' | 'chain' | 'theater' | 'format_language';

export type Availability<K extends string> = { key: K; label: string; available: boolean; reason?: string };

export type MetricCard =
  | 'official'
  | 'later'
  | 'today'
  | 'tickets'
  | 'shows'
  | 'seats'
  | 'occupancy'
  | 'venues'
  | 'ff'
  | 'hf'
  | 'advance'
  | 'opening'
  | 'days'
  | 'atp'
  | 'best';

export type MovieStats = {
  territory: Territory;
  currency: Currency;
  slug: string;
  title: string;
  poster: string | null;
  dayOne: string | null;
  state: string;
  carriedOver: boolean;
  historyStart: string | null;
  lastUpdated: string | null;
  sourceLabel: string; // public wording only: never names a data supplier
  totalLabel: string; // "Lifetime" | "Total tracked" | "Official tracked total"
  official: StatsTotals & { start: string | null; end: string | null; check: { publishedGross: number | null; reportGross: number | null; ok: boolean } | null };
  later: (StatsTotals & { first: string; last: string }) | null;
  today: StatsPoint | null; // the live day, while it runs
  latest: StatsPoint | null; // newest day (window or later)
  opening: StatsPoint | null; // Day 1
  best: StatsPoint | null; // highest-grossing tracked day
  advance: StatsPoint[]; // open advance show dates, soonest first
  advanceAll: StatsPoint[]; // every stored advance date
  points: StatsPoint[]; // tracked + later days, date order
  cards: Availability<MetricCard>[];
  dimensions: Availability<StatsDimension>[];
  intraday: boolean; // live-day refresh history can exist
  advanceHistory: 'refresh' | 'daily' | null; // advance build-up: every source refresh (India) or one capture a day (USA)
};

const r2 = (v: number) => Math.round(v * 100) / 100;

function point(p: DayPoint, window: 'tracked' | 'later'): StatsPoint {
  const m = p.metrics;
  // Metrics.seats is 0 when the source gave none: missing, not zero.
  const seats = m.seats > 0 ? m.seats : null;
  return {
    date: p.date,
    day: p.day,
    label: p.label,
    window,
    final: p.final,
    gross: m.gross,
    tickets: m.tickets,
    shows: m.shows,
    seats,
    occupancy: m.occupancy,
    occupancySource: p.occupancySource ?? p.provenance?.occupancySource ?? null,
    atp: m.atp,
    venues: m.venues,
    ff: m.ff,
    hf: m.hf,
    cities: m.cities,
    states: m.states,
    breakdowns: p.breakdowns,
    sourceUpdated: p.sourceUpdated,
    completedAsOf: p.completedAsOf ?? null
  };
}

// Sums over days. Seats only when every day has them (else occupancy would
// mix days with and without seats); distinct counts are not additive.
export function totalsOf(points: StatsPoint[]): StatsTotals {
  const gross = r2(points.reduce((a, p) => a + p.gross, 0));
  const tickets = points.reduce((a, p) => a + p.tickets, 0);
  const shows = points.reduce((a, p) => a + p.shows, 0);
  const allSeats = points.length > 0 && points.every((p) => p.seats != null);
  const seats = allSeats ? points.reduce((a, p) => a + (p.seats as number), 0) : null;
  return {
    gross,
    tickets,
    shows,
    seats,
    occupancy: seats && seats > 0 ? r2((tickets / seats) * 100) : null,
    atp: tickets > 0 ? r2(gross / tickets) : null,
    venues: points.length === 1 ? points[0].venues : null,
    cities: points.length === 1 ? points[0].cities : null,
    days: points.length
  };
}

// Fyre's window sum against the source's own totals -- only figures that
// describe the same finished window. A total published while the last day
// was still live (or before it) is a different moment, not a mismatch.
export function windowCheck(m: MovieAnalytics, sum: number, tracked: StatsPoint[]): MovieStats['official']['check'] {
  const w = m.window;
  const end = tracked[tracked.length - 1];
  if (!w || !end || !end.final) return null;
  const sameDay = (stamp: string | null | undefined) => {
    const x = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):/.exec(stamp ?? '');
    return !!x && (x[1] > end.date || (x[1] === end.date && Number(x[2]) >= 23));
  };
  const published = w.officialGross != null && w.officialDate === end.date && sameDay(w.officialStamp) ? w.officialGross : null;
  const report = w.cumulativeGross != null && sameDay(w.cumulativeStamp) ? w.cumulativeGross : null;
  if (published == null && report == null) return null;
  const tol = Math.max(10, sum * 0.0005);
  return { publishedGross: published, reportGross: report, ok: [published, report].every((g) => g == null || Math.abs(g - sum) <= tol) };
}

const SOURCE_LABEL: Record<Territory, string> = {
  IN: 'Fyre tracking · online ticket sales',
  US: 'Fyre tracking · USA Indian-language screenings'
};

export function buildStats(m: MovieAnalytics, today: string, opts: { moviemint?: boolean } = {}): MovieStats {
  const territory: Territory = m.territory ?? 'IN';
  const currency: Currency = m.currency ?? 'INR';
  const tracked = m.days.map((d) => point(d, 'tracked'));
  const later = (m.laterDays ?? []).map((d) => point(d, 'later'));
  const points = [...tracked, ...later].sort((a, b) => a.date.localeCompare(b.date));
  const off = totalsOf(tracked);
  // Exact distinct venues / cities over the whole window when known.
  const lt = m.lifetime;
  const official = {
    ...off,
    // the stored lifetime carries exact distinct counts where they exist
    venues: m.window?.cumulativeVenues ?? (lt.venues ?? off.venues),
    cities: m.window?.cumulativeCities ?? (lt.cities ?? off.cities),
    start: m.window?.start ?? tracked[0]?.date ?? null,
    end: m.window?.end ?? tracked[tracked.length - 1]?.date ?? null,
    check: windowCheck(m, off.gross, tracked)
  };
  const laterTotals = later.length ? { ...totalsOf(later), first: later[0].date, last: later[later.length - 1].date } : null;
  const live = points.filter((p) => !p.final && p.date >= today);
  const advanceAll = m.advance.map((a) => point(a, 'tracked'));
  // open advance: show dates still ahead (today's own advance only while nothing later is open)
  const ahead = advanceAll.filter((a) => a.date > today);
  const advance = ahead.length ? ahead : advanceAll.filter((a) => a.date === today);
  const usa = territory === 'US';
  const mm = !usa && !!opts.moviemint;
  const hasFfHf = points.some((p) => p.ff != null || p.hf != null);
  const hasSeats = points.some((p) => p.seats != null);
  const na = (key: MetricCard, label: string, reason: string): Availability<MetricCard> => ({ key, label, available: false, reason });
  const ok = (key: MetricCard, label: string): Availability<MetricCard> => ({ key, label, available: true });
  const cards: Availability<MetricCard>[] = [
    tracked.length ? ok('official', m.carriedOver ? 'Total tracked' : mm ? 'Official tracked gross' : 'Tracked gross') : na('official', mm ? 'Official tracked gross' : 'Tracked gross', 'No box office tracked yet'),
    later.length ? ok('later', 'Later-day gross') : na('later', 'Later-day gross', usa ? 'Not tracked for the USA' : mm ? 'No days captured after the tracking window' : 'Not tracked'),
    live.length ? ok('today', 'Today') : na('today', 'Today', 'No live day running'),
    tracked.length ? ok('tickets', 'Tickets') : na('tickets', 'Tickets', 'No box office tracked yet'),
    tracked.length ? ok('shows', 'Shows') : na('shows', 'Shows', 'No box office tracked yet'),
    hasSeats ? ok('seats', 'Seats') : na('seats', 'Seats', 'Seat counts not available'),
    hasSeats ? ok('occupancy', 'Occupancy') : na('occupancy', 'Occupancy', 'Seat counts not available'),
    points.some((p) => p.venues != null) ? ok('venues', usa ? 'Theatres' : 'Venues') : na('venues', usa ? 'Theatres' : 'Venues', 'Not available'),
    hasFfHf ? ok('ff', 'Fast filling') : na('ff', 'Fast filling', usa ? 'Not provided for the USA' : 'Not available'),
    hasFfHf ? ok('hf', 'Housefull') : na('hf', 'Housefull', usa ? 'Not provided for the USA' : 'Not available'),
    advance.length ? ok('advance', 'Advance') : na('advance', 'Advance', 'No advance bookings open'),
    tracked.some((p) => p.day === 1) ? ok('opening', 'Opening day') : na('opening', 'Opening day', m.carriedOver ? 'Released before tracking began' : 'Day 1 not tracked'),
    tracked.length ? ok('days', 'Tracked days') : na('days', 'Tracked days', 'No box office tracked yet'),
    tracked.some((p) => p.atp != null) ? ok('atp', 'Avg ticket price') : na('atp', 'Avg ticket price', 'No tickets'),
    tracked.length ? ok('best', 'Best day') : na('best', 'Best day', 'No box office tracked yet')
  ];
  const dim = (key: StatsDimension, label: string, reason?: string): Availability<StatsDimension> => (reason ? { key, label, available: false, reason } : { key, label, available: true });
  const dimensions: Availability<StatsDimension>[] = usa
    ? [dim('state', 'State'), dim('city', 'City'), dim('language', 'Language'), dim('format', 'Format'), dim('theater', 'Theatre'), dim('chain', 'Chain'), dim('format_language', 'Format × Language')]
    : [
        dim('state', 'State'),
        dim('city', 'City'),
        dim('language', 'Language'),
        dim('format', 'Format'),
        mm ? dim('territory', 'AP / TS territory') : dim('territory', 'AP / TS territory', 'Territory split is not available for this movie'),
        mm ? dim('city_format', 'City × Format') : dim('city_format', 'City × Format', 'City × Format split is not available for this movie'),
        mm ? dim('chain', 'Chain', 'Chain-wise figures are not available for India') : dim('chain', 'Chain')
      ];
  return {
    territory,
    currency,
    slug: m.slug,
    title: m.title,
    poster: m.poster,
    dayOne: m.dayOne,
    state: m.state,
    carriedOver: m.carriedOver,
    historyStart: m.historyStart ?? null,
    lastUpdated: m.lastUpdated,
    sourceLabel: SOURCE_LABEL[territory],
    totalLabel: m.carriedOver ? 'Total tracked' : mm || later.length ? 'Official tracked total' : 'Lifetime',
    official,
    later: laterTotals,
    today: live[live.length - 1] ?? null,
    latest: points[points.length - 1] ?? null,
    opening: tracked.find((p) => p.day === 1) ?? null,
    best: tracked.length ? tracked.reduce((b, p) => (p.gross > b.gross ? p : b)) : null,
    advance,
    advanceAll,
    points,
    cards,
    dimensions,
    intraday: mm,
    advanceHistory: usa ? 'daily' : mm ? 'refresh' : null
  };
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export type StatsColumn = 'gross' | 'share' | 'tickets' | 'shows' | 'seats' | 'occupancy' | 'occupancySource' | 'atp' | 'venues' | 'cities' | 'ff' | 'hf';
export type StatsRow = { key: string; name: string; sub: string | null; nested?: boolean; values: Partial<Record<StatsColumn, number | null>> };

export function sortRows(rows: StatsRow[], col: StatsColumn | 'name', dir: 'asc' | 'desc'): StatsRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (col === 'name') return sign * a.name.localeCompare(b.name) || (a.sub ?? '').localeCompare(b.sub ?? '');
    const x = a.values[col];
    const y = b.values[col];
    // missing values always last, whatever the direction
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    return sign * (x - y) || a.name.localeCompare(b.name);
  });
}

export function pageOf<T>(rows: T[], offset: number, limit: number): T[] {
  const o = Math.max(0, Math.floor(offset) || 0);
  const l = Math.min(100, Math.max(1, Math.floor(limit) || 10));
  return rows.slice(o, o + l);
}

// Points inside a date range and window. `window`: tracked | later | all.
export function pointsInRange(points: StatsPoint[], from: string | null, to: string | null, window: 'tracked' | 'later' | 'all'): StatsPoint[] {
  return points.filter((p) => (window === 'all' || p.window === window) && (!from || p.date >= from) && (!to || p.date <= to));
}

// Scenario calculator (estimates, clearly labelled as such): a simple
// geometric decay from the latest finished day. Never stored, never shown
// as data.
export function scenario(base: number, days: number, dailyDropPct: number, weekendLiftPct = 0, startWeekday = 0): { day: number; gross: number }[] {
  const out: { day: number; gross: number }[] = [];
  let g = Math.max(0, base);
  for (let i = 1; i <= Math.max(0, Math.min(120, Math.floor(days))); i++) {
    g = g * (1 - dailyDropPct / 100);
    const wd = (startWeekday + i) % 7; // 0 = Sunday
    const lift = wd === 0 || wd === 6 ? 1 + weekendLiftPct / 100 : 1;
    out.push({ day: i, gross: r2(g * lift) });
  }
  return out;
}
