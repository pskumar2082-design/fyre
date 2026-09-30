'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/bfilmy/adapter';

// Admin → USA matching. Which BFILMY USA listing belongs to which Fyre
// movie. Certain matches are automatic; uncertain ones wait here. Only
// matched listings are imported (history is imported by the next USA sync).

type MapRow = {
  source_movie_id: number;
  source_title: string;
  movie_id: string | null;
  match_status: string;
  match_confidence: string | null;
  match_method: string | null;
  match_note: string | null;
  candidates: { movieId: string; slug: string; reason: string; dateGap: number | null }[];
  first_date: string | null;
  last_date: string | null;
  languages: string[] | null;
  backfill_status: string | null;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export default function UsaMatchingTool() {
  const [status, setStatus] = useState('needs_review');
  const [rows, setRows] = useState<MapRow[]>([]);
  const [movies, setMovies] = useState<{ movieId: string; slug: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [choice, setChoice] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/usa-map?status=${status}`, { headers: await authHeader() });
    const j = await res.json();
    if (!res.ok) return setError(j.error ?? `HTTP ${res.status}`);
    setRows(j.rows);
    setMovies(j.movies);
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  async function act(id: number, action: string, movieId?: string) {
    setBusy(id);
    const res = await fetch('/api/admin/usa-map', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ action, sourceMovieId: id, movieId }) });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) setError(j.error ?? 'Failed');
    else load();
  }

  const title = (movieId: string | null) => movies.find((m) => m.movieId === movieId)?.title ?? movieId ?? '—';
  const pill = (on: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {['needs_review', 'matched', 'unmatched', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" className={pill(status === s)} onClick={() => setStatus(s)}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <p className="text-xs text-textFaint mb-4">
        USA · Indian-language screenings. Automatic only when the title is the same and the first US date is within −10/+30 days of the movie’s Day 1; everything else waits here. Never guessed.
      </p>
      {error && <div className="text-red text-sm mb-3">{error}</div>}
      {rows.length === 0 && <div className="text-sm text-textFaint py-8 text-center">Nothing here.</div>}
      <div className="grid gap-3">
        {rows.map((r) => (
          <Card key={r.source_movie_id} className="p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-semibold text-text">{r.source_title}</div>
                <div className="text-[11px] text-textFaint">
                  USA id {r.source_movie_id} · {r.first_date ? formatDate(r.first_date) : '—'} → {r.last_date ? formatDate(r.last_date) : '—'} · {(r.languages ?? []).join(', ')}
                </div>
                <div className="text-[11px] text-textDim mt-1">
                  {r.match_status}
                  {r.match_status === 'matched' ? ` → ${title(r.movie_id)}` : ''} · {r.match_note}
                  {r.backfill_status ? ` · history ${r.backfill_status}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {r.match_status !== 'matched' && (
                  <>
                    <select
                      className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text max-w-[220px]"
                      value={choice[r.source_movie_id] ?? r.candidates[0]?.movieId ?? ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [r.source_movie_id]: e.target.value }))}
                    >
                      <option value="">Choose Fyre movie…</option>
                      {r.candidates.map((c) => (
                        <option key={`c-${c.movieId}`} value={c.movieId}>
                          ★ {title(c.movieId)} ({c.reason}
                          {c.dateGap != null ? `, ${c.dateGap >= 0 ? '+' : ''}${c.dateGap}d` : ''})
                        </option>
                      ))}
                      {movies.map((m) => (
                        <option key={m.movieId} value={m.movieId}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy === r.source_movie_id || !(choice[r.source_movie_id] ?? r.candidates[0]?.movieId)}
                      className="text-xs font-semibold bg-gold text-white rounded-full px-3 py-1.5 disabled:opacity-40"
                      onClick={() => act(r.source_movie_id, 'match', choice[r.source_movie_id] ?? r.candidates[0]?.movieId)}
                    >
                      Match
                    </button>
                  </>
                )}
                {r.match_status !== 'rejected' && (
                  <button type="button" disabled={busy === r.source_movie_id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(r.source_movie_id, 'reject')}>
                    Reject
                  </button>
                )}
                {r.match_status === 'matched' && (
                  <button type="button" disabled={busy === r.source_movie_id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(r.source_movie_id, 'unmatch')}>
                    Unmatch
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
