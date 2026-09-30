import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { makeMetrics, sumMetrics } from '@/lib/analytics/metrics';
import { dayFor, releaseDayOne } from '@/lib/analytics/load';
import type { Metrics } from '@/lib/analytics/types';
import { etStamp } from '@/lib/analytics/usa';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Admin -> Daily Reports.
// ?date=YYYY-MM-DD&territory=in|us|both[&movie=<slug>][&kind=boxoffice|advance]
// India rows use the IST date (BFILMY India files), USA rows the US report
// date (BFILMY USA files). INR and USD are never combined.
// GRAND TOTAL: additive figures summed; occupancy and ATP recomputed from
// the sums; distinct venues/cities/states across movies only where they can
// be counted exactly (USA, from theater rows), otherwise null (N/A).

const db = supabaseAdmin as any;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

type Row = { slug: string; title: string; day: number | null; metrics: Metrics; lastUpdated: string | null; extra?: Record<string, unknown> };

async function trackedMovies(movie: string | null) {
  let q = db.from('fyre_tracked_movie').select('moviemint_id,bf_slug').eq('match_status', 'matched').not('bf_slug', 'is', null);
  if (movie) q = q.eq('bf_slug', movie);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { moviemint_id: string; bf_slug: string }[];
}

async function india(date: string, kind: string, movie: string | null) {
  const tracked = await trackedMovies(movie);
  const slugs = tracked.map((t) => t.bf_slug);
  const rows: Row[] = [];
  for (let i = 0; i < slugs.length; i += 100) {
    const part = slugs.slice(i, i + 100);
    const [days, details, movies] = await Promise.all([
      db.from('bf_movie_day').select('slug,title,totals,source_updated').eq('kind', kind).eq('date', date).in('slug', part),
      db.from('bf_movie_day_detail').select('slug,venues,cities,states,pic,source_updated').eq('kind', kind).eq('date', date).in('slug', part),
      db.from('bf_movie').select('slug,title,release_date,first_date,carried_over,premiere_date').in('slug', part)
    ]);
    for (const x of [days, details, movies]) if (x.error) throw new Error(x.error.message);
    const det = new Map((details.data ?? []).map((d: any) => [d.slug, d]));
    const mv = new Map((movies.data ?? []).map((m: any) => [m.slug, m]));
    for (const r of days.data ?? []) {
      const t = r.totals ?? {};
      const d: any = det.get(r.slug);
      const m: any = mv.get(r.slug);
      rows.push({
        slug: r.slug,
        title: m?.title ?? r.title,
        day: m ? dayFor(date, releaseDayOne(m), m.premiere_date) : null,
        lastUpdated: r.source_updated ?? d?.source_updated ?? null,
        metrics: makeMetrics({
          gross: num(t.gross),
          tickets: num(t.sold),
          shows: num(t.shows),
          seats: num(t.totalSeats),
          ff: t.fastfilling,
          hf: t.housefull,
          cities: d ? d.cities : t.cities,
          venues: d ? d.venues : null,
          states: d ? d.states : null,
          picGross: d ? d.pic?.gross : null,
          picTickets: d ? d.pic?.sold : null
        })
      });
    }
  }
  rows.sort((a, b) => b.metrics.gross - a.metrics.gross);
  const total = rows.length ? sumMetrics(rows.map((r) => r.metrics)) : null;
  return { territory: 'IN', currency: 'INR', date, kind, rows, total, totalNote: 'Venues, cities and states overlap across movies: not added (N/A).' };
}

async function usa(date: string, kind: string, movie: string | null) {
  const tracked = await trackedMovies(movie);
  const bySlug = new Map(tracked.map((t) => [t.moviemint_id, t.bf_slug]));
  const ids = tracked.map((t) => t.moviemint_id);
  const rows: Row[] = [];
  const theatres = new Set<string>();
  const cities = new Set<string>();
  const states = new Set<string>();
  let distinctOk = true;
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    const [{ data, error }, { data: titles }, { data: th }] = await Promise.all([
      db.from('us_movie_day').select('movie_id,release_day,gross,tickets,seats,shows,shows_source,zero_seat_shows,occupancy,occupancy_source,theatres,cities,states,source_seen_at,synced_at,recon').eq('kind', kind).eq('report_date', date).in('movie_id', part),
      db.from('bf_movie').select('slug,title').in('slug', part.map((p) => bySlug.get(p))),
      db.from('us_movie_breakdown').select('movie_id,rows').eq('kind', kind).eq('report_date', date).eq('dimension', 'theater').in('movie_id', part)
    ]);
    if (error) throw new Error(error.message);
    const title = new Map<string, string>((titles ?? []).map((t: any) => [t.slug, t.title]));
    const haveTheaters = new Set((th ?? []).map((t: any) => t.movie_id));
    for (const t of th ?? []) for (const x of t.rows ?? []) {
      const [name, city, state] = (x[0] as string[]).map(String);
      theatres.add(`${name}|${city}|${state}`);
      cities.add(`${city}|${state}`);
      states.add(state);
    }
    for (const r of data ?? []) {
      if (!haveTheaters.has(r.movie_id)) distinctOk = false;
      const slug = bySlug.get(r.movie_id)!;
      const metrics = makeMetrics({ gross: num(r.gross), tickets: num(r.tickets), shows: num(r.shows), seats: num(r.seats), venues: r.theatres, cities: r.cities, states: r.states });
      if (r.occupancy != null) metrics.occupancy = Math.round(Number(r.occupancy) * 100) / 100;
      rows.push({
        slug,
        title: title.get(slug) ?? slug,
        day: r.release_day,
        lastUpdated: etStamp(r.source_seen_at ?? r.synced_at),
        metrics,
        extra: { showsSource: r.shows_source, occupancySource: r.occupancy_source, zeroSeatShows: r.zero_seat_shows, showsStatus: r.recon?.shows?.status ?? null }
      });
    }
  }
  rows.sort((a, b) => b.metrics.gross - a.metrics.gross);
  const total = rows.length ? sumMetrics(rows.map((r) => r.metrics)) : null;
  if (total && distinctOk) Object.assign(total, { venues: theatres.size, cities: cities.size, states: states.size });
  return {
    territory: 'US',
    currency: 'USD',
    label: 'USA · Indian-language screenings',
    date,
    kind,
    rows,
    total,
    totalNote: distinctOk ? 'Theatres, cities and states: distinct across all movies.' : 'Theatres, cities and states: N/A (theater rows not kept for this date).'
  };
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const date = q.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  const territory = (q.get('territory') ?? 'both').toLowerCase();
  const kind = q.get('kind') === 'advance' ? 'advance' : 'boxoffice';
  const movie = q.get('movie') || null;
  try {
    const [inRes, usRes] = await Promise.all([territory !== 'us' ? india(date, kind, movie) : null, territory !== 'in' ? usa(date, kind, movie) : null]);
    return NextResponse.json({ date, kind, india: inRes, usa: usRes });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not build the report' }, { status: 502 });
  }
}
