'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/bfilmy/adapter';

// Admin → Fyre catalog. Fyre owns the catalog: movies are discovered from
// BFILMY India / USA listings by the scheduled sync (or created by an admin
// in India / USA matching). Shows each movie's listings per territory and
// whether metadata is complete; INCOMPLETE metadata never blocks anything.
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

const ORIGIN: Record<string, string> = { bfilmy_usa: 'Discovered from a USA listing', bfilmy_india: 'Discovered from an India listing', admin: 'Created by admin', moviemint: 'Legacy (MovieMint era)' };

export default function CatalogTool() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scope, setScope] = useState<'created' | 'all'>('created');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/catalog?scope=${scope}`, { headers: await authHeader() });
    const j = await res.json();
    if (!res.ok) return setError(j.error ?? `HTTP ${res.status}`);
    setRows(j.rows);
  }, [scope]);
  useEffect(() => {
    load();
  }, [load]);

  async function act(movieId: string, action: string) {
    setBusy(movieId);
    const res = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action, movieId }) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(j.error ?? 'Failed');
    else load();
  }

  return (
    <div>
      <p className="text-xs text-textFaint mb-3">
        Fyre&apos;s own catalog. New movies are discovered from BFILMY India / USA by the scheduled sync; anything uncertain waits in India matching or USA matching.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(
          [
            ['created', 'Discovered / created'],
            ['all', 'Whole catalog']
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setScope(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${scope === k ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOnlyIncomplete((v) => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${onlyIncomplete ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`}
        >
          Metadata incomplete
        </button>
      </div>
      {error && <div className="text-red text-sm mb-3">{error}</div>}
      {rows.length === 0 && <div className="text-sm text-textFaint py-8 text-center">No movies here yet.</div>}
      <div className="grid gap-3">
        {rows.filter((m) => !onlyIncomplete || m.metadata_status === 'incomplete').map((m) => (
          <Card key={m.moviemint_id} className="p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex gap-3">
                <div className="w-12 h-[72px] rounded-md overflow-hidden bg-surface2 border border-border flex-none">
                  {m.metadata?.poster ? <img src={m.metadata.poster} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div>
                  <a href={`/movie/${m.bf_slug}`} className="font-semibold text-text hover:text-gold">
                    {m.title}
                    {m.release_year ? ` (${m.release_year})` : ''}
                  </a>
                  <div className="text-[11px] text-textFaint">
                    {m.moviemint_id} · /movie/{m.bf_slug} · {ORIGIN[m.origin] ?? m.origin} · {(m.languages ?? []).join(', ')}
                    {m.first_source_date ? ` · first seen ${formatDate(m.first_source_date)}` : ''}
                  </div>
                  <div className="text-[11px] text-textDim mt-1">
                    India: {m.indiaListings.length ? `${m.indiaListings.map((l: any) => l.source_title).join(', ')} · ${m.indiaDays} days` : 'no listing'} · USA:{' '}
                    {m.usaListings.length ? `${m.usaListings.map((l: any) => `${l.source_title} (${l.source_movie_id})`).join(', ')} · ${m.usaDays} days` : 'no listing'}
                  </div>
                  <div className="text-[11px] mt-1">
                    <span className={m.activity === 'ACTIVE' ? 'text-gold font-semibold' : 'text-textFaint font-semibold'}>{m.activity}</span>
                    <span className="text-textFaint"> · last BFILMY activity: {m.lastActivity ? formatDate(m.lastActivity) : 'none yet'}</span>
                    <span className="text-textFaint">
                      {' · '}history {m.history_complete === false ? `recent part only, since ${m.history_start_date ? formatDate(m.history_start_date) : "?"} (tracked period, not lifetime)` : m.history_start_date ? `from ${formatDate(m.history_start_date)}` : 'whole run'}
                      {m.us_history_complete === false ? ` · USA since ${m.us_history_start_date ? formatDate(m.us_history_start_date) : "?"} (tracked period)` : ''}
                    </span>
                  </div>
                  <div className={`text-[11px] mt-1 ${m.metadata_status === 'complete' ? 'text-goldDim' : 'text-gold'}`}>
                    Metadata {m.metadata_status === 'incomplete' ? 'INCOMPLETE' : m.metadata_status ?? 'not checked'}
                    {m.metadata?.missing?.length ? ` — missing ${m.metadata.missing.join(', ')}` : ''}
                    {m.match_status !== 'matched' ? ` · hidden (${m.match_status})` : ''}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <button type="button" disabled={busy === m.moviemint_id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(m.moviemint_id, 'metadata')}>
                  Re-check metadata
                </button>
                {m.origin !== 'moviemint' && m.match_status === 'matched' && !m.usaListings.length && !m.indiaListings.length && (
                  <button type="button" disabled={busy === m.moviemint_id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(m.moviemint_id, 'hide')}>
                    Hide
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
