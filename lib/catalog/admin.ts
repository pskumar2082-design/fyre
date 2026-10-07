// Admin actions on Fyre's canonical catalog: preview and create a Fyre
// movie from a source listing (BFILMY USA id or BFILMY India title), and
// metadata enrichment. Server-only (service role); never reached from a
// public page. No MovieMint dependency (its stored list is optional
// enrichment only).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchPosterRows } from '@/lib/bfilmy/fetch';
import { buildPosterMap, titleKey } from '@/lib/bfilmy/normalize';
import { loadTrackedMovies } from '@/lib/usa/sync';
import { usTitleKey } from '@/lib/usa/match';
import { createBlocker, duplicateReport, metadataStatus, splitTitleYear, SOURCE_LABEL, type CatalogSource, type DuplicateReport, type MovieMetadata } from './core';
import { createCatalogMovie, slugFor } from './create';

const db = supabaseAdmin as any;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export class CatalogError extends Error {
  constructor(message: string, public status = 400, public detail?: unknown) {
    super(message);
  }
}

export type ListingRef = { source: 'bfilmy_usa'; sourceMovieId: number } | { source: 'bfilmy_india'; key: string };

export type SourceListing = {
  source: CatalogSource;
  sourceMovieId: string; // USA id, or India title key
  title: string;
  languages: string[];
  firstDate: string | null;
  lastDate: string | null;
  status: string;
  movieId: string | null;
};

export async function loadListing(ref: ListingRef): Promise<SourceListing | null> {
  if (ref.source === 'bfilmy_usa') {
    const r = await must<any>(db.from('us_movie_map').select('*').eq('source_movie_id', ref.sourceMovieId).maybeSingle(), 'us_movie_map');
    return r ? { source: 'bfilmy_usa', sourceMovieId: String(r.source_movie_id), title: r.source_title, languages: r.languages ?? [], firstDate: r.first_date, lastDate: r.last_date, status: r.match_status, movieId: r.movie_id } : null;
  }
  const r = await must<any>(db.from('bf_listing').select('*').eq('key', ref.key).maybeSingle(), 'bf_listing');
  return r ? { source: 'bfilmy_india', sourceMovieId: r.key, title: r.source_title, languages: r.languages ?? [], firstDate: r.first_date, lastDate: r.last_date, status: r.match_status, movieId: r.movie_id } : null;
}

export type CreatePreview = {
  source: CatalogSource;
  sourceLabel: string;
  sourceMovieId: string;
  sourceTitle: string;
  title: string;
  year: number | null;
  languages: string[];
  firstSourceDate: string | null;
  lastSourceDate: string | null;
  slug: string;
  duplicates: DuplicateReport;
  blocker: string | null; // with the similar-title confirmation still unticked
  needsConfirmation: boolean;
};

async function buildPreview(ref: ListingRef, titleOverride?: string): Promise<{ preview: CreatePreview; listing: SourceListing }> {
  const listing = await loadListing(ref);
  if (!listing) throw new CatalogError('Unknown source listing', 404);
  if (listing.status === 'matched') throw new CatalogError('This listing is already matched to a Fyre movie', 409);
  if (listing.status === 'rejected') throw new CatalogError('This listing was rejected; it stays hidden', 409);
  const split = splitTitleYear(listing.title);
  const title = (titleOverride ?? '').replace(/\s+/g, ' ').trim() || split.title;
  const year = split.year ?? (listing.firstDate ? Number(listing.firstDate.slice(0, 4)) : null);
  const catalog = await loadTrackedMovies();
  const dup = duplicateReport(title, catalog);
  if (title !== split.title) {
    // The listing's own title must not be a duplicate either.
    const own = duplicateReport(split.title, catalog);
    dup.exact.push(...own.exact.filter((e) => !dup.exact.some((x) => x.movieId === e.movieId)));
  }
  const { slug } = await slugFor(listing.source, listing.sourceMovieId, title, year);
  return {
    listing,
    preview: {
      source: listing.source,
      sourceLabel: SOURCE_LABEL[listing.source],
      sourceMovieId: listing.sourceMovieId,
      sourceTitle: listing.title,
      title,
      year,
      languages: listing.languages,
      firstSourceDate: listing.firstDate,
      lastSourceDate: listing.lastDate,
      slug,
      duplicates: dup,
      blocker: createBlocker(dup, false),
      needsConfirmation: dup.exact.length === 0 && dup.similar.length > 0
    }
  };
}

export async function previewCreate(ref: ListingRef, titleOverride?: string): Promise<CreatePreview> {
  return (await buildPreview(ref, titleOverride)).preview;
}

// MovieMint's stored list, if it is there (optional enrichment; [] when the
// table is missing or unreadable).
async function moviemintStored(): Promise<{ title: string; poster: string | null; release_date: string | null }[]> {
  try {
    const { data, error } = await db.from('mm_movie').select('title,poster,release_date');
    return error ? [] : data ?? [];
  } catch {
    return [];
  }
}

// Source-supported facts come from the listing (title, year, languages,
// dates). Then the metadata Fyre already has: the poster list the India
// import reads (exact title only) and, if present, MovieMint's stored entry
// for the same exact title within 45 days of `near`. Nothing is guessed;
// what is not found stays empty and the movie is marked incomplete.
export async function lookupMetadata(
  title: string,
  posterMap?: Map<string, string>,
  near?: string | null,
  stored?: { title: string; poster: string | null; release_date: string | null }[]
): Promise<MovieMetadata> {
  const meta: MovieMetadata = { checkedAt: new Date().toISOString() };
  const map = posterMap ?? buildPosterMap(await fetchPosterRows());
  const poster = map.get(titleKey(title));
  if (poster) Object.assign(meta, { poster, posterSource: 'poster list (exact title)' });
  const key = usTitleKey(title);
  const days = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
  const mm = (stored ?? (await moviemintStored())).filter((m) => usTitleKey(m.title) === key && (!near || (m.release_date && days(m.release_date, near) <= 45)));
  if (mm.length === 1) {
    if (!meta.poster && mm[0].poster) Object.assign(meta, { poster: mm[0].poster, posterSource: 'stored MovieMint entry (exact title)' });
    if (mm[0].release_date) Object.assign(meta, { releaseDate: mm[0].release_date, releaseDateSource: 'stored MovieMint entry (exact title)' });
  }
  meta.missing = metadataStatus(meta).missing;
  return meta;
}

export type CreateResult = { movieId: string; slug: string; title: string; metadataStatus: string; missing: string[]; historyImport: string };

// Admin "Create Fyre movie" (after the preview).
export async function createFyreMovie(ref: ListingRef, opts: { title?: string; acknowledgeSimilar?: boolean } = {}): Promise<CreateResult> {
  const { preview, listing } = await buildPreview(ref, opts.title);
  const blocker = createBlocker(preview.duplicates, !!opts.acknowledgeSimilar);
  if (blocker) throw new CatalogError(blocker, 409, preview.duplicates);
  const meta = await lookupMetadata(preview.title, undefined, listing.firstDate).catch(() => ({ checkedAt: new Date().toISOString() }) as MovieMetadata);
  try {
    const m = await createCatalogMovie({
      source: listing.source,
      sourceId: listing.sourceMovieId,
      sourceTitle: listing.title,
      title: preview.title,
      languages: listing.languages,
      firstDate: listing.firstDate,
      metadata: meta,
      decidedBy: 'admin',
      note: preview.duplicates.similar.length ? `Admin confirmed different from: ${preview.duplicates.similar.map((s) => s.title).join(', ')}` : null
    });
    return { ...m, historyImport: listing.source === 'bfilmy_india' ? 'India history requested (next India sync)' : 'USA history requested (next USA sync)' };
  } catch (err: any) {
    if (err?.code === '23505') throw new CatalogError('A Fyre movie was already created from this listing', 409);
    throw err;
  }
}

// Fills metadata gaps for movies created from a source listing (admin
// "Re-check", or the India sync with the poster list it already fetched).
// Each movie is re-checked at most once a day; nothing already set is
// overwritten, and a row is written only when something was found.
export async function refreshCatalogMetadata(onlyIds?: string[], posterMap?: Map<string, string>): Promise<{ checked: number; updated: string[] }> {
  let q = db.from('fyre_tracked_movie').select('moviemint_id,title,bf_slug,release_date,first_source_date,metadata,metadata_status').eq('match_status', 'matched');
  // Scheduled: created movies marked incomplete. Admin "Re-check": any movie.
  q = onlyIds ? q.in('moviemint_id', onlyIds) : q.neq('origin', 'moviemint').eq('metadata_status', 'incomplete');
  const all = await must<any[]>(q, 'fyre_tracked_movie');
  const dayAgo = Date.now() - 86_400_000;
  const rows = onlyIds ? all : all.filter((r) => !(Date.parse(r.metadata?.checkedAt ?? '') > dayAgo)).slice(0, 200);
  if (!rows.length) return { checked: 0, updated: [] };
  const map = posterMap ?? buildPosterMap(await fetchPosterRows());
  const stored = await moviemintStored();
  const updated: string[] = [];
  for (const r of rows) {
    const found = await lookupMetadata(r.title ?? '', map, r.first_source_date, stored);
    const meta: MovieMetadata = { ...(r.metadata ?? {}) };
    let changed = false;
    for (const k of ['poster', 'posterSource', 'releaseDate', 'releaseDateSource'] as const) {
      if (!meta[k] && found[k]) {
        (meta as any)[k] = found[k];
        changed = true;
      }
    }
    meta.checkedAt = found.checkedAt;
    const st = metadataStatus(meta);
    meta.missing = st.missing;
    await must(
      db.from('fyre_tracked_movie').update({ metadata: meta, metadata_status: st.status, release_date: r.release_date ?? meta.releaseDate ?? null, updated_at: new Date().toISOString() }).eq('moviemint_id', r.moviemint_id),
      'fyre_tracked_movie'
    );
    if (changed) updated.push(r.moviemint_id);
  }
  return { checked: rows.length, updated };
}
