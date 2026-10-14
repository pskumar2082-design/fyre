import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moviePage } from './fixtures';

// In-memory stand-in for the Supabase admin client: records every write.
const writes: { table: string; op: string; rows?: any; patch?: any }[] = [];
const stateRows = new Map<string, unknown>();
const missingTables = new Set<string>();
function builder(table: string) {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    gte: () => q,
    lt: () => q,
    not: () => q,
    order: () => q,
    limit: async () => (missingTables.has(table) ? { data: null, error: { message: `relation "${table}" does not exist` } } : { data: [], error: null }),
    range: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    upsert: async (rows: any) => {
      writes.push({ table, op: 'upsert', rows });
      if (table === 'bf_sync_state') stateRows.set(rows.key, rows.value);
      return { data: null, error: null };
    },
    update: (patch: any) => {
      writes.push({ table, op: 'update', patch });
      return q;
    },
    insert: async (rows: any) => {
      writes.push({ table, op: 'insert', rows });
      return { data: null, error: null };
    },
    delete: () => {
      writes.push({ table, op: 'delete' });
      return q;
    },
    then: undefined
  };
  return q;
}
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } }));
// MovieMint down: every request answers 503.
vi.mock('axios', () => ({ default: { get: vi.fn(async () => ({ status: 503, data: '' })) } }));

beforeEach(() => {
  writes.length = 0;
  stateRows.clear();
  missingTables.clear();
});
afterEach(() => vi.clearAllMocks());

describe('MovieMint sync failure', () => {
  it('stops at the catalog, keeps every stored catalog/data row, records the failure', async () => {
    const { runMovieMintIndia } = await import('../sync');
    const r = await runMovieMintIndia({ deadline: Date.now() + 10_000, forceCatalog: true });
    expect(r.stoppedBy).toBe('catalog');
    expect(r.pages).toEqual([]);
    expect(r.errors[0]).toMatch(/MovieMint unavailable.*kept the last good catalog/);
    // nothing written anywhere except the sync-state notes
    expect(writes.filter((w) => w.table !== 'bf_sync_state')).toEqual([]);
    expect(writes.some((w) => w.op === 'delete')).toBe(false);
    expect(stateRows.has('last_mmi_sync')).toBe(true);
    expect((stateRows.get('mmi_failures') as any).list[0]).toMatchObject({ page: 'catalog' });
  });

  it('refuses to run before migration 2 (no writes, clear instruction)', async () => {
    missingTables.add('mmi_snapshot');
    const { runMovieMintIndia } = await import('../sync');
    await expect(runMovieMintIndia({ deadline: Date.now() + 10_000 })).rejects.toThrow(/migration_moviemint_india_2\.sql/);
    expect(writes).toEqual([]);
  });
});

describe('writing pages', () => {
  const m = { moviemintId: 'test-movie', movieId: 'test-movie', slug: 'test-movie', title: 'Test Movie', poster: null, language: 'Telugu', releaseDate: '2026-09-24', onList: true, onAdvance: false, lastTrackedDate: '2026-10-14', stopped: false };
  const summary = { totalGross: 500, totalShows: 3, totalTicketsSold: 5, totalSeats: 50, totalLocations: 2, avgOccupancy: 10, totalFastFilling: 0, totalHouseFull: 0 };
  const series = [
    { date: '20261013', gross: 1000, ticketsSold: 10, shows: 4, avgOccupancy: 20, lastUpdated: '2026-10-13 23:40 IST', totalSeats: 50 },
    { date: '20261014', gross: 500, ticketsSold: 5, shows: 3, avgOccupancy: 10, lastUpdated: '2026-10-14 20:40 IST' }
  ];

  it('live view: window rows (tracked) + one intraday snapshot', async () => {
    const { parseMoviePage } = await import('../parse');
    const { writePage } = await import('../sync');
    const page = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: { date: '20261014', lastUpdated: '2026-10-14 20:40 IST', summary }, completedAsOf: '20:40 IST' }), 'test-movie', 'boxoffice');
    const w = await writePage(page, m, '2026-10-14');
    const dayRows = writes.filter((x) => x.table === 'mmi_movie_day' && x.op === 'upsert').flatMap((x) => x.rows);
    expect(dayRows.map((r: any) => [r.date, r.day_window])).toEqual([
      ['2026-10-13', 'tracked'],
      ['2026-10-14', 'tracked']
    ]);
    expect(dayRows[1]).toMatchObject({ breakdown_status: 'live', totals: { completedAsOf: '20:40 IST' } });
    const snap = writes.find((x) => x.table === 'mmi_snapshot');
    expect(snap?.rows).toMatchObject({ show_date: '2026-10-14', completed_as_of: '20:40 IST', kind: 'boxoffice' });
    expect(w.meta).toMatchObject({ latestSnapshot: '2026-10-14', windowDates: 2, backdrop: 'https://image.tmdb.org/t/p/w1280/b.jpg' });
    expect(writes.some((x) => x.op === 'delete')).toBe(false);
  });

  it('cumulative report: stored on the movie, never as a day', async () => {
    const { parseMoviePage } = await import('../parse');
    const { writePage } = await import('../sync');
    const page = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: { date: 'cumulative', lastUpdated: '2026-10-14 20:40 IST', summary: { ...summary, totalGross: 1500 } } }), 'test-movie', 'boxoffice', 'cumulative');
    await writePage(page, m, '2026-10-14');
    expect(writes.filter((x) => x.table === 'mmi_movie_day')).toEqual([]);
    const u = writes.find((x) => x.table === 'mmi_movie' && x.op === 'update');
    expect(u?.patch).toMatchObject({ cumulative: { summary: { gross: 1500 } }, cumulative_updated: '2026-10-14 20:40 IST' });
  });
});

describe('USA targets under the MovieMint policy', () => {
  it('only MovieMint catalog movies; BFILMY-only movies never; India Day 1 from MovieMint', async () => {
    const { buildPolicyTrackedMovies } = await import('../usaCatalog');
    const links = [
      { moviemint_id: 'the-paradise', movie_id: 'the-paradise', slug: 'the-paradise' }, // India + USA
      { moviemint_id: 'premada-oorali', movie_id: 'premada-oorali', slug: 'premada-oorali' }, // India only
      { moviemint_id: 'don-t-trouble-the-trouble', movie_id: 'fyre-1e7c787d', slug: 'dont-trouble-the-trouble' }, // USA-created, now MovieMint
      { moviemint_id: 'desu7', movie_id: 'desu7', slug: 'desu7' } // no collections yet
    ];
    const mm = [
      { moviemint_id: 'the-paradise', title: 'The Paradise', release_date: '2026-09-24', language: 'Telugu' },
      { moviemint_id: 'premada-oorali', title: 'Premada Oorali', release_date: '2026-09-25', language: 'Kannada' },
      { moviemint_id: 'don-t-trouble-the-trouble', title: "Don't Trouble The Trouble", release_date: '2026-10-02', language: 'Telugu' },
      { moviemint_id: 'desu7', title: 'DeSu7', release_date: '2026-10-16', language: 'Bangla' }
    ];
    const india = [{ slug: 'the-paradise', title: 'The Paradise', release_date: '2026-09-24', first_date: '2026-09-23', carried_over: false, languages: ['Telugu', 'Hindi'] }];
    const fyre = [
      { moviemint_id: 'the-paradise', title: 'The Paradise', tracking_status: 'active', origin: 'moviemint', languages: ['Telugu'] },
      { moviemint_id: 'fyre-1e7c787d', title: "Don't Trouble The Trouble", tracking_status: 'active', origin: 'bfilmy_usa', languages: ['Telugu'], first_source_date: '2026-10-01' },
      { moviemint_id: 'fyre-only', title: 'Thudakkam', tracking_status: 'active', origin: 'bfilmy_india', languages: ['Malayalam'] }, // BFILMY-only
      { moviemint_id: 'premada-oorali', title: 'Premada Oorali', tracking_status: 'stopped', origin: 'moviemint', languages: [] }
    ];
    const aliases = [{ movie_id: 'fyre-1e7c787d', source_title: 'Dont Trouble the Trouble (Telugu)' }];
    const t = buildPolicyTrackedMovies(links, mm, india, fyre, aliases);
    expect(t.map((x) => x.movieId)).toEqual(['the-paradise', 'premada-oorali', 'fyre-1e7c787d', 'desu7']);
    expect(t.find((x) => x.movieId === 'fyre-only')).toBeUndefined();
    const p = t[0];
    expect(p).toMatchObject({ slug: 'the-paradise', indiaDayOne: '2026-09-24', hasIndia: true, active: true });
    expect(t[1]).toMatchObject({ active: false, hasIndia: false, indiaDayOne: '2026-09-25' });
    expect(t[2].titles).toEqual(["Don't Trouble The Trouble", 'Dont Trouble the Trouble (Telugu)']);
    expect(t[2]).toMatchObject({ slug: 'dont-trouble-the-trouble', dayOne: '2026-10-02' });
    expect(t[3]).toMatchObject({ hasIndia: false, indiaDayOne: '2026-10-16', languages: ['Bangla'] });
  });
});
