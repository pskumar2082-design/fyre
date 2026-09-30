// Daily MovieMint catalog sync: refresh the list of movies Fyre tracks and
// match any new ones to BFILMY. Writes with the service role.
//
//  new MovieMint movie        -> match; high confidence = tracked (active)
//                                and its history is queued for import;
//                                anything else = NEEDS REVIEW (admin decides)
//  still on MovieMint         -> stays active
//  no longer on MovieMint     -> tracking ended; history is never deleted
//  admin decisions (manual match, rejected, stopped) are never overwritten
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAliases, fetchSummary } from '@/lib/bfilmy/fetch';
import { buildAliasMap, normalizeSummaryFile, titleKey } from '@/lib/bfilmy/normalize';
import { applyStableSlugs, chunks, istDate } from '@/lib/bfilmy/sync';
import { fetchTrackedList, type MovieMintMovie } from './catalog';
import { exactKey, looseKey, matchMovie, type BfCandidate, type MatchResult } from './match';

export type CatalogSyncResult = {
  fetchedAt: string;
  movies: number;
  matched: number;
  needsReview: number;
  unmatched: number;
  newlyTracked: string[];
  ended: string[];
  errors: string[];
};

async function loadPool(): Promise<BfCandidate[]> {
  const out: BfCandidate[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('bf_movie')
      .select('slug,title,languages,formats,release_date,first_date,last_date,carried_over')
      .range(from, from + 999);
    if (error) throw new Error(`bf_movie: ${error.message}`);
    for (const m of (data ?? []) as any[])
      out.push({
        slug: m.slug,
        title: m.title,
        languages: m.languages ?? [],
        formats: m.formats ?? [],
        releaseDate: m.release_date,
        firstDate: m.first_date,
        lastDate: m.last_date,
        carriedOver: !!m.carried_over
      });
    if (!data || data.length < 1000) break;
  }
  return out;
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

// For MovieMint movies with no BFILMY movie stored yet (e.g. released after
// Fyre stopped importing untracked titles), look them up in BFILMY's own
// files around the release date. Nothing but the title identity is saved.
async function candidatesFromFiles(missing: MovieMintMovie[], aliasMap: Map<string, string>): Promise<BfCandidate[]> {
  const wanted = new Map<string, MovieMintMovie[]>();
  const dates = new Set<string>([istDate(0), istDate(-1)]);
  for (const m of missing) {
    for (const k of [exactKey(m.title, aliasMap), looseKey(m.title)]) wanted.set(k, [...(wanted.get(k) ?? []), m]);
    if (m.releaseDate) for (const d of [0, 1, 2]) dates.add(addDays(m.releaseDate, d));
  }
  const found = new Map<string, BfCandidate & { key: string }>();
  for (const date of [...dates].sort()) {
    const got = await fetchSummary('boxoffice', date).catch(() => null);
    if (!got) continue;
    for (const d of normalizeSummaryFile(got.file, 'boxoffice', date, aliasMap)) {
      if (!wanted.has(d.key) && !wanted.has(looseKey(d.title))) continue;
      const c = found.get(d.key) ?? {
        key: d.key,
        slug: '',
        title: d.title,
        languages: [],
        formats: [],
        releaseDate: null,
        firstDate: null,
        lastDate: null,
        carriedOver: false,
        seenOn: []
      };
      c.languages = [...new Set([...c.languages, ...d.totals.languages])];
      c.formats = [...new Set([...c.formats, ...d.totals.formats])];
      c.seenOn!.push(date);
      c.firstDate = c.firstDate && c.firstDate < date ? c.firstDate : date;
      c.lastDate = c.lastDate && c.lastDate > date ? c.lastDate : date;
      found.set(d.key, c);
    }
  }
  const list = [...found.values()];
  // Give each its stable Fyre slug (identity only, no box-office data).
  await applyStableSlugs(list);
  return list;
}

export async function syncMovieMintCatalog(): Promise<CatalogSyncResult> {
  const errors: string[] = [];
  const { movies, fetchedAt } = await fetchTrackedList();
  const aliasMap = buildAliasMap(await fetchAliases());
  const pool = await loadPool();

  const { data: existingRows, error: exErr } = await supabaseAdmin.from('fyre_tracked_movie').select('*');
  if (exErr) throw new Error(`fyre_tracked_movie: ${exErr.message}`);
  const existing = new Map((existingRows ?? []).map((r: any) => [r.moviemint_id, r]));

  // Upsert the MovieMint list itself.
  const now = new Date().toISOString();
  const mmRows = movies.map((m) => ({
    moviemint_id: m.id,
    title: m.title,
    language: m.language,
    release_date: m.releaseDate,
    poster: m.poster,
    badge: m.badge,
    source_url: m.sourceUrl,
    last_tracked_date: m.lastTrackedDate,
    on_list: true,
    last_seen: now,
    updated_at: now
  }));
  for (const batch of chunks(mmRows, 200)) {
    const { error } = await supabaseAdmin.from('mm_movie').upsert(batch, { onConflict: 'moviemint_id' });
    if (error) throw new Error(`mm_movie upsert: ${error.message}`);
  }
  const onList = new Set(movies.map((m) => m.id));
  const { data: allMm } = await supabaseAdmin.from('mm_movie').select('moviemint_id,on_list');
  const gone = (allMm ?? []).filter((r: any) => r.on_list && !onList.has(r.moviemint_id)).map((r: any) => r.moviemint_id);
  if (gone.length) {
    const { error } = await supabaseAdmin.from('mm_movie').update({ on_list: false, updated_at: now }).in('moviemint_id', gone);
    if (error) errors.push(`mm_movie off-list: ${error.message}`);
  }

  // Match movies that have no admin decision yet.
  const toMatch = movies.filter((m) => {
    const r = existing.get(m.id);
    return !r || (r.match_method !== 'manual' && r.match_status !== 'rejected' && r.match_status !== 'matched');
  });
  const poolKeys = new Set(pool.flatMap((c) => [exactKey(c.title, aliasMap), looseKey(c.title)]));
  const missing = toMatch.filter((m) => !poolKeys.has(exactKey(m.title, aliasMap)) && !poolKeys.has(looseKey(m.title)));
  const extra = missing.length ? await candidatesFromFiles(missing, aliasMap) : [];
  const fullPool = [...pool, ...extra.filter((e) => !pool.some((p) => p.slug === e.slug))];

  const matchedSlugs = new Map<string, string>(); // slug -> moviemint id already holding it
  for (const r of existingRows ?? []) if ((r as any).match_status === 'matched' && (r as any).bf_slug) matchedSlugs.set((r as any).bf_slug, (r as any).moviemint_id);

  const newlyTracked: string[] = [];
  const upserts: any[] = [];
  for (const m of toMatch) {
    let res: MatchResult = matchMovie(m, fullPool, aliasMap);
    if (res.status === 'matched' && res.slug && matchedSlugs.has(res.slug) && matchedSlugs.get(res.slug) !== m.id) {
      res = { ...res, status: 'needs_review', confidence: 'ambiguous', note: `BFILMY movie ${res.slug} is already matched to MovieMint "${matchedSlugs.get(res.slug)}"` };
    }
    if (res.status === 'matched' && res.slug) {
      matchedSlugs.set(res.slug, m.id);
      newlyTracked.push(m.id);
    }
    upserts.push({
      moviemint_id: m.id,
      bf_slug: res.slug,
      match_status: res.status,
      match_confidence: res.confidence,
      match_method: 'auto',
      match_note: res.note,
      candidates: res.candidates.slice(0, 8).map((c) => ({
        slug: c.slug,
        title: c.title,
        languages: c.languages,
        formats: c.formats,
        releaseDate: c.releaseDate,
        firstDate: c.firstDate,
        lastDate: c.lastDate,
        titleMatch: c.titleMatch,
        dateGap: c.dateGap,
        languageOk: c.languageOk
      })),
      tracking_status: res.status === 'matched' ? 'active' : 'pending',
      backfill_status: res.status === 'matched' ? 'requested' : null,
      backfill_requested_at: res.status === 'matched' ? now : null,
      updated_at: now
    });
  }
  for (const batch of chunks(upserts, 100)) {
    const { error } = await supabaseAdmin.from('fyre_tracked_movie').upsert(batch, { onConflict: 'moviemint_id' });
    if (error) throw new Error(`fyre_tracked_movie upsert: ${error.message}`);
  }

  // Tracking status from list membership (history is always kept).
  const ended: string[] = [];
  for (const r of existingRows ?? []) {
    const row = r as any;
    if (row.match_status !== 'matched') continue;
    if (!onList.has(row.moviemint_id) && row.tracking_status === 'active') {
      ended.push(row.moviemint_id);
      await supabaseAdmin.from('fyre_tracked_movie').update({ tracking_status: 'ended', ended_at: now, updated_at: now }).eq('moviemint_id', row.moviemint_id);
    } else if (onList.has(row.moviemint_id) && row.tracking_status === 'ended') {
      await supabaseAdmin.from('fyre_tracked_movie').update({ tracking_status: 'active', ended_at: null, updated_at: now }).eq('moviemint_id', row.moviemint_id);
    }
  }

  const { data: after } = await supabaseAdmin.from('fyre_tracked_movie').select('moviemint_id,match_status');
  const onListRows = (after ?? []).filter((r: any) => onList.has(r.moviemint_id));
  const count = (s: string) => onListRows.filter((r: any) => r.match_status === s).length;
  const result: CatalogSyncResult = {
    fetchedAt,
    movies: movies.length,
    matched: count('matched'),
    needsReview: count('needs_review'),
    unmatched: count('unmatched'),
    newlyTracked,
    ended,
    errors
  };
  await supabaseAdmin.from('bf_sync_state').upsert({ key: 'last_moviemint_sync', value: result, updated_at: now }, { onConflict: 'key' });
  return result;
}

