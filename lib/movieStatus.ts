// A movie's theatrical run is treated as over ~6 weeks after release --
// long enough to cover a normal run (most movies thin out well before
// this), short enough that the Now Showing carousel and page don't fill up
// with movies nobody can actually go watch anymore. After that point a
// movie drops out of "Now Showing" but stays fully visible on the Box
// Office archive (see app/box-office/page.tsx) -- nothing is deleted or
// hidden, just no longer presented as "currently in theaters".
//
// That fixed window is only the default, though -- a genuine long-running
// hit shouldn't vanish from Now Showing just because a clock ran out while
// it's still actually playing. So past 6 weeks, a movie stays in Now
// Showing if Sacnilk is still publishing *new* daily numbers for it
// (last_day_date, synced onto now_showing by lib/syncBoxOffice.ts) within
// the last couple of weeks -- once that stops advancing, the run really
// has ended and it settles into being archive-only.
//
// No release_date means we can't tell either way, so it defaults to
// still-active rather than silently disappearing from Now Showing.
export const THEATRICAL_RUN_DAYS = 42;
export const RECENT_DATA_DAYS = 14;

function daysSince(dateStr: string): number | null {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 86400000;
}

export function isInTheaters(movie: { release_date?: string | null; last_day_date?: string | null }): boolean {
  const releaseAge = movie.release_date ? daysSince(movie.release_date) : null;

  // A future release_date makes daysSince NEGATIVE (Date.now() - t < 0)
  // -- this movie hasn't opened yet, however much MovieMint advance data
  // it already has (see createNowShowingFromMovieMint, which creates its
  // now_showing row the moment MovieMint's /advance lists it, days or
  // weeks before release). It belongs on /upcoming, not Now Showing.
  // Bug fixed 2026-09-21: previously `releaseAge <= THEATRICAL_RUN_DAYS`
  // was also true for any negative releaseAge, so every not-yet-released
  // movie MovieMint had advance data for showed up in Now Showing as if
  // it were already running.
  if (releaseAge != null && releaseAge < 0) return false;

  if (releaseAge == null || releaseAge <= THEATRICAL_RUN_DAYS) return true;

  const dataAge = movie.last_day_date ? daysSince(movie.last_day_date) : null;
  if (dataAge != null && dataAge <= RECENT_DATA_DAYS) return true;

  return false;
}

// Movies can share a title (a dubbed re-release, a same-named remake, or
// just two different films) -- appending the release year wherever a
// now_showing title is displayed keeps those apart at a glance without
// needing to open the movie.
export function titleWithYear(title: string, releaseDate: string | null | undefined): string {
  if (!releaseDate) return title;
  const year = new Date(releaseDate).getFullYear();
  return Number.isNaN(year) ? title : `${title} (${year})`;
}

// Best-effort ₹ Cr figure for ranking movies on the Box Office archive --
// prefers the richer profile-sourced worldwide total, then the day-wise
// sync's own lifetime figure, then the plain admin-entered amount, so a
// movie ranks sensibly regardless of which sync has reached it so far.
export function collectionCr(movie: {
  total_worldwide?: string | null;
  lifetime_gross?: string | null;
  amt?: string | null;
}): number {
  const text = movie.total_worldwide || movie.lifetime_gross || movie.amt || '';
  const m = String(text).replace(/,/g, '').match(/([\d.]+)\s*Cr/i);
  return m ? Number(m[1]) : 0;
}
