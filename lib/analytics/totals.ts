// TOTAL rows for breakdown tables -- one implementation for India and USA.
//   gross, tickets, shows, seats, FF, HF   summed over the rows
//   occupancy                              total tickets / total seats
//   ATP                                    total gross / total tickets
//   venues / cities / states               distinct counts from the headline
//                                          (never summed across rows)
// The sum is then reconciled with the selection's headline.
import { sumMetrics } from './metrics';
import type { BreakdownRow, BreakdownTotal, Metrics } from './types';

export type TotalOptions = {
  // Rows cover every show exactly once (state, city, language, format, ...).
  exhaustive: boolean;
  // Rows are a subset (PIC): reconcile against the PIC headline instead.
  subset?: 'pic';
  // Summary-file lists may leave shows out: a shortfall is PARTIAL, not MISMATCH.
  mayBeIncomplete?: boolean;
  live?: boolean; // the headline and the rows can be minutes apart
  occupancyCoverage?: 'MATCH' | 'PARTIAL';
  money?: (v: number) => string;
};

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-6);

export function breakdownTotal(rows: BreakdownRow[], headline: Metrics | null, opts: TotalOptions): BreakdownTotal | null {
  if (!opts.exhaustive || rows.length === 0) return null;
  const sum = sumMetrics(rows.map((r) => r.metrics));
  const label = opts.subset === 'pic' ? 'PIC TOTAL' : 'TOTAL';
  if (!headline) return { label, metrics: sum, status: 'PARTIAL', note: 'No headline figures to reconcile with.', occupancyCoverage: opts.occupancyCoverage };

  const want =
    opts.subset === 'pic'
      ? { gross: headline.picGross, tickets: headline.picTickets, shows: null, seats: null }
      : { gross: headline.gross, tickets: headline.tickets, shows: headline.shows, seats: headline.seats };
  const diffs: string[] = [];
  let short = true;
  const check = (name: string, got: number, exp: number | null, fmt: (v: number) => string = (v) => Math.round(v).toLocaleString('en-US')) => {
    if (exp == null) return;
    if (!close(got, exp)) {
      diffs.push(`${name} ${fmt(got)} vs headline ${fmt(exp)}`);
      if (got > exp) short = false;
    }
  };
  check('gross', sum.gross, want.gross, opts.money);
  check('tickets', sum.tickets, want.tickets);
  check('shows', sum.shows, want.shows);
  check('seats', sum.seats, want.seats);

  if (opts.subset !== 'pic') {
    // Distinct counts over the whole selection = the headline's own.
    sum.venues = headline.venues;
    sum.cities = headline.cities;
    sum.states = headline.states;
  } else {
    sum.venues = null;
    sum.cities = null;
    sum.states = null;
  }
  sum.picGross = opts.subset === 'pic' ? sum.gross : headline.picGross;
  sum.picTickets = opts.subset === 'pic' ? sum.tickets : headline.picTickets;

  if (diffs.length === 0) return { label, metrics: sum, status: 'MATCH', note: null, occupancyCoverage: opts.occupancyCoverage };
  if (opts.mayBeIncomplete && short) {
    return { label, metrics: null, status: 'PARTIAL', note: `Partial coverage: this breakdown doesn't include every show (${diffs.join('; ')}).`, occupancyCoverage: opts.occupancyCoverage };
  }
  return {
    label,
    metrics: sum,
    status: 'MISMATCH',
    note: `${opts.live ? 'Live day — breakdown and headline were captured minutes apart. ' : ''}Sum of rows: ${diffs.join('; ')}.`,
    occupancyCoverage: opts.occupancyCoverage
  };
}
