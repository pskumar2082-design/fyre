import { describe, it, expect } from 'vitest';
import { isInTheaters, THEATRICAL_RUN_DAYS, RECENT_DATA_DAYS } from '@/lib/movieStatus';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

describe('isInTheaters', () => {
  it('is false for a movie whose release date is still in the future', () => {
    // Bug fixed 2026-09-21: a future release_date used to compute a
    // NEGATIVE daysSince, which was always <= THEATRICAL_RUN_DAYS -- so
    // every not-yet-released movie (e.g. one MovieMint already has
    // /advance data for) showed up in Now Showing as if it were running.
    expect(isInTheaters({ release_date: daysFromNow(3) })).toBe(false);
    expect(isInTheaters({ release_date: daysFromNow(30) })).toBe(false);
  });

  it('is true for a movie released today', () => {
    expect(isInTheaters({ release_date: daysAgo(0) })).toBe(true);
  });

  it('is true within the default theatrical run window', () => {
    // THEATRICAL_RUN_DAYS - 1, not the exact boundary -- daysAgo() floors
    // to midnight UTC, so the exact boundary is flaky depending on what
    // time of day the test runs (a few hours can tip daysSince just past
    // THEATRICAL_RUN_DAYS).
    expect(isInTheaters({ release_date: daysAgo(THEATRICAL_RUN_DAYS - 1) })).toBe(true);
  });

  it('is false past the window with no recent data', () => {
    expect(isInTheaters({ release_date: daysAgo(THEATRICAL_RUN_DAYS + 2) })).toBe(false);
  });

  it('stays true past the window if the source is still publishing recent daily numbers', () => {
    expect(
      isInTheaters({
        release_date: daysAgo(THEATRICAL_RUN_DAYS + 10),
        last_day_date: daysAgo(RECENT_DATA_DAYS - 1)
      })
    ).toBe(true);
  });

  it('is false past the window once recent data stops advancing', () => {
    expect(
      isInTheaters({
        release_date: daysAgo(THEATRICAL_RUN_DAYS + 10),
        last_day_date: daysAgo(RECENT_DATA_DAYS + 5)
      })
    ).toBe(false);
  });

  it('defaults to still-active when there is no release_date at all', () => {
    expect(isInTheaters({})).toBe(true);
  });
});
