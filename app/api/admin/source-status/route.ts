import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { sourceStatus } from '@/lib/moviemint/india/status';
import { allocateSlug } from '@/lib/moviemint/india/link';

export const dynamic = 'force-dynamic';

// GET: source status + dry-run comparison for the MovieMint India policy.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await sourceStatus());
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

// POST { action, moviemint_id, movie_id? }
//   link    -- attach the MovieMint movie to this existing Fyre movie
//   create  -- give it a new Fyre movie
//   exclude -- keep it off Fyre (MovieMint lists it, Fyre does not show it)
//   reset   -- forget the decision; the next sync decides again
// Admin decisions are never changed by the sync.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = supabaseAdmin as any;
  const body = await req.json().catch(() => ({}));
  const id = String(body.moviemint_id ?? '').trim();
  const action = String(body.action ?? '');
  if (!id) return NextResponse.json({ error: 'moviemint_id required' }, { status: 400 });
  const { data: mm } = await db.from('mm_movie').select('moviemint_id,title,language,release_date,poster,badge').eq('moviemint_id', id).maybeSingle();
  if (!mm) return NextResponse.json({ error: 'Not a MovieMint movie' }, { status: 404 });
  const now = new Date().toISOString();

  if (action === 'reset') {
    const { error } = await db.from('mmi_catalog').delete().eq('moviemint_id', id).neq('link_status', 'linked');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (action === 'exclude') {
    const { error } = await db.from('mmi_catalog').upsert({ moviemint_id: id, link_status: 'excluded', link_method: 'admin', link_note: 'Excluded by admin', updated_at: now }, { onConflict: 'moviemint_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // slugs already in use by another movie
  const [{ data: fy }, { data: links }] = await Promise.all([db.from('fyre_tracked_movie').select('moviemint_id,bf_slug'), db.from('mmi_catalog').select('moviemint_id,movie_id,slug').eq('link_status', 'linked')]);
  const taken = new Set<string>([...(fy ?? []).map((f: any) => f.bf_slug), ...(links ?? []).filter((l: any) => l.moviemint_id !== id).map((l: any) => l.slug)].filter(Boolean));

  if (action === 'link') {
    const movieId = String(body.movie_id ?? '').trim();
    const target = (fy ?? []).find((f: any) => f.moviemint_id === movieId);
    if (!target) return NextResponse.json({ error: 'Unknown Fyre movie' }, { status: 404 });
    const holder = (links ?? []).find((l: any) => l.moviemint_id !== id && l.movie_id === movieId);
    if (holder) return NextResponse.json({ error: `Already linked to MovieMint ${holder.moviemint_id}` }, { status: 409 });
    const ownTaken = target.bf_slug && (links ?? []).some((l: any) => l.moviemint_id !== id && l.slug === target.bf_slug);
    const slug = target.bf_slug && !ownTaken ? target.bf_slug : allocateSlug({ id, title: mm.title, language: mm.language, releaseDate: mm.release_date, badge: mm.badge }, taken);
    const { error } = await db.from('mmi_catalog').upsert({ moviemint_id: id, movie_id: movieId, slug, link_status: 'linked', link_method: 'admin', link_note: 'Linked by admin', updated_at: now }, { onConflict: 'moviemint_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug });
  }
  if (action === 'create') {
    const exists = (fy ?? []).some((f: any) => f.moviemint_id === id);
    if (!exists) {
      const { error } = await db.from('fyre_tracked_movie').insert({
        moviemint_id: id,
        origin: 'moviemint',
        title: mm.title,
        release_date: mm.release_date,
        release_year: mm.release_date ? Number(String(mm.release_date).slice(0, 4)) : null,
        languages: mm.language ? [mm.language] : null,
        match_status: 'unmatched',
        tracking_status: 'pending',
        match_note: 'Created from MovieMint by admin (MovieMint India policy)',
        created_from: `moviemint:${id}`,
        metadata: { poster: mm.poster ?? null, source: 'moviemint' },
        updated_at: now
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const slug = allocateSlug({ id, title: mm.title, language: mm.language, releaseDate: mm.release_date, badge: mm.badge }, taken);
    const { error } = await db.from('mmi_catalog').upsert({ moviemint_id: id, movie_id: id, slug, link_status: 'linked', link_method: 'admin', link_note: 'Created by admin', updated_at: now }, { onConflict: 'moviemint_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slug });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
