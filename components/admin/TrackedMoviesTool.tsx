'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/bfilmy/adapter';

// Admin → MovieMint (legacy). Read-mostly view of the stored MovieMint list
// next to Fyre's catalog. MovieMint is enrichment only: it never decides
// which movies Fyre tracks (BFILMY discovery + the Catalog tab do).

type Row = {
  moviemint: { moviemint_id: string; title: string; language: string | null; release_date: string | null; poster: string | null; badge: string | null; source_url: string; last_tracked_date: string | null; on_list: boolean };
  tracking: null | {
    bf_slug: string | null;
    match_status: string;
    match_confidence: string | null;
    match_method: string | null;
    match_note: string | null;
    candidates: any[];
    tracking_status: string;
    backfill_status: string | null;
  };
  bfilmy: null | { slug: string; title: string; languages: string[] | null; formats: string[] | null; release_date: string | null; first_date: string | null; last_date: string | null; days_tracked: number; advance_date: string | null };
  detailDays: null | { boxoffice: number; advance: number };
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const d = (iso: string | null | undefined) => (iso ? formatDate(iso) : '—');

function StatusPill({ text, tone }: { text: string; tone: 'good' | 'warn' | 'bad' | 'dim' }) {
  const cls = {
    good: 'bg-goldDim/[0.12] text-goldDim border-goldDim/25',
    warn: 'bg-amber/[0.12] text-amber border-amber/25',
    bad: 'bg-red/[0.12] text-red border-red/25',
    dim: 'bg-white/[0.05] text-textDim border-border'
  }[tone];
  return <span className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cls}`}>{text}</span>;
}

export default function TrackedMoviesTool() {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'review' | 'active' | 'ended'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracked', { headers: await authHeader() });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not load');
      setRows(j.rows);
      setState(j.state ?? {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, moviemint_id?: string, bf_slug?: string) {
    setBusy(`${action}:${moviemint_id ?? ''}`);
    setError(null);
    try {
      const res = await fetch('/api/admin/tracked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ action, moviemint_id, bf_slug })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Failed');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  const groups = useMemo(() => {
    const review = rows.filter((r) => r.tracking && r.tracking.match_status !== 'matched' && r.tracking.match_status !== 'rejected' && r.moviemint.on_list);
    const active = rows.filter((r) => r.tracking?.match_status === 'matched' && r.tracking.tracking_status === 'active');
    const ended = rows.filter((r) => r.tracking?.match_status === 'matched' && r.tracking.tracking_status !== 'active');
    const other = rows.filter((r) => !review.includes(r) && !active.includes(r) && !ended.includes(r));
    return { review, active, ended, other };
  }, [rows]);

  const visible =
    filter === 'review' ? groups.review : filter === 'active' ? groups.active : filter === 'ended' ? groups.ended : [...groups.review, ...groups.active, ...groups.ended, ...groups.other];
  const mmSync = state.last_moviemint_sync;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-xs text-textFaint">
          MovieMint (legacy, enrichment only): {mmSync ? `${mmSync.movies} movies · checked ${new Date(mmSync.fetchedAt).toLocaleString('en-IN')}` : 'not synced yet'} · {groups.active.length} tracking · {groups.review.length} need review · {groups.ended.length} ended
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => act('catalog')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold border border-gold/30 rounded-full px-3 py-1.5 hover:bg-gold/10 disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy === 'catalog:' ? 'animate-spin' : ''} /> Refresh MovieMint data (optional)
        </button>
      </div>
      <div className="flex gap-1.5 mb-4">
        {(['all', 'review', 'active', 'ended'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === f ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`}
          >
            {f === 'all' ? 'All' : f === 'review' ? `Needs review (${groups.review.length})` : f === 'active' ? `Tracking (${groups.active.length})` : `Ended (${groups.ended.length})`}
          </button>
        ))}
      </div>
      {error && <div className="text-red text-sm mb-3">{error}</div>}
      {loading && !rows.length ? (
        <div className="text-sm text-textFaint py-10 text-center">Loading…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((r) => (
            <MovieRow key={r.moviemint.moviemint_id} r={r} open={open === r.moviemint.moviemint_id} onToggle={() => setOpen(open === r.moviemint.moviemint_id ? null : r.moviemint.moviemint_id)} busy={busy} act={act} />
          ))}
        </div>
      )}
    </div>
  );
}

function MovieRow({ r, open, onToggle, busy, act }: { r: Row; open: boolean; onToggle: () => void; busy: string | null; act: (a: string, id?: string, slug?: string) => void }) {
  const m = r.moviemint;
  const t = r.tracking;
  const bf = r.bfilmy;
  const id = m.moviemint_id;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  async function search() {
    const res = await fetch(`/api/admin/tracked?search=${encodeURIComponent(query || m.title)}`, { headers: await authHeader() });
    const j = await res.json();
    setResults(j.results ?? []);
  }

  const matchTone = t?.match_status === 'matched' ? 'good' : t?.match_status === 'rejected' ? 'bad' : 'warn';
  const fyreText = t?.match_status !== 'matched' ? 'Not tracked' : t.tracking_status === 'active' ? 'Active' : t.tracking_status === 'ended' ? 'Ended' : t.tracking_status === 'stopped' ? 'Stopped' : t.tracking_status;
  const btn = 'text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-textDim hover:text-text hover:border-gold/30 disabled:opacity-50';

  return (
    <Card className="p-3.5">
      <div className="flex gap-3.5">
        <div className="w-[52px] h-[78px] flex-none rounded-lg overflow-hidden bg-surface2 border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {m.poster ? <img src={m.poster} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <a href={m.source_url} target="_blank" rel="noreferrer" className="font-semibold text-text hover:text-gold truncate">
              {m.title}
            </a>
            {m.badge && <StatusPill text={m.badge} tone="dim" />}
          </div>
          <div className="text-[11px] text-textFaint mt-0.5">
            {m.language ?? 'Language not given'} · Released {d(m.release_date)}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
            <span>
              MovieMint: <StatusPill text={m.on_list ? 'Tracked' : 'Off list'} tone={m.on_list ? 'good' : 'dim'} />
            </span>
            <span>
              BFILMY: <StatusPill text={t ? (t.match_status === 'needs_review' ? 'Needs review' : t.match_status) : 'Pending'} tone={matchTone} />
              {t?.match_confidence && <span className="text-textFaint ml-1">({t.match_confidence})</span>}
            </span>
            <span>
              Fyre: <StatusPill text={fyreText} tone={fyreText === 'Active' ? 'good' : fyreText === 'Not tracked' ? 'warn' : 'dim'} />
            </span>
            {t?.backfill_status && t.backfill_status !== 'done' && <span className="text-textFaint">History import: {t.backfill_status}</span>}
          </div>
          {bf && (
            <div className="text-[11px] text-textDim mt-1.5">
              {bf.title} · {(bf.languages ?? []).join(', ')} · {(bf.formats ?? []).join(', ')}
              <br />
              History: {d(bf.first_date)} → {d(bf.last_date)} ({bf.days_tracked} days){r.detailDays ? ` · breakdowns ${r.detailDays.boxoffice} days · advance ${r.detailDays.advance} dates` : ''}
            </div>
          )}
          {t?.match_note && <div className="text-[11px] text-amber mt-1">{t.match_note}</div>}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <button type="button" className={btn} onClick={onToggle}>
              {t?.match_status === 'matched' ? 'View match' : 'Match BFILMY movie'}
            </button>
            {t?.match_status === 'matched' && (
              <>
                <a className={btn} href={`/movie/${t.bf_slug}`} target="_blank" rel="noreferrer">
                  Open on Fyre
                </a>
                <button type="button" className={btn} disabled={!!busy} onClick={() => act('refresh', id)}>
                  {busy === `refresh:${id}` ? 'Refreshing…' : 'Refresh data'}
                </button>
                {t.tracking_status === 'stopped' ? (
                  <button type="button" className={btn} disabled={!!busy} onClick={() => act('resume', id)}>
                    Resume tracking
                  </button>
                ) : (
                  <button type="button" className={btn} disabled={!!busy} onClick={() => confirm(`Stop tracking ${m.title}? Its history stays on Fyre.`) && act('stop', id)}>
                    Stop tracking
                  </button>
                )}
              </>
            )}
          </div>
          {open && (
            <div className="mt-3 border-t border-border pt-3">
              <div className="mdtype-overline text-textFaint mb-2">Candidates found</div>
              {(t?.candidates ?? []).length === 0 && <div className="text-xs text-textFaint mb-2">None found automatically.</div>}
              {(t?.candidates ?? []).map((c: any) => (
                <div key={c.slug} className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b border-border last:border-b-0">
                  <div>
                    <span className="font-semibold text-text">{c.title}</span> <span className="text-textFaint">({c.slug})</span>
                    <div className="text-textFaint">
                      {(c.languages ?? []).join('/')} · Day 1 {d(c.releaseDate)} · shows {d(c.firstDate)} → {d(c.lastDate)} · title {c.titleMatch} · date gap {c.dateGap ?? '?'}d · language {c.languageOk == null ? 'not given' : c.languageOk ? 'ok' : 'differs'}
                    </div>
                  </div>
                  {!(t?.match_status === 'matched' && t.bf_slug === c.slug) && (
                    <button type="button" className={btn} disabled={!!busy} onClick={() => act('match', id, c.slug)}>
                      Use this
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 mt-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search BFILMY for "${m.title}"`}
                  className="flex-1 text-xs bg-surface border border-border rounded-full px-3 py-1.5 text-text"
                />
                <button type="button" className={btn} onClick={search}>
                  Search
                </button>
              </div>
              {results.map((c) => (
                <div key={c.slug} className="flex items-center justify-between gap-2 text-xs py-1.5">
                  <span>
                    {c.title} <span className="text-textFaint">({c.slug} · {(c.languages ?? []).join('/')} · {d(c.first_date)} → {d(c.last_date)})</span>
                  </span>
                  <button type="button" className={btn} disabled={!!busy} onClick={() => act('match', id, c.slug)}>
                    Use this
                  </button>
                </div>
              ))}
              {t?.match_status !== 'rejected' && (
                <button type="button" className={`${btn} mt-3`} disabled={!!busy} onClick={() => act('reject', id)}>
                  No BFILMY match
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
