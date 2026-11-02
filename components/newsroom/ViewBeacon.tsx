'use client';

import { useEffect } from 'react';

// Counts one anonymous page view for Trending Stories. No cookies, no
// personal data: just the article id, once per browser tab per article.
export default function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const key = `fyre-viewed-${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* private mode: still count */
    }
    fetch('/api/newsroom/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
