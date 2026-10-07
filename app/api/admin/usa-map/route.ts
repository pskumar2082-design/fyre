import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { CatalogError, createFyreMovie, previewCreate } from '@/lib/catalog/admin';
import { staleReview } from '@/lib/catalog/candidates';
import { adminMovieList, displayNote, recordDecision } from '@/lib/catalog/adminList';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Admin review of USA listings (us_movie_map): which BFILMY USA movie id
// belongs to which Fyre movie. Only 'matched' ids are imported.
// GET  ?status=needs_review|matched|unmatched|rejected|all
// POST { action: 'match', sourceMovieId, movieId }        manual match + import its history
//      { action: 'preview_create', sourceMovieId, title? } what "Create Fyre movie" would create
//      { action: 'create', sourceMovieId, title?, acknowledgeSimilar? }
//                                                          new Fyre movie + this listing mapped to it
//      { action: 'reject', sourceMovieId }                never import (hidden)
//      { action: 'unmatch', sourceMovieId }               remove it (and re-import the movie's other ids)
const db = supabaseAdmin as any;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') ?? 'needs_review';
  // Review items with no BFILMY activity for 90+ days are hidden from the
  // default queue (?stale=1 shows them); their rows are always kept.
  const showStale = req.nextUrl.searchParams.get('stale') === '1';
  let q = db.from('us_movie_map').select('*').order('last_date', { ascending: false }).limit(500);
  if (status !== 'all') q = q.eq('match_status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const movies = await adminMovieList();
  const today = new Date().toISOString().slice(0, 10);
  const visible = (data ?? []).filter((r: any) => showStale || !staleReview(r, today));
  const rows = visible.map((r: any) => ({
    id: String(r.source_movie_id),
    idLabel: `USA id ${r.source_movie_id}`,
    title: r.source_title,
    movie_id: r.movie_id,
    match_status: r.match_status,
    match_confidence: r.match_confidence,
    match_method: r.match_method,
    match_note: displayNote(r.match_note),
    candidates: r.candidates ?? [],
    first_date: r.first_date,
    last_date: r.last_date,
    languages: r.languages,
    backfill_status: r.backfill_status
  }));
  return NextResponse.json({ rows, movies, hiddenStale: (data ?? []).length - visible.length });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.sourceMovieId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'sourceMovieId required' }, { status: 400 });
  const { data: row } = await db.from('us_movie_map').select('*').eq('source_movie_id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Unknown USA id' }, { status: 404 });
  const now = new Date().toISOString();
  const ref = { source: 'bfilmy_usa' as const, sourceMovieId: id };

  // Removes a movie's USA rows (all dates) so its remaining ids re-import cleanly.
  const clearMovie = async (movieId: string) => {
    for (const t of ['us_show', 'us_movie_breakdown', 'us_advance_snapshot', 'us_movie_day']) {
      const { error } = await db.from(t).delete().eq('movie_id', movieId);
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    await db.from('us_movie_map').update({ backfill_status: 'requested', backfill_next: null }).eq('movie_id', movieId).eq('match_status', 'matched');
  };

  try {
    if (body.action === 'preview_create') return NextResponse.json({ ok: true, preview: await previewCreate(ref, body.title) });
    if (body.action === 'create') {
      const result = await createFyreMovie(ref, { title: body.title, acknowledgeSimilar: !!body.acknowledgeSimilar });
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === 'match') {
      const movieId = String(body.movieId ?? '');
      const { data: t } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('moviemint_id', movieId).eq('match_status', 'matched').maybeSingle();
      if (!t) return NextResponse.json({ error: 'Not a Fyre movie' }, { status: 400 });
      await db.from('us_movie_map').update({ movie_id: movieId, match_status: 'matched', match_confidence: 'manual', match_method: 'manual', match_note: 'Matched by admin', reviewed_at: now, updated_at: now, backfill_status: 'requested', backfill_next: row.first_date }).eq('source_movie_id', id);
      await recordDecision({ movieId, source: 'bfilmy_usa', sourceTitle: row.source_title, sourceKey: row.title_key, sourceMovieId: String(id), method: 'manual', confidence: 'manual', decision: 'matched' });
      return NextResponse.json({ ok: true, backfill: 'requested (imported by the next USA sync)' });
    }
    if (body.action === 'reject') {
      if (row.match_status === 'matched' && row.movie_id) {
        await clearMovie(row.movie_id);
        await recordDecision({ movieId: row.movie_id, source: 'bfilmy_usa', sourceTitle: row.source_title, sourceKey: row.title_key, sourceMovieId: String(id), method: 'manual', confidence: 'manual', decision: 'rejected' });
      }
      await db.from('us_movie_map').update({ movie_id: null, match_status: 'rejected', match_method: 'manual', match_note: 'Rejected by admin', reviewed_at: now, updated_at: now, backfill_status: null }).eq('source_movie_id', id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'unmatch') {
      if (row.movie_id) {
        await clearMovie(row.movie_id);
        await recordDecision({ movieId: row.movie_id, source: 'bfilmy_usa', sourceTitle: row.source_title, sourceKey: row.title_key, sourceMovieId: String(id), method: 'manual', confidence: 'manual', decision: 'unmatched' });
      }
      await db.from('us_movie_map').update({ movie_id: null, match_status: 'needs_review', match_method: 'manual', match_note: 'Unmatched by admin', reviewed_at: now, updated_at: now, backfill_status: null }).eq('source_movie_id', id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    if (err instanceof CatalogError) return NextResponse.json({ error: err.message, detail: err.detail ?? null }, { status: err.status });
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 502 });
  }
}
