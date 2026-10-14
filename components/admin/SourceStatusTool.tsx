'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui';

// Admin → Sources. MovieMint (catalog + India) / BFILMY USA status, the
// dry-run comparison for the MovieMint India policy, and admin review of
// MovieMint movies the sync could not link with certainty.
type Status = any;

const cr = (rupees: number | null | undefined) => (rupees == null ? '—' : `₹${(rupees / 1e7).toFixed(2)} Cr`);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—');

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mdtype-overline text-textFaint">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-text">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-textFaint">{sub}</div>}
    </div>
  );
}

export default function SourceStatusTool() {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'review' | 'no-india' | 'usa'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/source-status', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, moviemint_id: string, movie_id?: string) {
    setBusy(moviemint_id);
    try {
      const r = await fetch('/api/admin/source-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, moviemint_id, movie_id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const movies = useMemo(() => {
    const list: any[] = data?.movies ?? [];
    if (filter === 'review') return list.filter((m) => m.link.startsWith('needs_review'));
    if (filter === 'no-india') return list.filter((m) => m.link.startsWith('linked') && !(m.india?.days > 0));
    if (filter === 'usa') return list.filter((m) => m.usa?.days > 0);
    return list;
  }, [data, filter]);

  const chip = (on: boolean) =>
    `h-9 px-3.5 rounded-lg border text-sm font-semibold transition-colors ${on ? 'bg-white border-white text-black' : 'border-border bg-surface text-textDim hover:text-white hover:border-borderStrong'}`;

  if (!data)
    return (
      <Card className="p-6 text-sm text-textFaint">
        {error ? <span className="text-red">Could not load source status: {error}</span> : 'Loading source status…'}
      </Card>
    );

  const c = data.counts;
  const run = data.sync.lastRun;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`inline-flex items-center h-7 px-3 rounded-full border font-mono text-[13px] ${data.policy.moviemintIndia ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border bg-surface2 text-textDim'}`}>
          policy: {data.policy.active}
        </span>
        <span className="inline-flex items-center h-7 px-3 rounded-full border border-border bg-surface2 font-mono text-[13px] text-textDim">MovieMint sync {data.policy.moviemintSync ? 'on' : 'off'}</span>
        <span className="inline-flex items-center h-7 px-3 rounded-full border border-border bg-surface2 font-mono text-[13px] text-textDim">BFILMY India sync {data.policy.bfilmyIndiaSync ? 'on' : 'off'}</span>
        {!data.tablesReady && <span className="text-red text-xs">Run supabase/migration_moviemint_india.sql first.</span>}
        <button type="button" onClick={load} className="ml-auto inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-border bg-surface text-sm font-semibold text-textDim hover:text-white hover:border-borderStrong">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="text-sm text-red">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="MovieMint catalog" value={c.moviemintCatalog} sub={`${c.moviemintKnown} known · ${c.linked} linked`} />
        <Stat label="Needs review" value={c.needsReview} sub={`${c.notLinkedYet} not linked yet`} />
        <Stat label="With India data" value={c.withIndia} sub="MovieMint" />
        <Stat label="With USA data" value={c.withUsa} sub="BFILMY USA" />
        <Stat label="With both" value={c.withBoth} />
        <Stat label="With neither" value={c.withNeither} />
        <Stat label="Unmatched USA" value={c.usaUnmatched} sub="seen in the last 30 days" />
        <Stat label="USA outside catalog" value={c.usaOutsideCatalog} sub="hidden under the policy" />
      </div>

      <Card className="p-5 space-y-2 text-sm">
        <div className="font-bold text-text">MovieMint sync</div>
        <div className="text-textDim">
          Last run {when(run?.finishedAt)} · {(run?.pages ?? []).filter((p: any) => p.ok).length} pages ok, {(run?.pages ?? []).filter((p: any) => !p.ok).length} failed · {run?.pending ?? '—'} pending
          {run?.stoppedBy ? ` · stopped by ${run.stoppedBy}` : ''}
        </div>
        <div className="text-textDim">Last successful sync {when(data.sync.lastSuccess?.finishedAt)} · catalog list {when(data.sync.lastCatalog?.fetchedAt)}</div>
        <div className="text-textDim">Breakdown backlog (90-day window): {data.missing.breakdownBacklog} movie-days</div>
        {data.sync.failures.length > 0 && (
          <details className="pt-1">
            <summary className="cursor-pointer text-textDim hover:text-white">Import failures ({data.sync.failures.length})</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs text-textFaint">
              {data.sync.failures.map((f: any, i: number) => (
                <li key={i}>
                  {when(f.at)} · {f.movie ?? '—'} · {f.page} · {f.error}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="pt-1 text-xs text-textFaint">Not published by MovieMint (shown as unavailable): {data.missing.neverProvided.join(' · ')}</div>
      </Card>

      <Card className="p-5 space-y-3 text-sm">
        <div className="font-bold text-text">Dry run: what the MovieMint India policy changes</div>
        <div className="text-textDim">
          {data.dryRun.newUnderPolicy.length} movies become public · {data.dryRun.hiddenUnderPolicy.length} BFILMY-only movies are hidden (data kept) · {data.dryRun.slugChanges.length} URL changes
        </div>
        {data.dryRun.hiddenUnderPolicy.length > 0 && (
          <div className="text-xs text-textFaint">Hidden: {data.dryRun.hiddenUnderPolicy.map((h: any) => `${h.title ?? h.slug} (${h.origin})`).join(', ')}</div>
        )}
        {data.dryRun.newUnderPolicy.length > 0 && <div className="text-xs text-textFaint">New: {data.dryRun.newUnderPolicy.map((h: any) => h.title).join(', ')}</div>}
        {data.dryRun.slugChanges.length > 0 && <div className="text-xs text-textFaint">URL changes: {data.dryRun.slugChanges.map((h: any) => `${h.from} → ${h.to}`).join(', ')}</div>}
      </Card>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['review', `Needs review (${c.needsReview})`],
            ['no-india', 'No India data'],
            ['usa', 'With USA']
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={chip(filter === k)} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="bg-surface2/60 border-b border-borderStrong text-left mdtype-overline text-textFaint">
              <th className="py-3 px-4">MovieMint movie</th>
              <th className="py-3 px-4">Link</th>
              <th className="py-3 px-4 text-right">India (MovieMint)</th>
              <th className="py-3 px-4 text-right">BFILMY India (was)</th>
              <th className="py-3 px-4 text-right">USA days</th>
              <th className="py-3 px-4">Gaps / breakdowns</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((m: any) => (
              <tr key={m.moviemintId} className="border-b border-border last:border-0 align-top">
                <td className="py-3 px-4">
                  <div className="font-semibold text-text">{m.title}</div>
                  <div className="font-mono text-xs text-textFaint">
                    {m.moviemintId}
                    {m.slug ? ` · /movie/${m.slug}` : ''}
                    {!m.onList ? ' · off list' : ''}
                  </div>
                </td>
                <td className="py-3 px-4 text-textDim">
                  <div>{m.link}</div>
                  {m.note && <div className="text-xs text-textFaint">{m.note}</div>}
                  {m.link.startsWith('needs_review') && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(m.candidates ?? []).map((c: any) => (
                        <button key={c.movieId} type="button" disabled={busy === m.moviemintId} className={chip(false)} onClick={() => act('link', m.moviemintId, c.movieId)}>
                          Link to {c.title ?? c.movieId}
                          {c.dateGap != null ? ` (${c.dateGap}d)` : ''}
                        </button>
                      ))}
                      <button type="button" disabled={busy === m.moviemintId} className={chip(false)} onClick={() => act('create', m.moviemintId)}>
                        New Fyre movie
                      </button>
                      <button type="button" disabled={busy === m.moviemintId} className={chip(false)} onClick={() => act('exclude', m.moviemintId)}>
                        Exclude
                      </button>
                      <LinkPicker onPick={(id) => act('link', m.moviemintId, id)} />
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  {m.india ? (
                    <>
                      <div className="text-gold">{cr(m.india.gross)}</div>
                      <div className="text-xs text-textFaint">{m.india.days} days</div>
                    </>
                  ) : (
                    <span className="text-textFaint">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono text-textDim">{cr(m.bfilmyIndiaGross)}</td>
                <td className="py-3 px-4 text-right font-mono text-textDim">{m.usa ? m.usa.days : '—'}</td>
                <td className="py-3 px-4 text-xs text-textFaint">
                  {m.india ? `${m.india.missing} missing · ${m.india.breakdownDays}/${m.india.windowDays} final breakdowns` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinkPicker({ onPick }: { onPick: (movieId: string) => void }) {
  const [v, setV] = useState('');
  return (
    <span className="inline-flex gap-1.5">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Fyre movie id" className="h-9 w-40 rounded-lg border border-border bg-surface px-2.5 text-sm text-text placeholder:text-textFaint" />
      <button type="button" disabled={!v.trim()} onClick={() => onPick(v.trim())} className="h-9 px-3.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40">
        Link
      </button>
    </span>
  );
}
