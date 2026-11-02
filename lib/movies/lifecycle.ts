import type { Lifecycle, LifecycleSignals, Movie } from './types';

// Movie lifecycle rules from the approved plan:
//   Upcoming -> Now Showing -> Ending check -> Run ended -> Archived
// Missing data never ends a run by itself, a failing source freezes every
// change for the day, and nothing is ever deleted: only `lifecycle` moves.

export const MIN_RUN_DAYS = 28;
export const QUIET_DAYS = 7;
export const CONFIRM_DAYS = 7;
export const ARCHIVE_AFTER_DAYS = 30;

const DAY = 86_400_000;

function daysBetween(a: string, b: Date): number {
  return Math.floor((b.getTime() - Date.parse(a.length === 10 ? `${a}T00:00:00+05:30` : a)) / DAY);
}

export function isTelugu(m: Pick<Movie, 'primaryLanguage'>): boolean {
  return m.primaryLanguage.trim().toLowerCase() === 'telugu';
}

// Shown on public pages at all: Telugu automatically, others only when an
// admin selected them; ended and archived runs leave the active lists.
export function isPubliclySelected(m: Pick<Movie, 'primaryLanguage' | 'showOnFyre'>): boolean {
  return isTelugu(m) || m.showOnFyre;
}

// The state the public pages use: an admin override takes effect at once,
// before the daily check records it.
export function effectiveLifecycle(m: Pick<Movie, 'lifecycle' | 'override'>): Lifecycle {
  if (m.override === 'ended' && m.lifecycle !== 'archived') return 'run_ended';
  if (m.override === 'running' && m.lifecycle !== 'archived') return 'now_showing';
  return m.lifecycle;
}

export function inActiveListings(m: Pick<Movie, 'primaryLanguage' | 'showOnFyre' | 'lifecycle'> & Partial<Pick<Movie, 'override'>>): boolean {
  const lc = effectiveLifecycle({ lifecycle: m.lifecycle, override: m.override ?? null });
  return isPubliclySelected(m) && (lc === 'now_showing' || lc === 'ending_check');
}

export function inUpcoming(m: Pick<Movie, 'primaryLanguage' | 'showOnFyre' | 'lifecycle'> & Partial<Pick<Movie, 'override'>>): boolean {
  return isPubliclySelected(m) && effectiveLifecycle({ lifecycle: m.lifecycle, override: m.override ?? null }) === 'upcoming';
}

export type LifecycleDecision = { next: Lifecycle; reason: string; changed: boolean };

export function evaluateLifecycle(m: Pick<Movie, 'lifecycle' | 'lifecycleSince' | 'releaseDate' | 'override'>, s: LifecycleSignals, now: Date): LifecycleDecision {
  const keep = (reason: string): LifecycleDecision => ({ next: m.lifecycle, reason, changed: false });
  const move = (next: Lifecycle, reason: string): LifecycleDecision => ({ next, reason, changed: next !== m.lifecycle });

  // Admin overrides win, and are logged by the caller.
  if (m.override === 'running' && m.lifecycle !== 'now_showing') return move('now_showing', 'Admin marked it running');
  if (m.override === 'running') return keep('Admin marked it running');
  if (m.override === 'ended' && (m.lifecycle === 'upcoming' || m.lifecycle === 'now_showing' || m.lifecycle === 'ending_check')) return move('run_ended', 'Admin marked the run ended');

  if (!s.sourcesHealthy) return keep('A source failed today, so no state changes');

  const activity = [s.lastShowDate, s.lastFigureDate].filter((d): d is string => !!d).sort().pop() ?? null;
  const quiet = activity != null && daysBetween(activity, now) >= QUIET_DAYS;
  const released = m.releaseDate != null && daysBetween(m.releaseDate, now) >= 0;

  switch (m.lifecycle) {
    case 'upcoming':
      if (released && activity != null && m.releaseDate != null && activity >= m.releaseDate) return move('now_showing', 'Released, and first shows or Day 1 figures seen');
      return keep(released ? 'Release date passed, waiting for first shows or figures' : 'Not released yet');
    case 'now_showing': {
      const runDays = m.releaseDate ? daysBetween(m.releaseDate, now) : 0;
      if (activity == null) return keep('No show or figure data yet; missing data never ends a run');
      if (runDays >= MIN_RUN_DAYS && quiet) return move('ending_check', `${runDays} days since release and no shows or figures for ${QUIET_DAYS} days`);
      return keep('Still running');
    }
    case 'ending_check': {
      if (activity != null && !quiet) return move('now_showing', 'Shows or figures resumed');
      const since = s.endingCheckSince ?? m.lifecycleSince;
      if (daysBetween(since, now) >= CONFIRM_DAYS) return move('run_ended', `No shows or figures for ${CONFIRM_DAYS} more days`);
      return keep('Waiting for admin confirmation or 7 more quiet days');
    }
    case 'run_ended':
      if (daysBetween(m.lifecycleSince, now) >= ARCHIVE_AFTER_DAYS) return move('archived', `${ARCHIVE_AFTER_DAYS} days after the run ended`);
      return keep('Run ended; archives after 30 days');
    case 'archived':
      return keep('Archived');
  }
}
