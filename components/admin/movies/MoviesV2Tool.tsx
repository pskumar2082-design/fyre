'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Movie } from '@/lib/movies/types';
import { adminFetch } from '@/components/admin/newsroom/adminFetch';

type Item = Movie & { publiclySelected: boolean; inActiveListings: boolean; lastFigureDate: string | null; proposed: { next: string; reason: string; changed: boolean } };

const LC: Record<string, string> = { upcoming: 'Upcoming', now_showing: 'Now Showing', ending_check: 'Ending check', run_ended: 'Run ended', archived: 'Archived' };

// Admin view of the new movie lifecycle: who is public, what the daily
// check would do today (dry run), and the manual overrides.
export default function MoviesV2Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [store, setStore] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const r = await adminFetch('/api/admin/movies-v2');
    setItems(r.items);
    setStore(r.store);
  }, []);
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, [load]);

  async function change(id: string, patch: Record<string, unknown>) {
    try {
      await adminFetch('/api/admin/movies-v2', { method: 'POST', body: JSON.stringify({ id, ...patch }) });
      setMessage('Saved.');
      await load();
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-textDim">Telugu movies are public automatically; tick &ldquo;Show on Fyre&rdquo; for others. Ended runs leave the active lists but keep their pages.</p>
        {store === 'demo' && <span className="font-mono text-[11px] text-amber">Test data: selections are kept on this computer</span>}
      </div>
      {message && <p className="text-sm text-goldDim mb-3">{message}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-textFaint text-left">
              <th className="font-normal px-3 py-2">Movie</th>
              <th className="font-normal px-3 py-2">State</th>
              <th className="font-normal px-3 py-2">Daily check (dry run)</th>
              <th className="font-normal px-3 py-2">Show on Fyre</th>
              <th className="font-normal px-3 py-2">Featured</th>
              <th className="font-normal px-3 py-2">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface2">
            {items.map((m) => {
              const telugu = m.primaryLanguage.toLowerCase() === 'telugu';
              return (
                <tr key={m.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <span className="block font-semibold text-text">{m.title}</span>
                    <span className="block font-mono text-[11px] text-textFaint">
                      {m.primaryLanguage} · released {m.releaseDate ?? 'TBA'} · last figure {m.lastFigureDate ?? 'none'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-text">{LC[m.lifecycle]}</span>
                    <span className={`block font-mono text-[11px] ${m.inActiveListings ? 'text-goldDim' : 'text-textFaint'}`}>{m.inActiveListings ? 'in active lists' : 'not in active lists'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={m.proposed.changed ? 'text-amber font-semibold' : 'text-textDim'}>{m.proposed.changed ? `Would move to ${LC[m.proposed.next]}` : 'No change'}</span>
                    <span className="block text-textFaint">{m.proposed.reason}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {telugu ? (
                      <span className="text-xs text-textFaint">Automatic (Telugu)</span>
                    ) : (
                      <input type="checkbox" aria-label={`Show ${m.title} on Fyre`} checked={m.showOnFyre} onChange={(e) => change(m.id, { showOnFyre: e.target.checked })} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" aria-label={`Feature ${m.title}`} checked={m.featured} onChange={(e) => change(m.id, { featured: e.target.checked })} />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      aria-label={`Override for ${m.title}`}
                      value={m.override ?? ''}
                      onChange={(e) => change(m.id, { override: e.target.value === '' ? null : e.target.value })}
                      className="bg-surface border border-border rounded-lg px-2 py-1 text-xs text-text"
                    >
                      <option value="">Automatic</option>
                      <option value="running">Force running</option>
                      <option value="ended">Force ended</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-textFaint">The daily check never deletes anything: it only changes a movie&apos;s state. It makes no changes on a day when any source failed.</p>
    </div>
  );
}
