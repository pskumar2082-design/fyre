import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { CatalogError, createFyreMovie, previewCreate } from '@/lib/catalog/admin';
import { attachIndiaListing } from '@/lib/catalog/listings';
import { staleReview } from '@/lib/catalog/candidates';
import { adminMovieList, displayNote, recordDecision } from '@/lib/catalog/adminList';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Admin review of BFILMY India listings (bf_listing) -- the India
// counterpart of USA matching. A listing can be matched to an existing
// Fyre movie, become a new Fyre movie, or be rejected (hidden).
// GET  ?status=needs_review|matched|unmatched|rejected|all
// POST { action: 'match', key, movieId }
//      { action: 'preview_create', key, title? }
//      { action: 'create', key, title?, acknowledgeSimilar? }
//      { action: 'reject', key }
//      { action: 'unmatch', key }
const db = supabaseAdmin as any;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') ?? 'needs_review';
  // Review items with no BFILMY activity for 90+ days are hidden from the
  // default queue (?stale=1 shows them); their rows are always kept.
  const showStale = req.nextUrl.searchParams.get('stale') === '1';
  let q = db.from('bf_listing').select('*').order('last_date', { ascending: false }).limit(500);
  if (status !== 'all') q = q.eq('match_status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const movies = await adminMovieList();
  const today = new Date().toISOString().slice(0, 10);
  const visible = (data ?? []).filter((r: any) => showStale || !staleReview(r, today));
  const rows = visible.map((r: any) => ({
    id: r.key,
    idLabel: 'India listing',
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
    backfill_status: null
  }));
  return NextResponse.json({ rows, movies, hiddenStale: (data ?? []).length - visible.length });
}

// The movie's India data (all dates), so what remains re-imports cleanly.
async function clearIndia(slug: string) {
  for (const t of ['bf_show', 'bf_movie_breakdown', 'bf_movie_day_detail', 'bf_movie_day', 'bf_movie']) {
    const { error } = await db.from(t).delete().eq('slug', slug);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? body.sourceMovieId ?? '');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  const { data: row } = await db.from('bf_listing').select('*').eq('key', key).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Unknown India listing' }, { status: 404 });
  const now = new Date().toISOString();
  const ref = { source: 'bfilmy_india' as const, key };

  // Taking an India listing off its movie (any movie, whatever its
  // origin). A movie's first India title -- the one its public slug came
  // from -- can only go once its other India titles are gone.
  const detach = async (decision: 'unmatched' | 'rejected') => {
    if (!row.movie_id) return;
    const { data: movie } = await db.from('fyre_tracked_movie').select('bf_slug').eq('moviemint_id', row.movie_id).maybeSingle();
    const slug = movie?.bf_slug;
    const { data: k } = await db.from('bf_title_key').select('key,slug').eq('key', key).maybeSingle();
    if (slug && k?.slug === slug) {
      const { data: others } = await db.from('bf_listing').select('key').eq('movie_id', row.movie_id).eq('match_status', 'matched').neq('key', key);
      if (others?.length) throw new CatalogError(`Unmatch its other India titles first (${others.map((o: any) => o.key).join(', ')}).`, 409);
      await db.from('bf_title_key').delete().eq('key', key);
    }
    if (slug) await clearIndia(slug);
    await recordDecision({ movieId: row.movie_id, source: 'bfilmy_india', sourceTitle: row.source_title, sourceKey: key, sourceMovieId: key, method: 'manual', confidence: 'manual', decision });
    // Whatever India titles remain re-import from scratch.
    await db.from('fyre_tracked_movie').update({ backfill_status: 'requested', backfill_requested_at: now }).eq('moviemint_id', row.movie_id);
    await db.from('bf_sync_state').delete().eq('key', `backfill:${row.movie_id}`);
  };

  try {
    if (body.action === 'preview_create') return NextResponse.json({ ok: true, preview: await previewCreate(ref, body.title) });
    if (body.action === 'create') return NextResponse.json({ ok: true, result: await createFyreMovie(ref, { title: body.title, acknowledgeSimilar: !!body.acknowledgeSimilar }) });
    if (body.action === 'match') {
      const movieId = String(body.movieId ?? '');
      if (row.match_status === 'matched') return NextResponse.json({ error: 'Already matched; unmatch it first' }, { status: 409 });
      const res = await attachIndiaListing(key, movieId, { method: 'manual', confidence: 'manual', note: 'Matched by admin', decidedBy: 'admin' });
      return NextResponse.json({ ok: true, ...res, backfill: 'requested (imported by the next India sync)' });
    }
    if (body.action === 'reject') {
      if (row.match_status === 'matched') await detach('rejected');
      await db.from('bf_listing').update({ movie_id: null, match_status: 'rejected', match_method: 'manual', match_note: 'Rejected by admin', reviewed_at: now, updated_at: now }).eq('key', key);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'unmatch') {
      await detach('unmatched');
      await db.from('bf_listing').update({ movie_id: null, match_status: 'needs_review', match_method: 'manual', match_note: 'Unmatched by admin', reviewed_at: now, updated_at: now }).eq('key', key);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    if (err instanceof CatalogError) return NextResponse.json({ error: err.message, detail: err.detail ?? null }, { status: err.status });
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 502 });
  }
}
