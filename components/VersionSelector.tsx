'use client';

import { useState } from 'react';
import { Card } from '@/components/ui';

export type VersionRow = {
  id: string;
  language: string;
  net_collection: string | null;
  verdict: string | null;
};

// Dropdown selector for a movie's per-language collection totals (see
// lib/syncMovieProfiles.ts / movie_versions table) -- same interaction
// pattern as the state/language/format dropdown in BreakdownTable.tsx,
// just a single axis (language) instead of type+date.
export default function VersionSelector({ versions }: { versions: VersionRow[] }) {
  const [active, setActive] = useState(versions[0]?.language ?? '');
  const current = versions.find((v) => v.language === active) ?? versions[0];

  if (!current) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={current.language}
          onChange={(e) => setActive(e.target.value)}
          className="bg-bg border-none rounded-lg px-3.5 py-2 text-xs font-semibold text-textDim capitalize"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.language}>
              {v.language}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 bg-tintBlue">
          <div className="text-gold/70 text-[10px] uppercase tracking-wide mb-1">Net Collection</div>
          <div className="hdisplay text-xl text-gold">{current.net_collection ?? '—'}</div>
        </Card>
        {current.verdict && (
          <Card className="p-4">
            <div className="text-textFaint text-[10px] uppercase tracking-wide mb-1">Verdict</div>
            <div className="hdisplay text-xl text-text">{current.verdict}</div>
          </Card>
        )}
      </div>
    </div>
  );
}
