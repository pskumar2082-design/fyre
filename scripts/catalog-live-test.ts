// Live test of the BFILMY-first catalog with MovieMint BLOCKED (any request
// to moviemintbo.com throws). Run AFTER supabase/migration_catalog.sql.
//
//   npx tsx --env-file=.env.local scripts/catalog-live-test.ts [--create N] [--usa-create N]
//
// What it does (the same work one scheduled sync run does, with a small
// creation limit -- default 2 India + 1 USA new movies):
//   1. snapshot The Paradise / Hanuman Ansh / The Vvaan (ids, slugs, past-day totals)
//   2. India summary sync for today's targets: discovery + import, one fetch per file
//   3. USA box office for today: discovery + import, one fetch
//   4. MovieMint enrichment -> must fail, with no effect on anything above
//   5. every new movie: canonical row, alias, listing mapping, analytics,
//      public listing (search + sitemap source), comparison
//   6. the three movies again: same ids/slugs, no duplicates, past days unchanged
// Prints a report; exit code 1 if any check fails. It does NOT start the
// 90-day bootstrap.
import http from 'node:http';
import https from 'node:https';

const hosts = new Map<string, number>();
let moviemintAttempts = 0;
const note = (h: string) => {
  hosts.set(h, (hosts.get(h) ?? 0) + 1);
  if (/(^|\.)moviemintbo\.com$/.test(h)) {
    moviemintAttempts++;
    throw new Error('MovieMint is blocked for this test');
  }
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  note(new URL(typeof input === 'string' ? input : input.url ?? String(input)).host);
  return realFetch(input, init);
}) as typeof fetch;
for (const mod of [http, https] as any[]) {
  const orig = mod.request;
  mod.request = function (...args: any[]) {
    const a = args[0];
    const h = typeof a === 'string' ? new URL(a).host : a instanceof URL ? a.host : a?.hostname ?? a?.host;
    if (h) note(String(h));
    return orig.apply(this, args);
  };
}

const REGRESSION = ['the-paradise', 'hanuman-ansh', 'the-vvaan-force-of-the-forrest'];

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) || def : def;
}

async function main() {
  const { supabaseAdmin } = await import('../lib/supabaseAdmin');
  const { trackedKeys, publicTrackedSlugs } = await import('../lib/tracking');
  const { defaultTargets, istDate, syncBfilmy } = await import('../lib/bfilmy/sync');
  const { loadTrackedMovies, syncUsFile } = await import('../lib/usa/sync');
  const { usToday } = await import('../lib/usa/days');
  const { syncMovieMintCatalog } = await import('../lib/moviemint/sync');
  const { loadMovieAnalytics } = await import('../lib/analytics/load');
  const { loadUsaAnalytics } = await import('../lib/analytics/usa');
  const { getComparison } = await import('../lib/analytics/compare');
  const { getLiveMovies, getCompletedMovies } = await import('../lib/bfilmy/source');
  const db = supabaseAdmin as any;
  const fails: string[] = [];
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
    if (!ok) fails.push(msg);
  };
  const today = istDate(0);

  const snapshot = async () => {
    const out: Record<string, any> = {};
    for (const slug of REGRESSION) {
      const { data: rows } = await db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,match_status,tracking_status').eq('bf_slug', slug);
      const { data: days } = await db.from('bf_movie_day').select('date,totals').eq('slug', slug).eq('kind', 'boxoffice').lt('date', istDate(-1));
      const id = rows?.[0]?.moviemint_id;
      const { data: us } = id ? await db.from('us_movie_day').select('report_date,gross').eq('movie_id', id).eq('kind', 'boxoffice').lt('report_date', usToday(new Date(), -1)) : { data: [] };
      out[slug] = {
        rows: (rows ?? []).length,
        id,
        status: rows?.[0] ? `${rows[0].match_status}/${rows[0].tracking_status}` : null,
        indiaPastDays: (days ?? []).length,
        indiaPastGross: Math.round((days ?? []).reduce((s: number, d: any) => s + (Number(d.totals?.gross) || 0), 0)),
        usaPastDays: (us ?? []).length,
        usaPastGross: Math.round((us ?? []).reduce((s: number, d: any) => s + (Number(d.gross) || 0), 0))
      };
    }
    return out;
  };

  console.log(`== snapshot before (${today})`);
  const before = await snapshot();
  console.table(before);

  console.log('\n== India sync (discovery + import), MovieMint blocked');
  const tracked = await trackedKeys(db);
  const targets = defaultTargets();
  const india = await syncBfilmy(targets, { tracked: tracked.keys, listings: true, budget: { left: arg('--create', 2) } });
  console.log(JSON.stringify({ files: india.files.map((f) => `${f.kind} ${f.date} ${f.status}`), listings: { ...india.listings, newSlugs: undefined }, errors: india.errors }, null, 1));
  check(india.files.some((f) => f.status === 'ok'), 'India files fetched and imported');

  console.log('\n== USA box office (discovery + import), MovieMint blocked');
  const movies = await loadTrackedMovies();
  const before2 = movies.length;
  const usa = await syncUsFile('boxoffice', usToday(), { movies, discover: { left: arg('--usa-create', 1) } });
  console.log(JSON.stringify({ status: usa.status, listings: usa.listings, imported: usa.imported, error: usa.error }));
  const usaNew = movies.slice(before2).map((m) => m.movieId);

  console.log('\n== MovieMint enrichment (must fail without effect)');
  const mm = await syncMovieMintCatalog({ timeoutMs: 5000 }).then(() => 'reached MovieMint', (e: any) => `failed: ${e.message}`);
  check(mm.startsWith('failed'), `MovieMint unreachable: ${mm}`);

  console.log('\n== new movies');
  const created = (india.listings?.created ?? []).map((c) => /-> (\S+) \(([^)]+)\)/.exec(c)).filter(Boolean).map((m) => ({ id: m![1], slug: m![2] }));
  for (const id of usaNew) {
    const { data } = await db.from('fyre_tracked_movie').select('bf_slug').eq('moviemint_id', id).maybeSingle();
    if (data) created.push({ id, slug: data.bf_slug });
  }
  if (!created.length) console.log('(no new movie qualified in today\'s files -- every title there is already a Fyre movie, waiting, or in review)');
  const pub = await publicTrackedSlugs();
  const listed = new Set([...(await getLiveMovies()), ...(await getCompletedMovies())].map((m: any) => m.slug));
  for (const m of created) {
    const { data: row } = await db.from('fyre_tracked_movie').select('moviemint_id,bf_slug,origin,match_status,tracking_status,created_from,history_complete').eq('moviemint_id', m.id).maybeSingle();
    check(!!row && /^fyre-[0-9a-f]{8}$/.test(m.id), `${m.slug}: canonical row ${m.id} (${row?.origin}, ${row?.created_from})`);
    const { count: dup } = await db.from('fyre_tracked_movie').select('moviemint_id', { count: 'exact', head: true }).eq('bf_slug', m.slug);
    check(dup === 1, `${m.slug}: exactly one Fyre movie with this slug`);
    const { data: alias } = await db.from('fyre_movie_alias').select('source,source_title,decision,decided_at').eq('movie_id', m.id);
    check((alias ?? []).some((a: any) => a.decision === 'created'), `${m.slug}: permanent alias record (${(alias ?? []).map((a: any) => `${a.source}:${a.source_title}`).join(', ')})`);
    const { data: il } = await db.from('bf_listing').select('key').eq('movie_id', m.id).eq('match_status', 'matched');
    const { data: ul } = await db.from('us_movie_map').select('source_movie_id').eq('movie_id', m.id).eq('match_status', 'matched');
    check((il ?? []).length + (ul ?? []).length > 0, `${m.slug}: mapped listings India ${(il ?? []).length} / USA ${(ul ?? []).length}`);
    check(pub.has(m.slug), `${m.slug}: public (catalog status)`);
    const a = (il ?? []).length ? await loadMovieAnalytics(m.slug) : await loadUsaAnalytics(m.slug);
    check(!!a && (a.days.length > 0 || a.advance.length > 0), `${m.slug}: analytics imported (${a?.days.length ?? 0} days, ${a?.advance.length ?? 0} advance)`);
    if ((il ?? []).length) check(listed.has(m.slug), `${m.slug}: in the live/completed listing (search + sitemap source)`);
    const cmp = await getComparison({ slugs: [m.slug, 'the-paradise'], selection: { basis: 'lifetime' }, territory: (il ?? []).length ? 'IN' : 'US' }).catch((e) => ({ error: String(e) }) as any);
    check(!cmp.error && cmp.movies?.length >= 1, `${m.slug}: comparison loads (${cmp.selectionLabel ?? cmp.error})`);
  }

  console.log('\n== regression: The Paradise / Hanuman Ansh / The Vvaan');
  const after = await snapshot();
  console.table(after);
  for (const slug of REGRESSION) {
    const b = before[slug];
    const x = after[slug];
    check(x.rows === 1 && x.id === b.id && x.status === b.status, `${slug}: same single Fyre movie (${x.id}, ${x.status})`);
    check(x.indiaPastDays === b.indiaPastDays && x.indiaPastGross === b.indiaPastGross, `${slug}: India past days unchanged (${x.indiaPastDays} days)`);
    check(x.usaPastDays === b.usaPastDays && x.usaPastGross === b.usaPastGross, `${slug}: USA past days unchanged (${x.usaPastDays} days)`);
    check(pub.has(slug), `${slug}: still public at /movie/${slug}`);
  }

  console.log('\n== source requests by host', JSON.stringify(Object.fromEntries(hosts)));
  check(moviemintAttempts <= 1, `MovieMint: ${moviemintAttempts} attempt(s), all blocked (only the deliberate enrichment call)`);
  console.log(fails.length ? `\n${fails.length} check(s) FAILED` : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
