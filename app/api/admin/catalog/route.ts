import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { refreshCatalogMetadata } from '@/lib/catalog/admin';
import { activityStatus } from '@/lib/catalog/core';
import { istDate } from '@/lib/bfilmy/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Fyre's catalog: every movie, where it came from, which territories have
// data, and whether its metadata is complete (incomplete never blocks).
// GET ?scope=created (default: movies created from a BFILMY listing or by an
//     admin) | all (the whole catalog, legacy MovieMint-era movies too)
// POST { action: 'metadata', movieId }   look the metadata up again (fills gaps only)
//      { action: 'hide', movieId }       take a movie with no listings off the site
const db = supabaseAdmin as any;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const scope = req.nextUrl.searchParams.get('scope') === 'all' ? 'all' : 'created';
  let q = db
    .from('fyre_tracked_movie')
    .select('moviemint_id,bf_slug,title,release_year,release_date,languages,first_source_date,origin,metadata,metadata_status,match_status,tracking_status,created_at,history_start_date,history_complete,us_history_start_date,us_history_complete');
  if (scope === 'created') q = q.neq('origin', 'moviemint');
  const { data: movies, error } = await q.order('created_at', { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  const ids: string[] = (movies ?? []).map((m: any) => m.moviemint_id);
  const slugs: string[] = (movies ?? []).map((m: any) => m.bf_slug).filter(Boolean);
  // In chunks (long id lists), every page of rows.
  const many = async (list: string[], build: (part: string[], from: number, to: number) => any) => {
    const out: any[] = [];
    for (let i = 0; i < list.length; i += 100) {
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await build(list.slice(i, i + 100), from, from + 999);
        if (e) throw new Error(e.message);
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
    }
    return { data: out };
  };
  let us: any, india: any, bf: any, usDays: any, alias: any;
  try {
    [us, india, bf, usDays, alias] = await Promise.all([
      many(ids, (p, f, t) => db.from('us_movie_map').select('movie_id,source_movie_id,source_title,last_date').eq('match_status', 'matched').in('movie_id', p).range(f, t)),
      many(ids, (p, f, t) => db.from('bf_listing').select('movie_id,key,source_title,last_date').eq('match_status', 'matched').in('movie_id', p).range(f, t)),
      many(slugs, (p, f, t) => db.from('bf_movie').select('slug,days_tracked,last_date,advance_date').in('slug', p).range(f, t)),
      many(ids, (p, f, t) => db.from('us_movie_day').select('movie_id').eq('kind', 'boxoffice').in('movie_id', p).range(f, t)),
      many(ids, (p, f, t) => db.from('fyre_movie_alias').select('movie_id,source,source_title,decision,created_at').in('movie_id', p).order('created_at').range(f, t))
    ]);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load the catalog' }, { status: 502 });
  }
  const group = (rows: any[], k: string) => {
    const m = new Map<string, any[]>();
    for (const r of rows ?? []) m.set(r[k], [...(m.get(r[k]) ?? []), r]);
    return m;
  };
  const usBy = group(us.data, 'movie_id');
  const inBy = group(india.data, 'movie_id');
  const usDayBy = group(usDays.data, 'movie_id');
  const aliasBy = group(alias.data, 'movie_id');
  const bfBy = new Map((bf.data ?? []).map((b: any) => [b.slug, b]));
  // ACTIVE / INACTIVE from the latest BFILMY activity (India or USA, box
  // office or advance) -- never MovieMint. Inactive movies stay listed.
  const today = istDate(0);
  const latest = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).sort().pop() ?? null;
  const rows = (movies ?? []).map((m: any) => {
    const b: any = bfBy.get(m.bf_slug);
    const lastActivity = latest(
      b?.last_date,
      b?.advance_date,
      ...(usBy.get(m.moviemint_id) ?? []).map((l: any) => l.last_date),
      ...(inBy.get(m.moviemint_id) ?? []).map((l: any) => l.last_date)
    );
    return { ...m, lastActivity, activity: activityStatus(lastActivity, today), ...rest(m) };
  });
  function rest(m: any) {
    return {
    usaListings: usBy.get(m.moviemint_id) ?? [],
    indiaListings: inBy.get(m.moviemint_id) ?? [],
    indiaDays: (bfBy.get(m.bf_slug) as any)?.days_tracked ?? 0,
    usaDays: (usDayBy.get(m.moviemint_id) ?? []).length,
    aliases: aliasBy.get(m.moviemint_id) ?? []
    };
  }
  return NextResponse.json({ rows, scope });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.movieId ?? '');
  const { data: movie } = await db.from('fyre_tracked_movie').select('moviemint_id,origin,match_status').eq('moviemint_id', id).maybeSingle();
  if (!movie) return NextResponse.json({ error: 'Unknown movie' }, { status: 404 });
  if (body.action === 'hide' && movie.origin === 'moviemint') return NextResponse.json({ error: 'Stop a legacy movie from the MovieMint (legacy) tab' }, { status: 409 });
  try {
    if (body.action === 'metadata') return NextResponse.json({ ok: true, result: await refreshCatalogMetadata([id]) });
    if (body.action === 'hide') {
      const [{ data: u }, { data: i }] = await Promise.all([
        db.from('us_movie_map').select('source_movie_id').eq('movie_id', id).eq('match_status', 'matched').limit(1),
        db.from('bf_listing').select('key').eq('movie_id', id).eq('match_status', 'matched').limit(1)
      ]);
      if (u?.length || i?.length) return NextResponse.json({ error: 'Unmatch or reject its listings first' }, { status: 409 });
      await db.from('fyre_tracked_movie').update({ match_status: 'rejected', tracking_status: 'stopped', match_note: 'Hidden by admin', updated_at: new Date().toISOString() }).eq('moviemint_id', id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 502 });
  }
}
