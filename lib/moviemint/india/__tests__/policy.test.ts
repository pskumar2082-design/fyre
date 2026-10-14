import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the Supabase admin client: records every write.
const writes: { table: string; op: string; rows?: unknown }[] = [];
const stateRows = new Map<string, unknown>();
function builder(table: string) {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    gte: () => q,
    lt: () => q,
    not: () => q,
    order: () => q,
    range: async () => ({ data: [], error: null }),
    maybeSingle: async () => ({ data: table === 'bf_sync_state' ? null : null, error: null }),
    upsert: async (rows: any) => {
      writes.push({ table, op: 'upsert', rows });
      if (table === 'bf_sync_state') stateRows.set(rows.key, rows.value);
      return { data: null, error: null };
    },
    update: () => {
      writes.push({ table, op: 'update' });
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
vi.mock('../../sync', () => ({
  syncMovieMintCatalog: vi.fn(async () => {
    throw new Error('MovieMint /tracked answered HTTP 503');
  })
}));

describe('MovieMint sync failure', () => {
  beforeEach(() => {
    writes.length = 0;
    stateRows.clear();
  });
  afterEach(() => vi.clearAllMocks());

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
