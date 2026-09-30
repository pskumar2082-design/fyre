import { describe, expect, it } from 'vitest';
import { isFastFilling, isHousefull, normalizeDetailFile, parseShowHour, priceBand, reconcile, NO_SALES_BAND, type BfRawShow } from '../detail';

const show = (over: Partial<BfRawShow>): BfRawShow => ({
  movie: 'The Paradise [2D | Telugu]',
  venue: 'PVR: Nexus, Koramangala',
  chain: 'PVR',
  time: '09:00 AM',
  audi: 'AUDI 1',
  session_id: '1',
  totalSeats: 100,
  available: 50,
  sold: 50,
  gross: 10000,
  city: 'Bengaluru',
  state: 'Karnataka',
  occupancy: '0%',
  s: 'B',
  ...over
});

describe('show-level rules', () => {
  it('parses 12-hour show times', () => {
    expect(parseShowHour('09:35 AM')).toBe(9);
    expect(parseShowHour('12:10 AM')).toBe(0);
    expect(parseShowHour('12:30 PM')).toBe(12);
    expect(parseShowHour('11:45 PM')).toBe(23);
    expect(parseShowHour('late')).toBeNull();
  });

  it('uses BFILMY fast-filling / housefull thresholds (50% and 98%)', () => {
    expect(isFastFilling(49, 100)).toBe(false);
    expect(isFastFilling(50, 100)).toBe(true);
    expect(isFastFilling(97, 100)).toBe(true);
    expect(isFastFilling(98, 100)).toBe(false);
    expect(isHousefull(98, 100)).toBe(true);
    expect(isHousefull(0, 0)).toBe(false);
  });

  it('bands shows by average ticket price and keeps unsold shows separate', () => {
    expect(priceBand(0, 0)).toBe(NO_SALES_BAND);
    expect(priceBand(1000, 10)).toBe('₹100 or Below');
    expect(priceBand(1500, 10)).toBe('₹100 - ₹199');
    expect(priceBand(2000, 10)).toBe('₹200 - ₹299');
    expect(priceBand(25000, 10)).toBe('₹2000+');
  });
});

describe('normalizeDetailFile', () => {
  const file = {
    last_updated: '2026-09-29 23:19 IST',
    data: [
      show({}),
      show({ session_id: '2', time: '06:30 PM', sold: 99, available: 1, gross: 29700 }),
      show({ movie: 'The Paradise [2D | Hindi]', venue: 'Asian Mukta A2, Narapally', chain: 'Asian Mukta A2', city: 'Hyderabad', state: 'Telangana', session_id: '9', sold: 0, available: 100, gross: 0, time: '12:15 AM' }),
      show({ movie: 'Other Film [2D | Tamil]', chain: 'Cinepolis P&A', venue: 'Cinepolis P&A, Pune', city: 'Pune', state: 'Maharashtra' })
    ]
  };
  const days = normalizeDetailFile(file, 'boxoffice', '2026-09-29', new Map());
  const p = days.find((d) => d.key === 'theparadise')!;

  it('groups every language of a film into one movie', () => {
    expect(days).toHaveLength(2);
    expect(p.languages).toEqual(['Hindi', 'Telugu']);
    expect(p.summary).toMatchObject({ shows: 3, seats: 300, sold: 149, gross: 39700, ff: 1, hf: 1, venues: 2, cities: 2, states: 2 });
  });

  it('counts PIC only for PVR, INOX and Cinepolis', () => {
    expect(p.summary.pic).toMatchObject({ shows: 2, sold: 149, gross: 39700, venues: 1 });
    const other = days.find((d) => d.key === 'otherfilm')!;
    expect(other.summary.pic.shows).toBe(0);
  });

  it('builds venue, language x state and hourly rows', () => {
    expect(p.dims.venue.map((r) => r[0][0])).toEqual(['PVR: Nexus, Koramangala|Bengaluru|Karnataka', 'Asian Mukta A2, Narapally|Hyderabad|Telangana']);
    expect(p.dims.language_state.map((r) => r[0])).toEqual([['Telugu', 'Karnataka'], ['Hindi', 'Telangana']]);
    expect(p.dims.language_city).toHaveLength(2);
    // after-midnight show sorts last; cumulative venues/cities grow
    expect(p.dims.show_hour.map((r) => [r[0][0], r[9], r[10]])).toEqual([
      [9, 1, 1],
      [18, 1, 1],
      [0, 2, 2]
    ]);
    const other = days.find((d) => d.key === 'otherfilm')!;
    expect(other.dims.language_city.map((r) => r[0])).toEqual([['Tamil', 'Pune', 'Maharashtra']]);
  });

  it('reconciles against the summary totals', () => {
    const ok = reconcile(days, new Map([
      ['theparadise', { gross: 39700, sold: 149, shows: 3, totalSeats: 300 }],
      ['otherfilm', { gross: 10000, sold: 50, shows: 1, totalSeats: 100 }]
    ]));
    expect(ok).toEqual([]);
    const bad = reconcile(days, new Map([['theparadise', { gross: 1, sold: 149, shows: 3, totalSeats: 300 }]]));
    expect(bad.map((b) => b.field)).toEqual(['gross', 'missing-in-summary']);
  });
});
