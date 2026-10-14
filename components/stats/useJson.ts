'use client';

import { useEffect, useState } from 'react';

// GET a JSON endpoint; refetches when the URL changes, aborts the previous
// request. `url = null` = nothing to load (lazy sections not in view yet).
export function useJson<T>(url: string | null): { data: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; url: string | null }>({ data: null, error: null, loading: !!url, url });
  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null, url }));
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.error) throw new Error(j?.error ?? `HTTP ${r.status}`);
        setState({ data: j as T, error: null, loading: false, url });
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setState({ data: null, error: e?.message ?? 'Could not load', loading: false, url });
      });
    return () => ctrl.abort();
  }, [url]);
  return { data: state.data, error: state.error, loading: state.loading };
}
