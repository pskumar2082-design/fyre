import { describe, expect, it } from 'vitest';
import { breakdownTotal } from '../totals';
import { makeMetrics } from '../metrics';
import { formatMetric, formatUsd } from '../format';

const row = (key: string, gross: number, tickets: number, shows: number, seats: number) => ({ key, name: key, sub: null, metrics: makeMetrics({ gross, tickets, shows, seats, venues: 3, cities: 2 }) });

describe('TOTAL rows', () => {
  const rows = [row('TX', 600, 30, 3, 100), row('CA', 400, 10, 2, 300)];
  const headline = makeMetrics({ gross: 1000, tickets: 40, shows: 5, seats: 400, venues: 4, cities: 3, states: 2 });

  it('sums additive figures and derives occupancy/ATP from the sums', () => {
    const t = breakdownTotal(rows, headline, { exhaustive: true })!;
    expect(t.status).toBe('MATCH');
    expect(t.metrics!.gross).toBe(1000);
    expect(t.metrics!.occupancy).toBe(10); // 40 / 400, not the average of 30% and 3.33%
    expect(t.metrics!.atp).toBe(25);
    // distinct counts come from the headline, never summed (3 + 3 venues != 4)
    expect(t.metrics!.venues).toBe(4);
    expect(t.metrics!.cities).toBe(3);
  });

  it('flags a mismatch with the headline instead of hiding it', () => {
    const t = breakdownTotal(rows, { ...headline, gross: 1200 }, { exhaustive: true })!;
    expect(t.status).toBe('MISMATCH');
    expect(t.metrics!.gross).toBe(1000);
    expect(t.note).toContain('gross');
  });

  it('an incomplete (summary) list is PARTIAL and makes up no total', () => {
    const t = breakdownTotal(rows, { ...headline, gross: 1500, tickets: 60 }, { exhaustive: true, mayBeIncomplete: true })!;
    expect(t.status).toBe('PARTIAL');
    expect(t.metrics).toBeNull();
  });

  it('non-exhaustive breakdowns get no total; PIC reconciles with the PIC headline', () => {
    expect(breakdownTotal(rows, headline, { exhaustive: false })).toBeNull();
    const pic = breakdownTotal(rows, { ...headline, picGross: 1000, picTickets: 40 }, { exhaustive: true, subset: 'pic' })!;
    expect(pic.status).toBe('MATCH');
    expect(pic.label).toBe('PIC TOTAL');
  });
});

describe('currency formatting', () => {
  it('USD and INR are formatted separately', () => {
    expect(formatUsd(1317663.9)).toBe('$1.32M');
    expect(formatUsd(203951.23)).toBe('$203,951');
    expect(formatMetric('atp', 22.63, 'USD')).toBe('$22.63');
    expect(formatMetric('gross', 336244745.66, 'INR')).toBe('₹33.62 Cr');
    expect(formatMetric('tickets', 58845, 'USD')).toBe('58,845');
  });
});
