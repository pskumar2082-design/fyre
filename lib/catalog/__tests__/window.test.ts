// 90-day active catalog: discovery/history look back at most 90 days of
// BFILMY activity; ongoing movies keep being tracked with no maximum run;
// partial history is a "tracked period", never "lifetime".
import { describe, expect, it, vi } from 'vitest';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { activityStatus, ACTIVE_WINDOW_DAYS, historyComplete, historyRange, inActiveWindow, windowStart } from '../core';
import { bootstrapPlan, classifyListings } from '../bootstrap';
import { NOTE } from '../core';
import { summaryPlan } from '@/lib/moviemint/backfill';
import { trackedKeys } from '@/lib/tracking';
import { resolveSelection, selectionLabel } from '@/lib/analytics/load';
import { makeMetrics } from '@/lib/analytics/metrics';
import type { MovieAnalytics } from '@/lib/analytics/types';

const TODAY = '2026-10-07';
const ago = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

// Minimal fake of the Supabase query builder for trackedKeys().
function fakeClient(tracked: { bf_slug: string; tracking_status: string; match_status: string; release_date: string }[], keys: { key: string; slug: string }[]) {
  const q = (rows: any[]) => {
    let out = rows;
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => ((out = out.filter((r) => r[c] === v)), b),
      not: (c: string) => ((out = out.filter((r) => r[c] != null)), b),
      in: (c: string, vs: any[]) => ((out = out.filter((r) => vs.includes(r[c]))), b),
      then: (res: any) => res({ data: out, error: null })
    };
    return b;
  };
  return { from: (t: string) => (t === 'fyre_tracked_movie' ? q(tracked) : q(keys)) } as any;
}

describe('the window', () => {
  it('is today and the 89 days before it', () => {
    expect(ACTIVE_WINDOW_DAYS).toBe(90);
    expect(windowStart(TODAY)).toBe(ago(89));
  });
});

describe('long-running movie: released 120 days ago, BFILMY shows today', () => {
  const movie = { bf_slug: 'long-runner', tracking_status: 'active', match_status: 'matched', release_date: ago(120) };

  it('stays ACTIVE (BFILMY activity decides, not its age or MovieMint)', () => {
    expect(activityStatus(TODAY, TODAY)).toBe('ACTIVE');
    expect(inActiveWindow(TODAY, TODAY)).toBe(true);
  });

  it("is still imported: today's file rows for its title are in the import set (no maximum run)", async () => {
    const t = await trackedKeys(fakeClient([movie], [{ key: 'longrunner', slug: 'long-runner' }]));
    expect(t.slugs.has('long-runner')).toBe(true);
    expect(t.keys.has('longrunner')).toBe(true);
  });

  it('if discovered now: only the last 90 days are imported and its totals are a tracked period', () => {
    const r = historyRange(TODAY, movie.release_date);
    expect(r).toEqual({ floor: ago(89), start: ago(89), clamped: true });
    // shows on the first window day -> it was running before: not complete
    expect(historyComplete(ago(89), r)).toBe(false);
  });

  it('is never labelled lifetime when only part of its run is stored', () => {
    const m = { slug: 'long-runner', title: 'Long Runner', carriedOver: true, historyStart: ago(89), days: [{ date: TODAY, day: null, label: TODAY, final: false, detail: false, breakdowns: false, metrics: makeMetrics({ gross: 1, tickets: 1, seats: 2, shows: 1 }), sourceUpdated: null }], advance: [] } as unknown as MovieAnalytics;
    expect(selectionLabel({ basis: 'lifetime' }, [m])).toBe('Total tracked');
    expect(resolveSelection(m, { basis: 'lifetime' }).reason).toMatch(/^Tracked since .* — not full lifetime$/);
    expect(resolveSelection(m, { basis: 'day', day: 1 }).points).toEqual([]);
    expect(selectionLabel({ basis: 'lifetime' }, [{ carriedOver: false }])).toBe('Lifetime');
  });
});

describe('old movie: released 150 days ago, last BFILMY activity 100 days ago, not in Fyre', () => {
  it('is outside the window and its date files are never read by the bootstrap', () => {
    expect(inActiveWindow(ago(100), TODAY)).toBe(false);
    expect(activityStatus(ago(100), TODAY)).toBe('INACTIVE');
    const plan = bootstrapPlan(windowStart(TODAY), ago(1), ['boxoffice', 'advance']);
    expect(plan.some((p) => p.date <= ago(90))).toBe(false);
    expect(plan.some((p) => p.date === ago(100))).toBe(false);
  });
});

describe('new movie history: at most what is inside the window', () => {
  it('released 20 days ago -> its whole run (from 3 days before release, for advance)', () => {
    const r = historyRange(TODAY, ago(20));
    expect(r).toEqual({ floor: ago(89), start: ago(23), clamped: false });
    expect(historyComplete(ago(20), r)).toBe(true);
  });
  it('released 80 days ago -> its whole run', () => {
    const r = historyRange(TODAY, ago(80));
    expect(r.start).toBe(ago(83));
    expect(r.clamped).toBe(false);
    expect(historyComplete(ago(80), r)).toBe(true);
  });
  it('released 140 days ago and still playing -> the most recent 90 days only', () => {
    const r = historyRange(TODAY, ago(140));
    expect(r.start).toBe(ago(89));
    expect(historyComplete(ago(89), r)).toBe(false);
  });
  it('unknown release date -> the window; complete only if its shows start after the window start', () => {
    const r = historyRange(TODAY, null);
    expect(r).toEqual({ floor: ago(89), start: ago(89), clamped: true });
    expect(historyComplete(ago(40), r)).toBe(true);
    expect(historyComplete(ago(89), r)).toBe(false);
    expect(historyComplete(null, r)).toBe(true); // advance only so far
  });
  it('an existing movie with older stored history stays complete', () => {
    expect(historyComplete('2025-06-01', historyRange(TODAY, null))).toBe(true);
  });
});

describe('source efficiency', () => {
  it('bootstrap reads one file per date and feed, however many movies are in them', () => {
    const plan = bootstrapPlan(windowStart(TODAY), ago(1), ['boxoffice', 'advance']);
    expect(plan.length).toBe(89 * 2);
    expect(new Set(plan.map((p) => `${p.kind}:${p.date}`)).size).toBe(plan.length);
  });
  it('history import for many movies shares each date file', () => {
    const jobs = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, next: ago(89), until: null }));
    const plan = summaryPlan(jobs, TODAY);
    expect(plan.size).toBe(90); // 90 dates, not 90 x 40
    expect(plan.get(ago(50))?.length).toBe(40);
  });
});

describe('bootstrap statistics', () => {
  it('classifies every listing in the window; nothing is silently dropped', () => {
    const india = [
      { key: 'theparadise', movie_id: 'the-paradise', match_status: 'matched', match_note: 'Filed under a Fyre movie' },
      { key: 'newfilm', movie_id: 'fyre-1', match_status: 'matched', match_note: 'Discovered' },
      { key: 'doraemona', movie_id: null, match_status: 'needs_review', match_note: `${NOTE.related} "Doraemon the Movie" — check` },
      { key: 'odd', movie_id: null, match_status: 'needs_review', match_note: 'Same title but release date unknown' },
      { key: 'soon', movie_id: null, match_status: 'unmatched', match_note: NOTE.advanceOnly },
      { key: 'ride', movie_id: null, match_status: 'unmatched', match_note: `${NOTE.filtered}: not a movie title` },
      { key: 'old', movie_id: null, match_status: 'rejected', match_note: 'Rejected by admin' },
      { key: 'late', movie_id: null, match_status: 'unmatched', match_note: NOTE.deferred }
    ];
    const usa = [
      { source_movie_id: 1, movie_id: 'fyre-1', match_status: 'matched', match_note: 'x' },
      { source_movie_id: 2, movie_id: 'fyre-2', match_status: 'matched', match_note: 'x' },
      { source_movie_id: 3, movie_id: null, match_status: 'unmatched', match_note: NOTE.noShows }
    ];
    const st = classifyListings(india, usa, new Set(['fyre-1', 'fyre-2', 'fyre-3']));
    expect(st.uniqueListings).toEqual({ india: 8, usa: 3, total: 11 });
    expect(st).toMatchObject({ existingFyreMatches: 1, newFyreMovies: 3, newMovieListings: 3, adminReview: 2, duplicateConflict: 2, advanceOnly: 1, filteredJunk: 1, previouslyRejected: 1, deferredByCap: 1, waitingNoShows: 1, otherUnmatched: 0 });
    expect(st.newMoviesByTerritory).toEqual({ indiaOnly: 1, usaOnly: 1, indiaAndUsa: 1 });
    const counted = st.existingFyreMatches + st.newMovieListings + st.adminReview + st.advanceOnly + st.filteredJunk + st.previouslyRejected + st.deferredByCap + st.waitingNoShows + st.otherUnmatched;
    expect(counted).toBe(st.uniqueListings.total);
  });
});
