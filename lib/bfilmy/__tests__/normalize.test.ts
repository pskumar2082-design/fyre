import { describe, expect, it } from 'vitest';
import {
  buildAliasMap,
  buildPosterMap,
  canonicalTitle,
  normalizeSummaryFile,
  parseEntryKey,
  slugify,
  titleKey
} from '../normalize';
import type { BfRawSummaryFile } from '../types';

const city = (city: string, state: string, gross: number, sold: number, totalSeats: number, shows = 4) => ({
  city,
  state,
  venues: 1,
  shows,
  gross,
  sold,
  totalSeats,
  fastfilling: 0,
  housefull: 0,
  occupancy: 0
});
const chain = (name: string, gross: number, sold: number, totalSeats: number) => ({
  chain: name,
  venues: 2,
  shows: 8,
  gross,
  sold,
  totalSeats,
  fastfilling: 1,
  housefull: 0,
  occupancy: 0
});

const FILE: BfRawSummaryFile = {
  last_updated: '2026-09-28 23:26 IST',
  movies: {
    'The Paradise [2D | Telugu]': {
      shows: 8,
      gross: 3000,
      sold: 30,
      totalSeats: 100,
      venues: 2,
      cities: 2,
      fastfilling: 1,
      housefull: 0,
      occupancy: 30,
      details: [city('Hyderabad', 'Telangana', 2000, 20, 60), city('Vijayawada', 'Andhra Pradesh', 1000, 10, 40)],
      Chain_details: [chain('PVR', 2000, 20, 60), chain('Asian Cinemas', 1000, 10, 40)]
    },
    'The Paradise [EPIQ | Telugu]': {
      shows: 2,
      gross: 1000,
      sold: 5,
      totalSeats: 50,
      venues: 1,
      cities: 1,
      fastfilling: 0,
      housefull: 1,
      occupancy: 10,
      details: [city('Hyderabad', 'Telangana', 1000, 5, 50, 2)],
      Chain_details: [chain('PVR', 1000, 5, 50)]
    },
    'The Paradise [2D | Hindi]': {
      shows: 4,
      gross: 500,
      sold: 5,
      totalSeats: 50,
      venues: 1,
      cities: 1,
      fastfilling: 0,
      housefull: 0,
      occupancy: 10,
      details: [city('Mumbai', 'Maharashtra', 500, 5, 50)],
      Chain_details: [chain('PVR', 500, 5, 50)]
    },
    'The Vvaan [2D | Hindi]': {
      shows: 1,
      gross: 100,
      sold: 1,
      totalSeats: 10,
      venues: 1,
      cities: 1,
      fastfilling: 0,
      housefull: 0,
      occupancy: 10,
      details: [city('Delhi', 'Delhi', 100, 1, 10, 1)]
    }
  }
};

const ALIASES = { 'The Vvaan - Force of the Forrest': ['The Vvaan - Force of the Forrest', 'The Vvaan'] };

describe('parseEntryKey', () => {
  it('splits title, format and language', () => {
    expect(parseEntryKey('The Paradise [DOLBY CINEMA 2D | Telugu]')).toEqual({
      title: 'The Paradise',
      format: 'DOLBY CINEMA 2D',
      language: 'Telugu'
    });
    expect(parseEntryKey('Adventure of Iceberg 7D - Combo [7D | English 7D]')).toEqual({
      title: 'Adventure of Iceberg 7D - Combo',
      format: '7D',
      language: 'English 7D'
    });
  });
  it('keeps an unparseable key as the title instead of dropping it', () => {
    expect(parseEntryKey('Weird Key')).toEqual({ title: 'Weird Key', format: 'Unknown', language: 'Unknown' });
  });
});

describe('titles and slugs', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(titleKey('Toxic: A Fairy Tale For Grown-ups')).toBe(titleKey('Toxic - A fairy tale for grown ups'));
  });
  it('makes URL-safe slugs', () => {
    expect(slugify('Pushpa 2: The Rule')).toBe('pushpa-2-the-rule');
    expect(slugify("I'm Game")).toBe('i-m-game');
  });
  it('maps BFILMY spelling variants to their canonical title', () => {
    const map = buildAliasMap(ALIASES);
    expect(canonicalTitle('The Vvaan', map)).toBe('The Vvaan - Force of the Forrest');
    expect(canonicalTitle('Unrelated', map)).toBe('Unrelated');
  });
});

describe('normalizeSummaryFile', () => {
  const days = normalizeSummaryFile(FILE, 'boxoffice', '2026-09-28', buildAliasMap(ALIASES));
  const paradise = days.find((d) => d.slug === 'the-paradise')!;

  it('groups every format and dubbed language of a film into one movie', () => {
    expect(days.map((d) => d.slug).sort()).toEqual(['the-paradise', 'the-vvaan-force-of-the-forrest']);
    expect(paradise.breakdown.entries).toHaveLength(3);
    expect(paradise.totals.languages).toEqual(['Hindi', 'Telugu']);
    expect(paradise.totals.formats).toEqual(['2D', 'EPIQ']);
  });

  it('sums additive figures exactly and recomputes occupancy from sold / seats', () => {
    expect(paradise.totals.gross).toBe(4500);
    expect(paradise.totals.sold).toBe(40);
    expect(paradise.totals.shows).toBe(14);
    expect(paradise.totals.totalSeats).toBe(200);
    expect(paradise.totals.occupancy).toBe(20);
    expect(paradise.totals.housefull).toBe(1);
  });

  it('counts distinct cities, not the sum of per-entry city counts', () => {
    expect(paradise.totals.cities).toBe(3); // Hyderabad appears in two entries
  });

  it('builds exact state, city, chain, format and language tables sorted by gross', () => {
    expect(paradise.breakdown.states.map((s) => [s.name, s.gross])).toEqual([
      ['Telangana', 3000],
      ['Andhra Pradesh', 1000],
      ['Maharashtra', 500]
    ]);
    const hyd = paradise.breakdown.cities[0];
    expect([hyd.name, hyd.state, hyd.gross, hyd.sold, hyd.shows]).toEqual(['Hyderabad', 'Telangana', 3000, 25, 6]);
    expect(paradise.breakdown.chains[0]).toMatchObject({ name: 'PVR', gross: 3500, sold: 30 });
    expect(paradise.breakdown.formats.map((f) => f.name)).toEqual(['2D', 'EPIQ']);
    expect(paradise.breakdown.languages.map((l) => [l.name, l.gross])).toEqual([
      ['Telugu', 4000],
      ['Hindi', 500]
    ]);
  });

  it('never sums venue counts across entries', () => {
    expect('venues' in paradise.totals).toBe(false);
    expect('venues' in paradise.breakdown.states[0]).toBe(false);
    expect(paradise.breakdown.entries.every((e) => typeof e.venues === 'number')).toBe(true);
  });

  it('carries the file timestamp', () => {
    expect(paradise.sourceUpdated).toBe('2026-09-28 23:26 IST');
    expect(paradise.kind).toBe('boxoffice');
    expect(paradise.date).toBe('2026-09-28');
  });

  it('tolerates an empty or malformed file', () => {
    expect(normalizeSummaryFile({ movies: {} }, 'advance', '2026-09-30', new Map())).toEqual([]);
    expect(normalizeSummaryFile({} as any, 'advance', '2026-09-30', new Map())).toEqual([]);
  });
});

describe('buildPosterMap', () => {
  it('maps both District titles to the poster URL and skips rows without one', () => {
    const map = buildPosterMap([
      [1, 'The Paradise', 'The Paradise', 'Telugu', '', 180, 'A', 'https://cdn.district.in/p.jpg', 1],
      [2, 'No Poster', 'No Poster', 'Hindi', '', 120, 'U', '', 1],
      'junk'
    ]);
    expect(map.get(titleKey('the paradise'))).toBe('https://cdn.district.in/p.jpg');
    expect(map.has(titleKey('No Poster'))).toBe(false);
  });
});

import { chainFromTuple, cityFromTuple, toStoredBreakdown } from '../normalize';

describe('compact storage round-trip', () => {
  it('stores cities/chains as tuples and restores them losslessly', () => {
    const day = normalizeSummaryFile(FILE, 'boxoffice', '2026-09-28', new Map()).find((d) => d.slug === 'the-paradise')!;
    const stored = toStoredBreakdown(day.breakdown);
    expect(stored.cities[0]).toEqual(['Hyderabad', 'Telangana', 3000, 25, 6, 110, 0, 0]);
    expect(stored.cities.map((t) => cityFromTuple(t))).toEqual(day.breakdown.cities);
    expect(stored.chains.map((t) => chainFromTuple(t))).toEqual(day.breakdown.chains);
    expect(stored.states).toBe(day.breakdown.states);
  });
});

import { baseTitle, groupKey } from '../normalize';

describe('same-film grouping (correctness)', () => {
  const aliases = buildAliasMap({ 'Drishyam 3  (Malayalam)': ['Drishyam 3', 'Drishyam 3 (Malayalam)'] });

  it('treats spacing/punctuation variants as one film', () => {
    expect(groupKey('Mana Shankara Vara Prasad Garu', aliases)).toBe(groupKey('Mana Shankara Varaprasad Garu', aliases));
    expect(groupKey('City Lights', aliases)).toBe(groupKey('Citylights', aliases));
  });

  it('strips only language tags and women-only screening tags', () => {
    expect(baseTitle('Youth (Telugu)')).toBe('Youth');
    expect(baseTitle('Laalo - Krishna Sada Sahaayate (Hindi)')).toBe('Laalo - Krishna Sada Sahaayate');
    expect(baseTitle('Jana Nayagan (Exclusively For Women)')).toBe('Jana Nayagan');
    expect(baseTitle('Thaai Kizhavi (Exclusive Screening for Women)')).toBe('Thaai Kizhavi');
    expect(baseTitle('Krishnavataram Part 1: The Heart [Hridayam]')).toBe('Krishnavataram Part 1: The Heart [Hridayam]');
    expect(baseTitle('Kantara: A Legend Chapter-1')).toBe('Kantara: A Legend Chapter-1');
  });

  it('never merges sequels or look-alike titles', () => {
    for (const [a, b] of [
      ['Dhurandhar', 'Dhurandhar The Revenge'],
      ['Jolly Llb 2', 'Jolly Llb 3'],
      ['Mirai', 'Miral'],
      ['Hit: The First Case', 'Hit: The Third Case'],
      ['Sardar', 'Sardar 2'],
      ['Kantara', 'Kantara: A Legend Chapter-1']
    ]) {
      expect(groupKey(a, aliases)).not.toBe(groupKey(b, aliases));
    }
  });

  it('applies the curated spelling merges', () => {
    expect(groupKey('Thama', aliases)).toBe(groupKey('Thamma', aliases));
    expect(groupKey('Housefull 5b', aliases)).toBe(groupKey('Housefull 5', aliases));
    expect(canonicalTitle('Thama', aliases)).toBe('Thamma');
    expect(groupKey('Hrudayam Murali', aliases)).toBe(groupKey('Hrudhayam Murali', aliases));
    expect(groupKey('Mahendragiri Vaaraahi', aliases)).toBe(groupKey('Mahendragiri Varahi', aliases));
  });

  it("follows BFILMY's own merges for language-tagged titles", () => {
    expect(groupKey('Drishyam 3 (Malayalam)', aliases)).toBe(groupKey('Drishyam 3', aliases));
  });

  it('groups a file by film identity, carrying the key for the stable slug lookup', () => {
    const f = (gross: number) => ({ shows: 1, gross, sold: 1, totalSeats: 10, venues: 1, cities: 1, fastfilling: 0, housefull: 0, occupancy: 10 });
    const days = normalizeSummaryFile(
      { movies: { 'Mana Shankara Vara Prasad Garu [2D | Telugu]': f(100), 'Mana Shankara Varaprasad Garu [2D | Telugu]': f(50), 'Youth (Telugu) [2D | Telugu]': f(5), 'Youth [2D | Tamil]': f(7) } },
      'boxoffice',
      '2026-01-12',
      aliases
    );
    expect(days).toHaveLength(2);
    const msvp = days.find((d) => d.key === titleKey('Mana Shankara Varaprasad Garu'))!;
    expect(msvp.totals.gross).toBe(150);
    const youth = days.find((d) => d.key === 'youth')!;
    expect(youth.totals.languages).toEqual(['Tamil', 'Telugu']);
    expect(youth.totals.gross).toBe(12);
  });
});
