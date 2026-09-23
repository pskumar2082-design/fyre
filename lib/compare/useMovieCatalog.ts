'use client';

import { useEffect, useState } from 'react';
import type { TTListedMovie } from '../tracktollywood/types';

// Shared client-side movie catalog for every searchable selector the
// comparison feature needs (the /compare page, the home page's compact
// section, and the admin Social Poster tool's comparison mode). No new
// API route: app/api/tracktollywood/live and app/api/tracktollywood/
// completed already return this exact public JSON (the same data
// /now-showing, /upcoming and /box-office read server-side), so this
// hook just fetches both once, merges, and de-dupes by slug -- live
// TrackTollywood data, not a fabricated or cached-elsewhere catalog.
export type MovieCatalogState = {
  movies: TTListedMovie[];
  loading: boolean;
  error: string | null;
};

export function useMovieCatalog(): MovieCatalogState {
  const [state, setState] = useState<MovieCatalogState>({ movies: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [liveRes, completedRes] = await Promise.all([
          fetch('/api/tracktollywood/live'),
          fetch('/api/tracktollywood/completed')
        ]);
        const [liveJson, completedJson] = await Promise.all([liveRes.json(), completedRes.json()]);
        if (cancelled) return;

        if (!liveRes.ok && !completedRes.ok) {
          setState({ movies: [], loading: false, error: 'Could not reach our data source right now.' });
          return;
        }

        const seen = new Set<string>();
        const merged: TTListedMovie[] = [];
        for (const m of [...(liveJson.movies ?? []), ...(completedJson.movies ?? [])] as TTListedMovie[]) {
          if (seen.has(m.slug)) continue;
          seen.add(m.slug);
          merged.push(m);
        }
        setState({ movies: merged, loading: false, error: null });
      } catch (err: any) {
        if (!cancelled) setState({ movies: [], loading: false, error: err?.message ?? 'Failed to load movies.' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// Case-insensitive substring match on title -- the same simple matching
// /search already uses (app/search/page.tsx), not a fuzzy-search
// dependency this project doesn't have.
export function filterMovieCatalog(movies: TTListedMovie[], query: string): TTListedMovie[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return movies;
  return movies.filter((m) => m.title.toLowerCase().includes(needle));
}
