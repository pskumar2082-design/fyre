// Retention safety test: every historical number shown by the movie page,
// Movie Comparison and the X poster must be identical before and after the
// raw show rows for a finished date are pruned. Only show-level drilldown
// may disappear.
//
//   npx tsx --env-file=.env.local scripts/verify-retention.ts snapshot before.json
//   npx tsx --env-file=.env.local scripts/verify-retention.ts prune 5
//   npx tsx --env-file=.env.local scripts/verify-retention.ts snapshot after.json
//   npx tsx --env-file=.env.local scripts/verify-retention.ts compare before.json after.json
import crypto from 'crypto';
import React from 'react';
import { supabaseAdmin } from '../lib/supabaseAdmin';

(globalThis as any).React = React;

async function snapshot(a: string, b: string) {
  const { loadMovieAnalytics, loadBreakdown } = await import('../lib/analytics/load');
  const { getComparison } = await import('../lib/analytics/compare');
  const { loadShows } = await import('../lib/analytics/shows');
  const { GET } = await import('../app/api/social-poster/x-compare/route');
  const m = (await loadMovieAnalytics(a))!;
  const out: Record<string, unknown> = {};
  // movie page
  out.page = { days: m.days.map((d) => [d.date, d.label, d.metrics]), lifetime: m.lifetime, advance: m.advance.map((d) => [d.date, d.metrics]) };
  for (const dim of ['state', 'city', 'language', 'language_state', 'chain', 'venue', 'pic', 'time_slot', 'show_hour', 'price_band'] as const) {
    for (const sel of [{ basis: 'day', day: 1 }, { basis: 'cumulative', day: 3 }, { basis: 'lifetime' }] as const) {
      const bd = await loadBreakdown(m, sel as any, dim);
      out[`page:${dim}:${JSON.stringify(sel)}`] = { available: bd.available, rows: bd.rows.map((r) => [r.key, r.metrics, r.cumulative ?? null]) };
    }
  }
  // comparison
  for (const [sel, dim] of [
    [{ basis: 'day', day: 1 }, 'state'],
    [{ basis: 'cumulative', day: 3 }, 'language'],
    [{ basis: 'lifetime' }, 'chain'],
    [{ basis: 'advance', day: 1 }, 'city']
  ] as const) {
    const c = await getComparison({ slugs: [a, b], selection: sel as any, dimension: dim as any, metric: 'gross', limit: 'all' });
    out[`compare:${dim}:${JSON.stringify(sel)}`] = { movies: c.movies.map((x) => [x.slug, x.summary]), rows: c.rows, trend: c.trend };
  }
  // poster (the PNG itself)
  for (const qs of [`movies=${a},${b}&basis=day&day=1&dimension=state&limit=5&chart=1`, `movies=${a}&basis=cumulative&day=3&dimension=language&limit=5`]) {
    const res = await GET(new Request(`http://x/api/social-poster/x-compare?${qs}`));
    const buf = Buffer.from(await res.arrayBuffer());
    out[`poster:${qs}`] = { status: res.status, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
  }
  // show-level drilldown (allowed to change)
  const day1 = m.days.find((d) => d.day === 1)!;
  const shows = await loadShows(a, day1.date);
  return { values: out, showLevel: { date: day1.date, available: shows.available, rows: shows.rows.length, reason: shows.reason } };
}

function diff(x: any, y: any): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(k);
  return out;
}

// Steps (each can run as its own process):
//   snapshot <file> [movie-a] [movie-b]   record every value
//   prune <keepDays>                      bf_prune_shows, as in production
//   compare <before> <after>              diff two snapshots
(async () => {
  const [step, ...args] = process.argv.slice(2);
  const fs = await import('fs');
  if (step === 'snapshot') {
    const [file, a = 'the-paradise', b = 'the-vvaan-force-of-the-forrest'] = args;
    const snap = await snapshot(a, b);
    fs.writeFileSync(file, JSON.stringify(snap));
    console.log(`recorded ${Object.keys(snap.values).length} value groups; show-level`, JSON.stringify(snap.showLevel));
  } else if (step === 'prune') {
    const { count: before } = await supabaseAdmin.from('bf_show').select('id', { count: 'exact', head: true });
    const { data, error } = await supabaseAdmin.rpc('bf_prune_shows', { p_keep_days: Number(args[0] ?? 7), p_dry_run: false });
    if (error) throw new Error(error.message);
    const { count: after } = await supabaseAdmin.from('bf_show').select('id', { count: 'exact', head: true });
    console.log(JSON.stringify({ prunedShowRows: data, showRows: { before, after } }));
  } else if (step === 'compare') {
    const x = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    const y = JSON.parse(fs.readFileSync(args[1], 'utf8'));
    const changed = diff(x.values, y.values);
    console.log(JSON.stringify({ checkedValueGroups: Object.keys(x.values).length, changed, showLevel: { before: x.showLevel, after: y.showLevel }, pass: changed.length === 0 }, null, 1));
    if (changed.length) process.exitCode = 1;
  } else {
    console.log('usage: verify-retention.ts snapshot <file> [a] [b] | prune <keepDays> | compare <before> <after>');
  }
})();
