// The background job: pull BFILMY's public files, normalize them, and
// write them to Supabase (bf_movie_day / bf_movie -- see
// supabase/migration_bfilmy.sql). Pages never call BFILMY directly; they
// only read what this job stored, so fyre keeps working (with the last
// synced numbers) even if BFILMY is briefly unreachable.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAliases, fetchPosterRows, fetchSummary } from './fetch';
import { buildPosterMap, normalizeSummaryFile, slugify, titleKey, toStoredBreakdown } from './normalize';
import type { BfKind, BfMovieDay } from './types';
import { fyreAliasMap } from '@/lib/catalog/aliases';
import { discoverIndia, type DiscoveryCache } from '@/lib/catalog/listings';
import { refreshCatalogMetadata } from '@/lib/catalog/admin';

// Calendar date in India (BFILMY's day boundaries), offset by whole days.
export function istDate(offsetDays = 0, now: Date = new Date()): string {
  return new Date(now.getTime() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export type SyncTarget = { kind: BfKind; date: string };

export type SyncFileResult = {
  kind: BfKind;
  date: string;
  status: 'ok' | 'missing' | 'error';
  movies?: number;
  skipped?: number; // titles in the file that aren't tracked (not stored)
  sourceUpdated?: string | null;
  url?: string;
  error?: string;
};

export type SyncResult = {
  startedAt: string;
  finishedAt: string;
  files: SyncFileResult[];
  moviesRefreshed: number;
  postersSet: number;
  advancePruned: number;
  // Discovery (scheduled runs): India titles that became Fyre movies this run.
  listings?: { writes: number; attached: string[]; created: string[]; review: number; newSlugs: string[]; titles: number };
  errors: string[];
};

// A regular run: today's and yesterday's box office (yesterday keeps
// getting late-night updates until BFILMY finalizes it) plus advance
// bookings for today through four days out -- as far ahead as BFILMY
// publishes (checked 29 Sep 2026: +3/+4 days exist, +5 onwards 404; a
// date with no file yet is simply skipped).
export function defaultTargets(now: Date = new Date()): SyncTarget[] {
  return [
    { kind: 'boxoffice', date: istDate(0, now) },
    { kind: 'boxoffice', date: istDate(-1, now) },
    ...[0, 1, 2, 3, 4].map((d) => ({ kind: 'advance' as const, date: istDate(d, now) }))
  ];
}

// Every date from `from` to `to` inclusive, as YYYY-MM-DD.
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function toRow(d: BfMovieDay, syncedAt: string) {
  return {
    slug: d.slug,
    kind: d.kind,
    date: d.date,
    title: d.title,
    totals: d.totals,
    breakdown: toStoredBreakdown(d.breakdown),
    source_updated: d.sourceUpdated,
    pruned: false,
    synced_at: syncedAt
  };
}

export function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Batches by payload size as well as row count: one big film's day (full
// city and chain lists) can be ~100KB, and a single oversized request
// body would fail the whole batch.
export function sizeBatches<T>(rows: T[], maxBytes = 400_000, maxRows = 25): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let bytes = 0;
  for (const r of rows) {
    const size = JSON.stringify(r).length;
    if (cur.length > 0 && (bytes + size > maxBytes || cur.length >= maxRows)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += size;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function upsertDays(days: BfMovieDay[]): Promise<void> {
  const syncedAt = new Date().toISOString();
  for (const batch of sizeBatches(days.map((d) => toRow(d, syncedAt)))) {
    const { error } = await supabaseAdmin.from('bf_movie_day').upsert(batch, { onConflict: 'slug,kind,date' });
    if (error) throw new Error(`bf_movie_day upsert: ${error.message}`);
  }
}

// Picks a URL slug for a new film identity: the plain slug if free,
// otherwise the first free "-2", "-3", ... variant. Pure, for testing.
export function pickSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

// Replaces each day's provisional slug/title with the stable ones stored
// for its film identity (bf_title_key), creating entries for films seen
// for the first time. This is what keeps "Mana Shankara Vara Prasad Garu"
// and "Mana Shankara Varaprasad Garu" on one page, under one URL, whichever
// spelling a given day's file uses.
export async function applyStableSlugs<T extends { key: string; title: string; slug: string }>(days: T[]): Promise<void> {
  const keys = [...new Set(days.map((d) => d.key))];
  const known = new Map<string, { slug: string; title: string }>();
  for (const batch of chunks(keys, 200)) {
    const { data, error } = await supabaseAdmin.from('bf_title_key').select('key,slug,title').in('key', batch);
    if (error) throw new Error(`bf_title_key lookup: ${error.message}`);
    for (const r of data ?? []) known.set(r.key, { slug: r.slug, title: r.title });
  }

  const fresh = days.filter((d) => !known.has(d.key));
  if (fresh.length) {
    // Which of the slugs we might hand out are already used -- the plain
    // slug and its first few numbered variants, checked in one query per
    // 300 names rather than one query per film.
    const candidates = [...new Set(fresh.map((d) => slugify(d.title)))];
    const probe = candidates.flatMap((b) => [b, ...Array.from({ length: 8 }, (_, i) => `${b}-${i + 2}`)]);
    const taken = new Set<string>();
    for (const batch of chunks(probe, 300)) {
      const { data, error } = await supabaseAdmin.from('bf_title_key').select('slug').in('slug', batch);
      if (error) throw new Error(`bf_title_key slug check: ${error.message}`);
      for (const r of data ?? []) taken.add(r.slug);
    }
    const inserts: { key: string; slug: string; title: string }[] = [];
    for (const d of fresh) {
      if (known.has(d.key)) continue;
      const slug = pickSlug(slugify(d.title), taken);
      taken.add(slug);
      known.set(d.key, { slug, title: d.title });
      inserts.push({ key: d.key, slug, title: d.title });
    }
    for (const batch of chunks(inserts, 200)) {
      const { error } = await supabaseAdmin.from('bf_title_key').insert(batch);
      if (error) throw new Error(`bf_title_key insert: ${error.message}`);
    }
  }

  for (const d of days) {
    const k = known.get(d.key)!;
    d.slug = k.slug;
    d.title = k.title;
  }
}

async function refreshMovies(slugs: string[]): Promise<void> {
  for (const batch of chunks(slugs, 10)) {
    const { error } = await supabaseAdmin.rpc('bf_refresh_movies', { p_slugs: batch });
    if (error) throw new Error(`bf_refresh_movies: ${error.message}`);
  }
}

// Fills in posters (from BFILMY's District movie list) for movies that
// don't have one yet. Titles are matched loosely (case/punctuation/spacing
// ignored); a movie with no match simply keeps no poster.
async function fillPosters(): Promise<{ set: number; map: Map<string, string> | null }> {
  const missing: { slug: string; title: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('bf_movie')
      .select('slug,title')
      .is('poster', null)
      .range(from, from + 999);
    if (error) throw new Error(`bf_movie poster lookup: ${error.message}`);
    missing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  if (missing.length === 0) return { set: 0, map: null };

  const posters = buildPosterMap(await fetchPosterRows());
  const updates = missing
    .map((m) => ({ slug: m.slug, title: m.title, poster: posters.get(titleKey(m.title)) ?? null }))
    .filter((u) => u.poster);
  for (const batch of chunks(updates, 200)) {
    const { error } = await supabaseAdmin.from('bf_movie').upsert(batch, { onConflict: 'slug' });
    if (error) throw new Error(`bf_movie poster upsert: ${error.message}`);
  }
  return { set: updates.length, map: posters };
}

const debug = (msg: string) => {
  if (process.env.BF_DEBUG) console.log(`[bfilmy ${new Date().toISOString().slice(11, 19)}] ${msg}`);
};

export async function syncBfilmy(
  targets: SyncTarget[] = defaultTargets(),
  // tracked: the BFILMY title keys to import -- the titles filed under a
  // Fyre movie (lib/tracking.ts). Every other title in a file is skipped and
  // its figures are never stored.
  // listings (scheduled runs only): discovery -- record every title seen
  // (identity only), attach it to its Fyre movie or create one when that is
  // certain, else leave it for the admin (lib/catalog/listings.ts). Titles
  // that become Fyre movies are added to `tracked` and imported from the
  // same file, in the same run (one fetch per file).
  // importKeys (catalog bootstrap): import only these titles' figures (plus
  // any discovered in this call) -- `tracked` is then used for discovery only.
  // budget: automatic creations allowed, shared across calls.
  opts: { posters?: boolean; prune?: boolean; recordState?: boolean; tracked?: Set<string>; listings?: boolean; importKeys?: Set<string>; budget?: { left: number } } = {}
): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const files: SyncFileResult[] = [];
  const touched = new Set<string>();

  const aliasMap = await fyreAliasMap(await fetchAliases());
  const discoveryCache: DiscoveryCache = opts.budget ? { budget: opts.budget } : {};
  const listings = { writes: 0, attached: [] as string[], created: [] as string[], review: 0, newSlugs: [] as string[], titles: 0 };

  for (const t of targets) {
    try {
      debug(`fetch ${t.kind} ${t.date}`);
      const got = await fetchSummary(t.kind, t.date);
      if (!got) {
        files.push({ ...t, status: 'missing' });
        continue;
      }
      const all = normalizeSummaryFile(got.file, t.kind, t.date, aliasMap);
      if (opts.listings && opts.tracked) {
        try {
          const present = all.filter((d) => opts.tracked!.has(d.key));
          await applyStableSlugs(present);
          const r = await discoverIndia(all, t.date, new Map(present.map((d) => [d.key, d.slug])), discoveryCache);
          for (const [k, slug] of r.newKeys) {
            opts.tracked.add(k);
            opts.importKeys?.add(k);
            listings.newSlugs.push(slug);
          }
          listings.writes += r.writes;
          listings.attached.push(...r.attached);
          listings.created.push(...r.created);
          listings.review += r.review;
          listings.titles += r.titles;
        } catch (err: any) {
          errors.push(`discovery ${t.kind} ${t.date}: ${err?.message ?? err}`);
        }
      }
      const only = opts.importKeys ?? opts.tracked;
      const days = only ? all.filter((d) => only.has(d.key)) : all;
      debug(`  fetched ${got.url.includes(`${t.date.slice(0, 4)}.pages`) ? 'archive' : 'current'}; slugs`);
      await applyStableSlugs(days);
      debug(`  upsert ${days.length}`);
      await upsertDays(days);
      debug('  upserted');
      days.forEach((d) => touched.add(d.slug));
      files.push({ ...t, status: 'ok', movies: days.length, skipped: all.length - days.length, sourceUpdated: got.file.last_updated ?? null, url: got.url });
    } catch (err: any) {
      const message = err?.message ?? String(err);
      files.push({ ...t, status: 'error', error: message });
      errors.push(`${t.kind} ${t.date}: ${message}`);
    }
  }

  let moviesRefreshed = 0;
  debug(`refresh ${touched.size}`);
  try {
    await refreshMovies([...touched]);
    moviesRefreshed = touched.size;
  } catch (err: any) {
    errors.push(err?.message ?? String(err));
  }

  let postersSet = 0;
  if (opts.posters !== false) {
    try {
      const p = await fillPosters();
      postersSet = p.set;
      // Fyre-created movies still missing a poster: same list, no extra request.
      if (p.map && opts.listings) await refreshCatalogMetadata(undefined, p.map).catch(() => undefined);
    } catch (err: any) {
      errors.push(err?.message ?? String(err));
    }
  }

  let advancePruned = 0;
  if (opts.prune !== false) {
    const { data, error } = await supabaseAdmin.rpc('bf_prune_advance');
    if (error) errors.push(`bf_prune_advance: ${error.message}`);
    else advancePruned = Number(data) || 0;
  }

  const result: SyncResult = { startedAt, finishedAt: new Date().toISOString(), files, moviesRefreshed, postersSet, advancePruned, ...(opts.listings ? { listings } : {}), errors };

  if (opts.recordState !== false) {
    const { error } = await supabaseAdmin
      .from('bf_sync_state')
      .upsert({ key: 'last_sync', value: result, updated_at: result.finishedAt }, { onConflict: 'key' });
    if (error) result.errors.push(`bf_sync_state: ${error.message}`);
  }

  return result;
}
