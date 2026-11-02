import { NextRequest, NextResponse } from 'next/server';
import { v2Admin } from '@/lib/v2/adminGuard';
import { getMoviesStore, readDemoFlags, writeDemoFlags } from '@/lib/movies/store';
import { evaluateLifecycle, inActiveListings, isPubliclySelected } from '@/lib/movies/lifecycle';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

// GET: every movie with its lifecycle, public visibility and what the daily
// check would do today (a dry run: nothing changes). POST: admin
// selections (Show on Fyre, Featured, force Running / Ended).
export async function GET(req: NextRequest) {
  if (!(await v2Admin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = getMoviesStore();
  const now = new Date();
  const movies = await store.listMovies(now);
  const f = await store.figures(now, movies.map((m) => m.id));
  const items = movies.map((m) => {
    const days = f.days.filter((d) => d.movieId === m.id);
    const lastFigureDate = days.map((d) => d.day).sort().pop() ?? null;
    const lastShowDate = days.filter((d) => d.metric === 'shows' && d.value > 0).map((d) => d.day).sort().pop() ?? null;
    const decision = evaluateLifecycle(m, { lastShowDate, lastFigureDate, sourcesHealthy: true, endingCheckSince: m.lifecycle === 'ending_check' ? m.lifecycleSince : null }, now);
    return { ...m, publiclySelected: isPubliclySelected(m), inActiveListings: inActiveListings(m), lastFigureDate, proposed: decision };
  });
  return NextResponse.json({ items, store: store.kind });
}

export async function POST(req: NextRequest) {
  const editor = await v2Admin(req);
  if (!editor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? '');
  const patch: Record<string, unknown> = {};
  if (typeof body.showOnFyre === 'boolean') patch.showOnFyre = body.showOnFyre;
  if (typeof body.featured === 'boolean') patch.featured = body.featured;
  if (body.override === 'running' || body.override === 'ended' || body.override === null) patch.override = body.override;
  if (!id || !Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const store = getMoviesStore();
  if (store.kind === 'demo') {
    const all = readDemoFlags();
    all[id] = { ...all[id], ...patch };
    writeDemoFlags(all);
  } else {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('showOnFyre' in patch) row.show_on_fyre = patch.showOnFyre;
    if ('featured' in patch) row.featured = patch.featured;
    if ('override' in patch) row.status_override = patch.override;
    const { error } = await supabaseAdmin.from('mv_movie').update(row).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Every admin change is logged with who made it.
    await supabaseAdmin.from('mv_status_log').insert({ movie_id: id, change: patch, reason: 'Admin change', changed_by: editor });
  }
  try {
    revalidatePath('/');
    revalidatePath('/movies');
  } catch {}
  return NextResponse.json({ ok: true });
}
