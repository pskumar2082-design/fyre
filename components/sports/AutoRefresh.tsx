'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Re-renders the page from Fyre's own cache on a timer while it is open.
// It never calls a cricket provider: the server reads Fyre's tables.
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
