// Pure metric helpers shared by every Fyre Analytics consumer.
import type { Metrics, MetricKey } from './types';

export type RawFigures = {
  gross: number;
  tickets: number;
  shows: number;
  seats: number;
  ff?: number | null;
  hf?: number | null;
  venues?: number | null;
  cities?: number | null;
  states?: number | null;
  picGross?: number | null;
  picTickets?: number | null;
};

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function orNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Occupancy and ATP are always recomputed from the additive figures, so a
// total can never disagree with its own parts.
export function makeMetrics(r: RawFigures): Metrics {
  const gross = round2(n(r.gross));
  const tickets = n(r.tickets);
  const seats = n(r.seats);
  return {
    gross,
    tickets,
    shows: n(r.shows),
    seats,
    occupancy: seats > 0 ? round2((tickets / seats) * 100) : null,
    atp: tickets > 0 ? round2(gross / tickets) : null,
    ff: orNull(r.ff),
    hf: orNull(r.hf),
    venues: orNull(r.venues),
    cities: orNull(r.cities),
    states: orNull(r.states),
    picGross: r.picGross == null ? null : round2(n(r.picGross)),
    picTickets: orNull(r.picTickets)
  };
}

// Adds metrics that are additive across days. Distinct counts (venues,
// cities, states) are NOT additive, so the sum carries null for them; the
// caller fills them from an exact distinct count when one exists.
export function sumMetrics(list: Metrics[]): Metrics {
  const addNullable = (k: 'ff' | 'hf' | 'picGross' | 'picTickets') =>
    list.length > 0 && list.every((m) => m[k] != null) ? list.reduce((a, m) => a + (m[k] as number), 0) : null;
  return makeMetrics({
    gross: list.reduce((a, m) => a + m.gross, 0),
    tickets: list.reduce((a, m) => a + m.tickets, 0),
    shows: list.reduce((a, m) => a + m.shows, 0),
    seats: list.reduce((a, m) => a + m.seats, 0),
    ff: addNullable('ff'),
    hf: addNullable('hf'),
    picGross: addNullable('picGross'),
    picTickets: addNullable('picTickets'),
    venues: list.length === 1 ? list[0].venues : null,
    cities: list.length === 1 ? list[0].cities : null,
    states: list.length === 1 ? list[0].states : null
  });
}

// Stored dimension tuple -> Metrics: [key, shows, seats, sold, gross, ff, hf, venues, cities, (states)]
export function metricsFromTuple(t: unknown[], extra: Partial<RawFigures> = {}): Metrics {
  return makeMetrics({
    shows: n(t[1]),
    seats: n(t[2]),
    tickets: n(t[3]),
    gross: n(t[4]),
    ff: orNull(t[5]),
    hf: orNull(t[6]),
    venues: orNull(t[7]),
    cities: orNull(t[8]),
    ...extra
  });
}

export function metricValue(m: Metrics | null | undefined, key: MetricKey): number | null {
  if (!m) return null;
  return m[key] ?? null;
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  gross: 'Gross',
  tickets: 'Tickets',
  shows: 'Shows',
  occupancy: 'Occupancy',
  atp: 'ATP',
  seats: 'Seats',
  venues: 'Venues',
  cities: 'Cities',
  states: 'States',
  ff: 'Fast filling',
  hf: 'Housefull',
  picGross: 'PIC Gross',
  picTickets: 'PIC Tickets'
};
