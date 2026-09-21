import { describe, it, expect } from 'vitest';
import {
  parseFreshnessToTimestamp,
  parseCompletedShowsTimestamp,
  parseIstTimestampText,
  mapAdvanceSnapshot,
  mapTrackedSnapshot,
  mapDailySeriesEntry,
  mapBreakdownRow,
  normalizeTitleForMatch
} from '@/lib/moviemintMapper';
import type {
  ParsedAdvanceStats,
  ParsedTrackedStats,
  ParsedBreakdownRow,
  ParsedDailySeriesEntry
} from '@/lib/moviemintParser';

describe('parseFreshnessToTimestamp', () => {
  it('parses "Updated 1h 5m ago" relative to a reference time', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const ts = parseFreshnessToTimestamp('Updated 1h 5m ago', now);
    expect(ts).toBe(new Date('2026-09-20T10:55:00.000Z').toISOString());
  });

  it('parses "Updated 4m ago"', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const ts = parseFreshnessToTimestamp('Updated 4m ago', now);
    expect(ts).toBe(new Date('2026-09-20T11:56:00.000Z').toISOString());
  });

  it('returns null for unrecognized text', () => {
    expect(parseFreshnessToTimestamp('not a freshness string')).toBeNull();
    expect(parseFreshnessToTimestamp(null)).toBeNull();
  });
});

describe('parseCompletedShowsTimestamp', () => {
  it('parses "Completed shows till 20:43 IST" into a UTC timestamp', () => {
    const ref = new Date('2026-09-18T10:00:00.000Z'); // some time during the IST day of Sep 18
    const ts = parseCompletedShowsTimestamp('Completed shows till 20:43 IST', ref);
    expect(ts).not.toBeNull();
    // 20:43 IST == 15:13 UTC
    expect(ts).toBe(new Date('2026-09-18T15:13:00.000Z').toISOString());
  });

  it('returns null when there is no matching text', () => {
    expect(parseCompletedShowsTimestamp('Updated 4m ago')).toBeNull();
  });
});

describe('mapAdvanceSnapshot / mapTrackedSnapshot', () => {
  it('carries every field through, including nulls for missing metrics', () => {
    const stats: ParsedAdvanceStats = {
      gross: 4.78,
      tickets: 185000,
      shows: 7300,
      cities: null,
      occupancyPct: 11.42,
      dayLabelText: 'Advance data: Day 45 — September 20, 2026',
      freshnessText: 'Updated 1h 5m ago'
    };
    const mapped = mapAdvanceSnapshot(stats);
    expect(mapped.source).toBe('moviemint');
    expect(mapped.kind).toBe('advance');
    expect(mapped.cities).toBeNull(); // never coerced to 0
    expect(mapped.capacity).toBeNull(); // never exposed by MovieMint, always null
    expect(mapped.gross).toBe(4.78);
  });

  it('uses "today\'s gross" as the tracked snapshot headline value', () => {
    const stats: ParsedTrackedStats = {
      todayGross: 9.54,
      lifetimeGross: 317.67,
      lifetimeTickets: 13400000,
      lifetimeShows: 185000,
      cities: 707,
      lifetimeOccupancyPct: 36.7,
      dayLabelText: 'Breakdown for: Day 44 — September 18, 2026',
      freshnessText: 'Updated 4m ago',
      completedShowsText: 'Completed shows till 20:43 IST'
    };
    const mapped = mapTrackedSnapshot(stats);
    expect(mapped.gross).toBe(9.54);
    expect(mapped.tickets).toBe(13400000);
    expect(mapped.kind).toBe('tracked');
  });
});

describe('mapBreakdownRow', () => {
  it('carries source-specific FF through as a raw, unlabeled number', () => {
    const row: ParsedBreakdownRow = {
      breakdownType: 'state',
      label: 'Uttar Pradesh',
      gross: 0.9352,
      shows: 1110,
      ticketsSold: 38500,
      soldOut: 17,
      occPct: 14.89,
      rawFf: 76
    };
    const mapped = mapBreakdownRow(row);
    expect(mapped.rawFf).toBe(76);
    expect(mapped.source).toBe('moviemint');
  });
});

describe('normalizeTitleForMatch', () => {
  it('strips a trailing language-code parenthetical', () => {
    expect(normalizeTitleForMatch('Resident Evil (E)')).toBe('resident evil');
    expect(normalizeTitleForMatch('Mahendragiri Varahi (T)')).toBe('mahendragiri varahi');
  });

  it('is case- and punctuation-insensitive', () => {
    expect(normalizeTitleForMatch('Hanuman Ansh')).toBe(normalizeTitleForMatch('HANUMAN, ANSH!'));
  });
});

describe('parseIstTimestampText', () => {
  it('converts a bare "YYYY-MM-DD HH:MM IST" string to a UTC ISO timestamp', () => {
    const ts = parseIstTimestampText('2026-09-02 23:39 IST');
    // 23:39 IST == 18:09 UTC
    expect(ts).toBe(new Date('2026-09-02T18:09:00.000Z').toISOString());
  });

  it('returns null for unrecognized text', () => {
    expect(parseIstTimestampText('not a timestamp')).toBeNull();
    expect(parseIstTimestampText(null)).toBeNull();
  });
});

describe('mapDailySeriesEntry', () => {
  const entry: ParsedDailySeriesEntry = {
    dateIso: '2026-09-02',
    gross: 0.1599846,
    tickets: 7890,
    shows: 35,
    occupancyPct: 79.7,
    capacity: 9897,
    lastUpdatedText: '2026-09-02 23:39 IST'
  };

  it('maps a daily series entry to a tracked-kind MappedSnapshot keyed on its own day', () => {
    const mapped = mapDailySeriesEntry(entry);
    expect(mapped).not.toBeNull();
    expect(mapped!.kind).toBe('tracked');
    expect(mapped!.source).toBe('moviemint');
    expect(mapped!.sourceCapturedAt).toBe(new Date('2026-09-02T18:09:00.000Z').toISOString());
    expect(mapped!.gross).toBe(0.1599846);
    expect(mapped!.tickets).toBe(7890);
    expect(mapped!.shows).toBe(35);
    expect(mapped!.occupancy).toBe(79.7);
    expect(mapped!.capacity).toBe(9897);
  });

  it('returns null when the entry has no parseable lastUpdatedText, since it cannot be safely deduped', () => {
    expect(mapDailySeriesEntry({ ...entry, lastUpdatedText: null })).toBeNull();
    expect(mapDailySeriesEntry({ ...entry, lastUpdatedText: 'garbage' })).toBeNull();
  });
});
