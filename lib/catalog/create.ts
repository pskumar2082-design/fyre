// Creating a Fyre movie from one BFILMY listing -- the single code path for
// both an admin's "Create Fyre movie" and the scheduled sync's automatic
// discovery. No MovieMint involvement anywhere.
//
//   id        'fyre-' + 8 hex (existing ids are never touched)
//   slug      the title's slug, else title-year, else numbered; reserved in
//             bf_title_key so no other title can ever take it
//   India     the listing's title key is filed under the slug, so the India
//             import stores this title's figures under the movie
//   USA       the USA id is mapped to the movie; history import requested
//   created_from  'bfilmy_india:<key>' / 'bfilmy_usa:<id>' -- unique, so the
//             same listing can never create two movies (e.g. two overlapping
//             sync runs)
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { slugify } from '@/lib/bfilmy/normalize';
import { usTitleKey } from '@/lib/usa/match';
import { metadataStatus, newFyreId, proposeSlug, splitTitleYear, type CatalogSource, type MovieMetadata } from './core';

const db = supabaseAdmin as any;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw Object.assign(new Error(`${label}: ${error.message}`), { code: error.code });
  return data;
}

export type NewMovieInput = {
  source: CatalogSource;
  sourceId: string; // India title key, or USA source movie id
  sourceTitle: string;
  title?: string; // canonical title (default: source title without a trailing year)
  languages: string[];
  firstDate: string | null;
  metadata?: MovieMetadata;
  decidedBy: 'auto' | 'admin';
  note?: string | null;
};

export type NewMovie = { movieId: string; slug: string; title: string; metadataStatus: 'complete' | 'incomplete'; missing: string[] };

async function takenSlugs(base: string): Promise<Set<string>> {
  const taken = new Set<string>();
  const [a, b] = await Promise.all([
    must<any[]>(db.from('bf_title_key').select('slug').like('slug', `${base}%`), 'bf_title_key'),
    must<any[]>(db.from('fyre_tracked_movie').select('bf_slug').like('bf_slug', `${base}%`), 'fyre_tracked_movie')
  ]);
  for (const r of a) taken.add(r.slug);
  for (const r of b) if (r.bf_slug) taken.add(r.bf_slug);
  return taken;
}

// The slug a new movie would get (an India title already filed under a slug
// that no Fyre movie uses keeps it -- its older stored history comes along).
export async function slugFor(source: CatalogSource, sourceId: string, title: string, year: number | null): Promise<{ slug: string; reuse: boolean }> {
  if (source === 'bfilmy_india') {
    const k = await must<any>(db.from('bf_title_key').select('slug').eq('key', sourceId).maybeSingle(), 'bf_title_key');
    if (k?.slug) {
      const { data: owner } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('bf_slug', k.slug).limit(1);
      if (!owner?.length) return { slug: k.slug, reuse: true };
    }
  }
  return { slug: proposeSlug(title, year, await takenSlugs(slugify(title.replace(/['’]/g, '')))), reuse: false };
}

export async function createCatalogMovie(input: NewMovieInput): Promise<NewMovie> {
  const split = splitTitleYear(input.sourceTitle);
  const title = (input.title ?? '').replace(/\s+/g, ' ').trim() || split.title;
  const year = split.year ?? (input.firstDate ? Number(input.firstDate.slice(0, 4)) : null);
  const india = input.source === 'bfilmy_india';
  const { slug, reuse } = await slugFor(input.source, input.sourceId, title, year);
  const id = newFyreId();
  const meta: MovieMetadata = input.metadata ?? { checkedAt: undefined };
  const st = metadataStatus(meta);
  meta.missing = st.missing;
  const now = new Date().toISOString();
  const who = input.decidedBy === 'auto' ? 'Discovered by the BFILMY sync' : 'Created by admin';
  const from = `${india ? 'India listing' : 'USA listing'} ${india ? `“${input.sourceTitle}”` : input.sourceId}`;

  await must(
    db.from('fyre_tracked_movie').insert({
      moviemint_id: id,
      bf_slug: slug,
      match_status: 'matched',
      match_confidence: input.decidedBy === 'auto' ? 'high' : 'admin',
      match_method: input.decidedBy === 'auto' ? 'discovered' : 'created',
      match_note: `${who} from ${from}`,
      candidates: [],
      tracking_status: 'active',
      origin: input.source,
      created_from: `${input.source}:${input.sourceId}`,
      title,
      release_year: year,
      release_date: meta.releaseDate ?? null,
      languages: input.languages,
      first_source_date: input.firstDate,
      metadata: meta,
      metadata_status: st.status,
      backfill_status: india ? 'requested' : null,
      backfill_requested_at: india ? now : null,
      // Not known to be the whole run until its history import says so
      // (90-day rule): shown as a tracked period until then.
      history_complete: india ? false : null,
      us_history_complete: india ? null : false,
      reviewed_at: input.decidedBy === 'admin' ? now : null,
      created_at: now,
      updated_at: now
    }),
    'fyre_tracked_movie insert'
  );

  const undo = async () => {
    await db.from('fyre_movie_alias').delete().eq('movie_id', id);
    await db.from('bf_title_key').delete().eq('key', `fyre:${id}`);
    await db.from('fyre_tracked_movie').delete().eq('moviemint_id', id);
  };
  try {
    if (india) {
      if (!reuse) {
        const { data: k } = await db.from('bf_title_key').select('key').eq('key', input.sourceId).maybeSingle();
        if (k) await must(db.from('bf_title_key').update({ slug, title }).eq('key', input.sourceId), 'bf_title_key');
        else await must(db.from('bf_title_key').insert({ key: input.sourceId, slug, title }), 'bf_title_key');
      }
      await must(
        db
          .from('bf_listing')
          .update({ movie_id: id, match_status: 'matched', match_method: input.decidedBy === 'auto' ? 'discovered' : 'created', match_confidence: input.decidedBy === 'auto' ? 'high' : 'admin', match_note: `${who}`, reviewed_at: input.decidedBy === 'admin' ? now : null, updated_at: now })
          .eq('key', input.sourceId),
        'bf_listing'
      );
    } else {
      // Reserve the slug ('fyre:<id>' never equals a real India title key).
      await must(db.from('bf_title_key').insert({ key: `fyre:${id}`, slug, title }), 'bf_title_key');
      await must(
        db
          .from('us_movie_map')
          .update({ movie_id: id, match_status: 'matched', match_confidence: input.decidedBy === 'auto' ? 'high' : 'admin', match_method: input.decidedBy === 'auto' ? 'discovered' : 'created', match_note: who, reviewed_at: input.decidedBy === 'admin' ? now : null, updated_at: now, backfill_status: 'requested', backfill_next: input.firstDate })
          .eq('source_movie_id', Number(input.sourceId)),
        'us_movie_map'
      );
    }
    await must(
      db.from('fyre_movie_alias').insert({
        movie_id: id,
        source: input.source,
        source_title: input.sourceTitle,
        source_key: india ? input.sourceId : usTitleKey(input.sourceTitle),
        source_movie_id: input.sourceId,
        match_method: input.decidedBy === 'auto' ? 'discovered' : 'created',
        match_confidence: input.decidedBy === 'auto' ? 'high' : 'admin',
        decision: 'created',
        decided_by: input.decidedBy,
        decided_at: now,
        note: input.note ?? null
      }),
      'fyre_movie_alias'
    );
  } catch (err) {
    await undo().catch(() => undefined);
    throw err;
  }
  return { movieId: id, slug, title, metadataStatus: st.status, missing: st.missing };
}
