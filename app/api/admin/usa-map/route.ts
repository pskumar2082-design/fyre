import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Admin review of USA listings (us_movie_map): which BFILMY USA movie id
// belongs to which Fyre movie. Only 'matched' ids are imported.
// GET  ?status=needs_review|matched|unmatched|rejected|all
// POST { action: 'match', sourceMovieId, movieId }   manual match + import its history
//      { action: 'reject', sourceMovieId }           never import
//      { action: 'unmatch', sourceMovieId }          remove it (and re-import the movie's other ids)
const db = supabaseAdmin as any;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') ?? 'needs_review';
  let q = db.from('us_movie_map').select('*').order('last_date', { ascending: false }).limit(500);
  if (status !== 'all') q = q.eq('match_status', status);
  const [{ data, error }, { data: tracked }] = await Promise.all([q, db.from('fyre_tracked_movie').select('moviemint_id,bf_slug').eq('match_status', 'matched')]);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const { data: titles } = await db.from('bf_movie').select('slug,title').in('slug', (tracked ?? []).map((t: any) => t.bf_slug));
  const title = new Map((titles ?? []).map((t: any) => [t.slug, t.title]));
  const movies = (tracked ?? []).map((t: any) => ({ movieId: t.moviemint_id, slug: t.bf_slug, title: title.get(t.bf_slug) ?? t.bf_slug })).sort((a: any, b: any) => a.title.localeCompare(b.title));
  return NextResponse.json({ rows: data ?? [], movies });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.sourceMovieId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'sourceMovieId required' }, { status: 400 });
  const { data: row } = await db.from('us_movie_map').select('*').eq('source_movie_id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Unknown USA id' }, { status: 404 });
  const now = new Date().toISOString();

  // Removes a movie's USA rows (all dates) so its remaining ids re-import cleanly.
  const clearMovie = async (movieId: string) => {
    for (const t of ['us_show', 'us_movie_breakdown', 'us_advance_snapshot', 'us_movie_day']) {
      const { error } = await db.from(t).delete().eq('movie_id', movieId);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    await db.from('us_movie_map').update({ backfill_status: 'requested', backfill_next: null }).eq('movie_id', movieId).eq('match_status', 'matched');
  };

  try {
    if (body.action === 'match') {
      const movieId = String(body.movieId ?? '');
      const { data: t } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('moviemint_id', movieId).eq('match_status', 'matched').maybeSingle();
      if (!t) return NextResponse.json({ error: 'Not a tracked Fyre movie' }, { status: 400 });
      await db.from('us_movie_map').update({ movie_id: movieId, match_status: 'matched', match_confidence: 'manual', match_method: 'manual', match_note: 'Matched by admin', reviewed_at: now, updated_at: now, backfill_status: 'requested', backfill_next: row.first_date }).eq('source_movie_id', id);
      return NextResponse.json({ ok: true, backfill: 'requested (imported by the next USA sync)' });
    }
    if (body.action === 'reject') {
      if (row.match_status === 'matched' && row.movie_id) await clearMovie(row.movie_id);
      await db.from('us_movie_map').update({ movie_id: null, match_status: 'rejected', match_method: 'manual', match_note: 'Rejected by admin', reviewed_at: now, updated_at: now, backfill_status: null }).eq('source_movie_id', id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'unmatch') {
      if (row.movie_id) await clearMovie(row.movie_id);
      await db.from('us_movie_map').update({ movie_id: null, match_status: 'needs_review', match_method: 'manual', match_note: 'Unmatched by admin', reviewed_at: now, updated_at: now, backfill_status: null }).eq('source_movie_id', id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 502 });
  }
}
