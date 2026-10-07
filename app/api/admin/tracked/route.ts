import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { syncMovieMintCatalog } from '@/lib/moviemint/sync';
import { processBackfills } from '@/lib/moviemint/backfill';
import { BREAKDOWN_DAYS } from '@/lib/retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// LEGACY MovieMint view. MovieMint is enrichment only: being on or off its
// list never changes a Fyre movie's tracking (only the admin's stop/resume).
// GET: every MovieMint movie with its BFILMY match and Fyre tracking state.
// GET ?search=title: BFILMY movies whose title contains the text (manual match).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const search = req.nextUrl.searchParams.get('search');
  if (search) {
    const { data, error } = await supabaseAdmin
      .from('bf_movie')
      .select('slug,title,languages,formats,release_date,first_date,last_date,days_tracked')
      .ilike('title', `%${search.replace(/[%_]/g, '')}%`)
      .order('last_date', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ results: data ?? [] });
  }
  try {
    const [mm, tracked, state] = await Promise.all([
      all<any>((f, t) => supabaseAdmin.from('mm_movie').select('*').range(f, t)),
      all<any>((f, t) => supabaseAdmin.from('fyre_tracked_movie').select('*').range(f, t)),
      supabaseAdmin.from('bf_sync_state').select('key,value').in('key', ['last_moviemint_sync', 'last_sync', 'last_detail_sync', 'last_retention'])
    ]);
    const slugs = tracked.map((t) => t.bf_slug).filter(Boolean);
    const movies = new Map<string, any>();
    const detailDays = new Map<string, { boxoffice: number; advance: number }>();
    for (let i = 0; i < slugs.length; i += 100) {
      const part = slugs.slice(i, i + 100);
      const { data } = await supabaseAdmin
        .from('bf_movie')
        .select('slug,title,languages,formats,release_date,first_date,last_date,days_tracked,total_gross,advance_date,carried_over')
        .in('slug', part);
      for (const m of data ?? []) movies.set(m.slug, m);
      const det = await all<any>((f, t) => supabaseAdmin.from('bf_movie_day_detail').select('slug,kind').in('slug', part).range(f, t));
      for (const d of det) {
        const c = detailDays.get(d.slug) ?? { boxoffice: 0, advance: 0 };
        c[d.kind as 'boxoffice' | 'advance']++;
        detailDays.set(d.slug, c);
      }
    }
    const byId = new Map(tracked.map((t) => [t.moviemint_id, t]));
    const rows = mm
      .map((m) => {
        const t = byId.get(m.moviemint_id) ?? null;
        const bf = t?.bf_slug ? movies.get(t.bf_slug) ?? null : null;
        return { moviemint: m, tracking: t, bfilmy: bf, detailDays: t?.bf_slug ? detailDays.get(t.bf_slug) ?? { boxoffice: 0, advance: 0 } : null };
      })
      .sort((a, b) => (b.moviemint.release_date ?? '').localeCompare(a.moviemint.release_date ?? ''));
    return NextResponse.json({ rows, state: Object.fromEntries((state.data ?? []).map((s: any) => [s.key, s.value])), breakdownDays: BREAKDOWN_DAYS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load tracked movies' }, { status: 502 });
  }
}

// POST { action, moviemint_id?, bf_slug? }
//   match     connect a MovieMint movie to a BFILMY movie (manual; queues history import)
//   reject    this MovieMint movie has no BFILMY match
//   stop      stop tracking (history kept)
//   resume    resume tracking
//   refresh   re-import this movie's history now
//   catalog   refresh the stored MovieMint list now (enrichment only)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? '');
  const id = body.moviemint_id ? String(body.moviemint_id) : null;
  const now = new Date().toISOString();
  try {
    if (action === 'catalog') return NextResponse.json({ ok: true, result: await syncMovieMintCatalog() });
    if (!id) return NextResponse.json({ error: 'moviemint_id required' }, { status: 400 });
    const { data: known } = await supabaseAdmin.from('fyre_tracked_movie').select('moviemint_id').eq('moviemint_id', id).maybeSingle();
    if (!known && action !== 'match') return NextResponse.json({ error: 'Unknown movie' }, { status: 404 });
    if (!known) {
      const { data: mm } = await supabaseAdmin.from('mm_movie').select('moviemint_id').eq('moviemint_id', id).maybeSingle();
      if (!mm) return NextResponse.json({ error: 'Unknown MovieMint movie' }, { status: 404 });
    }

    if (action === 'match') {
      const slug = String(body.bf_slug ?? '').trim();
      const { data: exists } = await supabaseAdmin.from('bf_title_key').select('slug').eq('slug', slug).limit(1);
      if (!slug || !exists?.length) return NextResponse.json({ error: `No BFILMY movie "${slug}"` }, { status: 400 });
      const { data: taken } = await supabaseAdmin.from('fyre_tracked_movie').select('moviemint_id').eq('bf_slug', slug).eq('match_status', 'matched').neq('moviemint_id', id).limit(1);
      if (taken?.length) return NextResponse.json({ error: `${slug} is already matched to MovieMint "${taken[0].moviemint_id}"` }, { status: 409 });
      await supabaseAdmin.from('bf_sync_state').delete().eq('key', `backfill:${id}`);
      const { error } = await supabaseAdmin
        .from('fyre_tracked_movie')
        .upsert(
          {
            moviemint_id: id,
            bf_slug: slug,
            match_status: 'matched',
            match_confidence: 'manual',
            match_method: 'manual',
            match_note: 'Matched by admin',
            tracking_status: 'active',
            backfill_status: 'requested',
            backfill_requested_at: now,
            reviewed_at: now,
            updated_at: now
          },
          { onConflict: 'moviemint_id' }
        );
      if (error) throw new Error(error.message);
    } else if (action === 'reject') {
      const { error } = await supabaseAdmin
        .from('fyre_tracked_movie')
        .update({ match_status: 'rejected', match_method: 'manual', bf_slug: null, tracking_status: 'pending', reviewed_at: now, updated_at: now, match_note: 'No BFILMY match (admin)' })
        .eq('moviemint_id', id);
      if (error) throw new Error(error.message);
    } else if (action === 'stop' || action === 'resume') {
      const status = action === 'stop' ? 'stopped' : 'active';
      const { error } = await supabaseAdmin.from('fyre_tracked_movie').update({ tracking_status: status, updated_at: now }).eq('moviemint_id', id).eq('match_status', 'matched');
      if (error) throw new Error(error.message);
    } else if (action === 'refresh') {
      await supabaseAdmin.from('bf_sync_state').delete().eq('key', `backfill:${id}`);
      await supabaseAdmin.from('fyre_tracked_movie').update({ backfill_status: 'requested', backfill_requested_at: now }).eq('moviemint_id', id);
      const result = await processBackfills(Date.now() + 45_000, [id]);
      return NextResponse.json({ ok: true, result });
    } else {
      return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 502 });
  }
}
