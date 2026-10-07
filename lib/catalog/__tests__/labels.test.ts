// "Lifetime" only for a movie's whole run; a tracked period says so.
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
(globalThis as any).React = React;
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import SummaryCards from '@/components/analytics/SummaryCards';
import { makeMetrics } from '@/lib/analytics/metrics';
import type { MovieAnalytics } from '@/lib/analytics/types';

const day = (date: string) => ({ date, day: null, label: date, final: true, detail: false, breakdowns: false, metrics: makeMetrics({ gross: 1e7, tickets: 5e4, seats: 1e5, shows: 300 }), sourceUpdated: null });
const base = { slug: 'x', title: 'X', territory: 'IN', currency: 'INR', days: [day('2026-07-10'), day('2026-10-06')], advance: [], latestDay: null, lifetime: { ...makeMetrics({ gross: 2e7, tickets: 1e5, seats: 2e5, shows: 600 }), days: 2, complete: false } };

describe('summary cards', () => {
  it('a partially imported long run: Tracked Gross (since <date>), never Lifetime', () => {
    const html = renderToStaticMarkup(React.createElement(SummaryCards, { m: { ...base, carriedOver: true, historyStart: '2026-07-10' } as unknown as MovieAnalytics }));
    expect(html).toContain('Tracked Gross (since 10 Jul 2026)');
    expect(html).not.toContain('Lifetime');
  });
  it('a whole run keeps Lifetime', () => {
    const html = renderToStaticMarkup(React.createElement(SummaryCards, { m: { ...base, carriedOver: false } as unknown as MovieAnalytics }));
    expect(html).toContain('Lifetime Gross');
  });
  it('the 1 Jan 2025 archive case reads as before, but as a tracked period', () => {
    const html = renderToStaticMarkup(React.createElement(SummaryCards, { m: { ...base, carriedOver: true, historyStart: null } as unknown as MovieAnalytics }));
    expect(html).toContain('Tracked Gross (since 1 Jan 2025)');
  });
});
