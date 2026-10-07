'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/bfilmy/adapter';

// Admin → USA matching / India matching. Which source listing belongs to
// which Fyre movie. Certain matches are automatic; uncertain ones wait
// here. For a legitimate movie Fyre does not have yet, "Create Fyre movie"
// adds it to Fyre's catalog (after a preview) and maps this listing to it.
// Only matched listings are imported (history by the next sync).

type Row = {
  id: string;
  idLabel: string;
  title: string;
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

type Preview = {
  sourceLabel: string;
  sourceMovieId: string;
  sourceTitle: string;
  title: string;
  year: number | null;
  languages: string[];
  firstSourceDate: string | null;
  lastSourceDate: string | null;
  slug: string;
  duplicates: {
    exact: { movieId: string; slug: string; title: string }[];
    similar: { movieId: string; slug: string; title: string }[];
  };
  blocker: string | null;
  needsConfirmation: boolean;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export default function ListingMatchingTool({ territory }: { territory: 'usa' | 'india' }) {
  const endpoint = territory === 'usa' ? '/api/admin/usa-map' : '/api/admin/india-map';
  const idField = territory === 'usa' ? 'sourceMovieId' : 'key';
  const [status, setStatus] = useState('needs_review');
  const [rows, setRows] = useState<Row[]>([]);
  const [movies, setMovies] = useState<{ movieId: string; slug: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ id: string; p: Preview; title: string; ack: boolean } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`${endpoint}?status=${status}`, { headers: await authHeader() });
    const j = await res.json();
    if (!res.ok) return setError(j.error ?? `HTTP ${res.status}`);
    setRows(j.rows);
    setMovies(j.movies);
  }, [status, endpoint]);
  useEffect(() => {
    load();
  }, [load]);

  async function post(id: string, payload: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify({ [idField]: territory === 'usa' ? Number(id) : id, ...payload }) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(j.error ?? 'Failed');
      return null;
    }
    return j;
  }

  async function act(id: string, action: string, movieId?: string) {
    if (await post(id, { action, movieId })) load();
  }

  async function openPreview(id: string, title?: string) {
    const j = await post(id, { action: 'preview_create', title });
    if (j) setPreview({ id, p: j.preview, title: j.preview.title, ack: false });
  }

  async function confirmCreate() {
    if (!preview) return;
    const j = await post(preview.id, { action: 'create', title: preview.title, acknowledgeSimilar: preview.ack });
    if (j) {
      setNotice(`Created Fyre movie “${j.result.title}” (/movie/${j.result.slug}). ${j.result.historyImport}. Metadata ${j.result.metadataStatus}${j.result.missing?.length ? ` — missing ${j.result.missing.join(', ')}` : ''}.`);
      setPreview(null);
      load();
    }
  }

  const title = (movieId: string | null) => movies.find((m) => m.movieId === movieId)?.title ?? movieId ?? '—';
  const pill = (on: boolean) => `text-xs font-semibold px-3 py-1.5 rounded-full border ${on ? 'bg-gold/[0.12] border-gold/40 text-gold' : 'border-border text-textDim'}`;
  const where = territory === 'usa' ? 'USA · Indian-language screenings' : 'India';
  const dateWord = territory === 'usa' ? 'first US date' : 'first India date';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {['needs_review', 'unmatched', 'matched', 'rejected', 'all'].map((s) => (
          <button key={s} type="button" className={pill(status === s)} onClick={() => setStatus(s)}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
      <p className="text-xs text-textFaint mb-4">
        {where}. Automatic only when the title is the same as a Fyre movie’s and the {dateWord} is within −10/+30 days of its Day 1; everything else waits here. Never guessed. A
        legitimate movie Fyre doesn’t have yet can be added with <b>Create Fyre movie</b>.
      </p>
      {notice && <div className="text-goldDim text-sm mb-3">{notice}</div>}
      {error && <div className="text-red text-sm mb-3">{error}</div>}
      {rows.length === 0 && <div className="text-sm text-textFaint py-8 text-center">Nothing here.</div>}
      <div className="grid gap-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-semibold text-text">{r.title}</div>
                <div className="text-[11px] text-textFaint">
                  {territory === 'usa' ? r.idLabel : 'India listing'} · {r.first_date ? formatDate(r.first_date) : '—'} → {r.last_date ? formatDate(r.last_date) : '—'} · {(r.languages ?? []).join(', ')}
                </div>
                <div className="text-[11px] text-textDim mt-1">
                  {r.match_status}
                  {r.match_status === 'matched' ? ` → ${title(r.movie_id)}` : ''} · {r.match_note}
                  {r.backfill_status ? ` · history ${r.backfill_status}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {r.match_status !== 'matched' && r.match_status !== 'rejected' && (
                  <>
                    <select
                      className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text max-w-[220px]"
                      value={choice[r.id] ?? r.candidates[0]?.movieId ?? ''}
                      onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
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
                      disabled={busy === r.id || !(choice[r.id] ?? r.candidates[0]?.movieId)}
                      className="text-xs font-semibold bg-gold text-white rounded-full px-3 py-1.5 disabled:opacity-40"
                      onClick={() => act(r.id, 'match', choice[r.id] ?? r.candidates[0]?.movieId)}
                    >
                      Match
                    </button>
                    <button type="button" disabled={busy === r.id} className="text-xs font-semibold border border-gold/50 text-gold rounded-full px-3 py-1.5 disabled:opacity-40" onClick={() => openPreview(r.id)}>
                      Create Fyre movie
                    </button>
                  </>
                )}
                {r.match_status !== 'rejected' && (
                  <button type="button" disabled={busy === r.id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(r.id, 'reject')}>
                    Reject
                  </button>
                )}
                {r.match_status === 'matched' && (
                  <button type="button" disabled={busy === r.id} className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => act(r.id, 'unmatch')}>
                    Unmatch
                  </button>
                )}
              </div>
            </div>

            {preview?.id === r.id && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mdtype-overline text-gold mb-2">Create Fyre movie — preview</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <label className="col-span-2 sm:col-span-3">
                    <span className="text-[11px] text-textFaint block">Title</span>
                    <input className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-text" value={preview.title} onChange={(e) => setPreview({ ...preview, title: e.target.value })} onBlur={() => preview.title !== preview.p.title && openPreview(r.id, preview.title)} />
                  </label>
                  <Field k="Year" v={preview.p.year ?? '—'} />
                  <Field k="Languages" v={preview.p.languages.join(', ') || '—'} />
                  <Field k="First source date" v={preview.p.firstSourceDate ? formatDate(preview.p.firstSourceDate) : '—'} />
                  <Field k="Source" v={preview.p.sourceLabel} />
                  <Field k="Source movie ID" v={territory === 'usa' ? preview.p.sourceMovieId : `${preview.p.sourceMovieId} (title key)`} />
                  <Field k="Page" v={`/movie/${preview.p.slug}`} />
                </div>
                {preview.p.duplicates.similar.length > 0 && (
                  <label className="flex items-start gap-2 mt-3 text-xs text-textDim">
                    <input type="checkbox" checked={preview.ack} onChange={(e) => setPreview({ ...preview, ack: e.target.checked })} className="mt-0.5" />
                    <span>Similar Fyre movie{preview.p.duplicates.similar.length > 1 ? 's' : ''}: {preview.p.duplicates.similar.map((s) => `“${s.title}”`).join(', ')}. This is a different movie.</span>
                  </label>
                )}
                {preview.p.blocker && !(preview.p.needsConfirmation && preview.ack) && <div className="text-red text-xs mt-3">{preview.p.blocker}</div>}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={busy === r.id || (!!preview.p.blocker && !(preview.p.needsConfirmation && preview.ack))}
                    className="text-xs font-semibold bg-gold text-white rounded-full px-4 py-1.5 disabled:opacity-40"
                    onClick={confirmCreate}
                  >
                    Create Fyre movie
                  </button>
                  <button type="button" className="text-xs border border-border rounded-full px-3 py-1.5 text-textDim" onClick={() => setPreview(null)}>
                    Cancel
                  </button>
                </div>
                <p className="text-[11px] text-textFaint mt-2">Poster and release date are looked up on create (exact title only); anything not found is left empty and the movie is marked for metadata review. Analytics work either way.</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <span className="text-[11px] text-textFaint block">{k}</span>
      <span className="text-text font-semibold">{v}</span>
    </div>
  );
}
