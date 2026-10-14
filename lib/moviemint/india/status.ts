// Admin: source status + dry-run comparison (Supabase only; no source site
// is contacted). Read by app/api/admin/source-status.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { moviemintIndia, moviemintIndiaSyncEnabled, bfilmyIndiaSyncEnabled, sourcePolicy } from '@/lib/sourcePolicy';
import { addDays } from './normalize';
import { MMI_BREAKDOWN_DAYS } from './plan';

const db = supabaseAdmin as any;

async function all(table: string, columns: string, apply: (q: any) => any = (q) => q): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function state(key: string): Promise<any> {
  const { data } = await db.from('bf_sync_state').select('value,updated_at').eq('key', key).maybeSingle();
  return data ? { ...(data.value ?? {}), updatedAt: data.updated_at } : null;
}

export type StatusMovie = {
  moviemintId: string;
  movieId: string | null;
  slug: string | null;
  title: string;
  link: string;
  onList: boolean;
  india: { days: number; gross: number; first: string | null; last: string | null; missing: number; breakdownDays: number; windowDays: number } | null;
  usa: { sourceIds: number[]; days: number } | null;
  bfilmyIndiaGross: number | null; // BFILMY India total for the same Fyre movie (comparison only)
  slugChange: string | null; // public URL under the BFILMY policy, when different
  note: string | null;
  candidates: { movieId: string; slug: string | null; title: string | null; dateGap: number | null; languageOk: boolean | null }[];
};

export async function sourceStatus() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const windowStart = addDays(today, -MMI_BREAKDOWN_DAYS);
  let tablesReady = true;
  const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (err: any) {
      if (/mmi_/.test(String(err?.message))) tablesReady = false;
      return fallback;
    }
  };
  const [mm, links, mmiMovies, fyre, usMap, usDays, bfMovies, lastRun, lastOk, failures, lastCatalog, finalWindow] = await Promise.all([
    all('mm_movie', 'moviemint_id,title,on_list,release_date,last_tracked_date'),
    safe(all('mmi_catalog', 'moviemint_id,movie_id,slug,link_status,link_method,link_note,candidates'), [] as any[]),
    safe(all('mmi_movie', 'slug,moviemint_id,days_tracked,total_gross,first_date,last_date,missing_dates,breakdown_days,advance_date'), [] as any[]),
    all('fyre_tracked_movie', 'moviemint_id,bf_slug,title,origin,match_status,tracking_status'),
    all('us_movie_map', 'source_movie_id,source_title,movie_id,match_status,last_date'),
    all('us_movie_day', 'movie_id,kind', (q) => q.eq('kind', 'boxoffice')),
    all('bf_movie', 'slug,total_gross', (q) => q.gt('total_gross', 0)),
    state('last_mmi_sync'),
    state('last_mmi_success'),
    state('mmi_failures'),
    state('last_moviemint_sync'),
    safe(all('mmi_movie_day', 'slug,date,breakdown_status', (q) => q.eq('kind', 'boxoffice').gte('date', windowStart).lt('date', today)), [] as any[])
  ]);

  const fyreBy = new Map(fyre.map((f: any) => [f.moviemint_id, f]));
  const mmiBy = new Map(mmiMovies.map((m: any) => [m.slug, m]));
  const bfGross = new Map(bfMovies.map((b: any) => [b.slug, Number(b.total_gross) || 0]));
  const linkBy = new Map(links.map((l: any) => [l.moviemint_id, l]));
  const usByMovie = new Map<string, number[]>();
  for (const u of usMap) if (u.match_status === 'matched' && u.movie_id) usByMovie.set(u.movie_id, [...(usByMovie.get(u.movie_id) ?? []), Number(u.source_movie_id)]);
  const usDayCount = new Map<string, number>();
  for (const d of usDays) usDayCount.set(d.movie_id, (usDayCount.get(d.movie_id) ?? 0) + 1);
  const windowDays = new Map<string, { all: number; final: number }>();
  for (const d of finalWindow) {
    const w = windowDays.get(d.slug) ?? { all: 0, final: 0 };
    w.all++;
    if (d.breakdown_status === 'final') w.final++;
    windowDays.set(d.slug, w);
  }

  const movies: StatusMovie[] = mm.map((m: any) => {
    const l = linkBy.get(m.moviemint_id);
    const linked = l?.link_status === 'linked';
    const f = linked ? fyreBy.get(l.movie_id) : null;
    const india = linked ? mmiBy.get(l.slug) : null;
    const usIds = linked ? usByMovie.get(l.movie_id) ?? [] : [];
    const w = linked ? windowDays.get(l.slug) : null;
    return {
      moviemintId: m.moviemint_id,
      movieId: l?.movie_id ?? null,
      slug: l?.slug ?? null,
      title: m.title,
      link: l ? `${l.link_status}${l.link_method ? ` (${l.link_method})` : ''}` : 'not linked yet',
      onList: !!m.on_list,
      india: india
        ? {
            days: india.days_tracked,
            gross: Number(india.total_gross) || 0,
            first: india.first_date,
            last: india.last_date,
            missing: (india.missing_dates ?? []).length,
            breakdownDays: w?.final ?? 0,
            windowDays: w?.all ?? 0
          }
        : null,
      usa: usIds.length ? { sourceIds: usIds, days: usDayCount.get(l.movie_id) ?? 0 } : null,
      bfilmyIndiaGross: f?.bf_slug && f.match_status === 'matched' ? bfGross.get(f.bf_slug) ?? null : null,
      slugChange: f?.bf_slug && f.match_status === 'matched' && f.bf_slug !== l?.slug ? f.bf_slug : null,
      note: l?.link_note ?? null,
      candidates: l?.link_status === 'needs_review' ? (l.candidates ?? []) : []
    };
  });

  const linked = movies.filter((m) => m.link.startsWith('linked'));
  const withIndia = linked.filter((m) => m.india && m.india.days > 0);
  const withUsa = linked.filter((m) => m.usa && m.usa.days > 0);
  const linkedMovieIds = new Set(linked.map((m) => m.movieId));

  // Public today under the BFILMY policy vs under the MovieMint policy.
  const bfPublic = fyre.filter((f: any) => f.match_status === 'matched' && ['active', 'ended', 'stopped'].includes(f.tracking_status) && f.bf_slug);
  const hiddenUnderPolicy = bfPublic.filter((f: any) => !linkedMovieIds.has(f.moviemint_id)).map((f: any) => ({ movieId: f.moviemint_id, slug: f.bf_slug, title: f.title, origin: f.origin }));
  const bfPublicIds = new Set(bfPublic.map((f: any) => f.moviemint_id));
  const newUnderPolicy = linked.filter((m) => !bfPublicIds.has(m.movieId)).map((m) => ({ moviemintId: m.moviemintId, slug: m.slug, title: m.title }));

  const usaUnmatched = usMap
    .filter((u: any) => u.match_status !== 'matched' && u.match_status !== 'rejected' && u.last_date && u.last_date >= addDays(today, -30))
    .map((u: any) => ({ sourceId: Number(u.source_movie_id), title: u.source_title, status: u.match_status, lastDate: u.last_date }));
  const usaOutsideCatalog = usMap
    .filter((u: any) => u.match_status === 'matched' && u.movie_id && !linkedMovieIds.has(u.movie_id))
    .map((u: any) => ({ sourceId: Number(u.source_movie_id), title: u.source_title, movieId: u.movie_id }));

  return {
    policy: { active: sourcePolicy(), moviemintIndia: moviemintIndia(), moviemintSync: moviemintIndiaSyncEnabled(), bfilmyIndiaSync: bfilmyIndiaSyncEnabled() },
    tablesReady,
    counts: {
      moviemintCatalog: mm.filter((m: any) => m.on_list).length,
      moviemintKnown: mm.length,
      linked: linked.length,
      needsReview: movies.filter((m) => m.link.startsWith('needs_review')).length,
      notLinkedYet: movies.filter((m) => m.link === 'not linked yet').length,
      withIndia: withIndia.length,
      withUsa: withUsa.length,
      withBoth: withIndia.filter((m) => m.usa && m.usa.days > 0).length,
      withNeither: linked.filter((m) => !(m.india && m.india.days > 0) && !(m.usa && m.usa.days > 0)).length,
      usaUnmatched: usaUnmatched.length,
      usaOutsideCatalog: usaOutsideCatalog.length
    },
    sync: { lastRun, lastSuccess: lastOk, lastCatalog, failures: (failures?.list ?? []).slice(0, 30) },
    missing: {
      noIndiaData: linked.filter((m) => !m.india || m.india.days === 0).map((m) => m.title),
      gaps: linked.filter((m) => m.india && m.india.missing > 0).map((m) => ({ title: m.title, missing: m.india!.missing })),
      breakdownBacklog: linked.reduce((a, m) => a + (m.india ? Math.max(0, m.india.windowDays - m.india.breakdownDays) : 0), 0),
      // Never provided by MovieMint (shown as unavailable on the site)
      neverProvided: ['Chain-wise', 'Venue / theater', 'PIC (PVR · INOX · Cinepolis)', 'Show-start hour / time slot', 'Ticket-price band', 'Language × State / City', 'Seats by language and format']
    },
    dryRun: { hiddenUnderPolicy, newUnderPolicy, slugChanges: linked.filter((m) => m.slugChange).map((m) => ({ title: m.title, from: m.slugChange, to: m.slug })) },
    usaUnmatched: usaUnmatched.slice(0, 100),
    usaOutsideCatalog,
    movies
  };
}
