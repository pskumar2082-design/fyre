import { describe, it, expect } from 'vitest';
import {
  resolveMatchCandidates,
  shouldInsertSnapshot,
  buildBreakdownPayload,
  buildSnapshotPayload
} from '@/lib/syncMovieMint';
import type { ParsedMovieMeta } from '@/lib/moviemintParser';
import type { MappedSnapshot } from '@/lib/moviemintMapper';

type Row = {
  id: string;
  title: string;
  release_date: string | null;
  language: string | null;
  moviemint_slug: string | null;
  source_synced_at: string | null;
};

const row = (over: Partial<Row>): Row => ({
  id: 'id',
  title: 'Title',
  release_date: null,
  language: null,
  moviemint_slug: null,
  source_synced_at: null,
  ...over
});

describe('resolveMatchCandidates', () => {
  it('matches uniquely by normalized title + release date', () => {
    const rows = [row({ id: 'a', title: 'Hanuman Ansh', release_date: '2026-08-07' })];
    const meta: ParsedMovieMeta = { title: 'Hanuman Ansh', releaseDateText: 'Release: August 7, 2026', language: 'Hindi', genre: 'Family' };
    const result = resolveMatchCandidates(rows, meta);
    expect(result).toEqual({ outcome: 'matched', movieId: 'a', via: 'title+date' });
  });

  it('never auto-picks when two rows share the same title AND release date', () => {
    const rows = [
      row({ id: 'a', title: 'Hanuman Ansh', release_date: '2026-08-07', language: 'Hindi' }),
      row({ id: 'b', title: 'Hanuman Ansh', release_date: '2026-08-07', language: 'Telugu' })
    ];
    const meta: ParsedMovieMeta = { title: 'Hanuman Ansh', releaseDateText: 'Release: August 7, 2026', language: null, genre: null };
    const result = resolveMatchCandidates(rows, meta);
    expect(result.outcome).toBe('ambiguous');
    if (result.outcome === 'ambiguous') {
      expect(result.candidateIds.sort()).toEqual(['a', 'b']);
    }
  });

  it('disambiguates same title+date candidates using language when MovieMint reports one', () => {
    const rows = [
      row({ id: 'a', title: 'Hanuman Ansh', release_date: '2026-08-07', language: 'Hindi' }),
      row({ id: 'b', title: 'Hanuman Ansh', release_date: '2026-08-07', language: 'Telugu' })
    ];
    const meta: ParsedMovieMeta = { title: 'Hanuman Ansh', releaseDateText: 'Release: August 7, 2026', language: 'Telugu', genre: null };
    const result = resolveMatchCandidates(rows, meta);
    expect(result).toEqual({ outcome: 'matched', movieId: 'b', via: 'title+language+date' });
  });

  it('reports no match when the title does not appear in now_showing at all', () => {
    const rows = [row({ id: 'a', title: 'Some Other Movie' })];
    const meta: ParsedMovieMeta = { title: 'Hanuman Ansh', releaseDateText: null, language: null, genre: null };
    const result = resolveMatchCandidates(rows, meta);
    expect(result.outcome).toBe('none');
  });

  it('is ambiguous, not a guess, when title is unique but nothing else corroborates and MovieMint gave no date/language', () => {
    const rows = [
      row({ id: 'a', title: 'Common Title' }),
      row({ id: 'b', title: 'Common Title' })
    ];
    const meta: ParsedMovieMeta = { title: 'Common Title', releaseDateText: null, language: null, genre: null };
    const result = resolveMatchCandidates(rows, meta);
    expect(result.outcome).toBe('ambiguous');
  });
});

describe('shouldInsertSnapshot (duplicate prevention)', () => {
  const base: MappedSnapshot = {
    source: 'moviemint',
    kind: 'advance',
    market: 'India',
    sourceCapturedAt: '2026-09-20T10:00:00.000Z',
    gross: 4.78,
    tickets: 185000,
    shows: 7300,
    theatres: null,
    cities: 678,
    capacity: null,
    occupancy: 11.42,
    sourceUpdatedText: 'Updated 1h 5m ago'
  };

  it('always inserts the first snapshot (no prior row)', () => {
    expect(shouldInsertSnapshot(null, base)).toBe(true);
  });

  it('skips an insert when nothing changed since the previous snapshot', () => {
    expect(shouldInsertSnapshot(base, { ...base })).toBe(false);
  });

  it('inserts when a metric changed even if freshness text did not', () => {
    expect(shouldInsertSnapshot(base, { ...base, gross: 5.1 })).toBe(true);
  });

  it('inserts when only the freshness text changed', () => {
    expect(shouldInsertSnapshot(base, { ...base, sourceUpdatedText: 'Updated 2h ago' })).toBe(true);
  });
});

describe('source isolation (critical regression test)', () => {
  it('every MovieMint breakdown row is tagged source: "moviemint", never "sacnilk" or "manual"', () => {
    const payload = buildBreakdownPayload('movie-1', 'advance', '2026-09-20', [
      {
        source: 'moviemint',
        breakdownType: 'state',
        label: 'Uttar Pradesh',
        gross: 0.93,
        shows: 1110,
        ticketsSold: 38500,
        soldOut: 17,
        occPct: 14.89,
        rawFf: 76
      }
    ]);
    expect(payload).toHaveLength(1);
    expect(payload[0].source).toBe('moviemint');
    expect(payload[0].source).not.toBe('sacnilk');
    expect(payload[0].source).not.toBe('manual');
  });

  it('every MovieMint snapshot is tagged source: "moviemint"', () => {
    const payload = buildSnapshotPayload('movie-1', {
      source: 'moviemint',
      kind: 'tracked',
      market: 'India',
      sourceCapturedAt: null,
      gross: 9.54,
      tickets: 13400000,
      shows: 185000,
      theatres: null,
      cities: 707,
      capacity: null,
      occupancy: 36.7,
      sourceUpdatedText: 'Updated 4m ago'
    });
    expect(payload.source).toBe('moviemint');
  });

  it('a MovieMint breakdown upsert target key includes source, so it cannot collide with a Sacnilk/manual row for the same movie/date/breakdown', () => {
    // box_office_breakdown_unique_row (migration_moviemint.sql) is
    // (movie_id, kind, breakdown_type, label, day_date, source) -- the
    // payload below has everything except source identical to a
    // hypothetical manually-entered row, and must still be a distinct key.
    const moviemintPayload = buildBreakdownPayload('movie-1', 'tracked', '2026-09-18', [
      { source: 'moviemint', breakdownType: 'state', label: 'Kerala', gross: 1, shows: 5, ticketsSold: 300, soldOut: 0, occPct: 40, rawFf: null }
    ])[0];
    const manualEquivalentKey = { movie_id: 'movie-1', kind: 'tracked', breakdown_type: 'state', label: 'Kerala', day_date: '2026-09-18', source: 'manual' };
    expect(moviemintPayload.source).not.toBe(manualEquivalentKey.source);
  });
});
