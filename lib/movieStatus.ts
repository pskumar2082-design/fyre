// A movie's theatrical run is treated as over ~6 weeks after release --
// long enough to cover a normal run (most movies thin out well before
// this), short enough that the Now Showing carousel and page don't fill up
// with movies nobody can actually go watch anymore. After that point a
// movie drops out of "Now Showing" but stays fully visible on the Box
// Office archive (see app/box-office/page.tsx) -- nothing is deleted or
// hidden, just no longer presented as "currently in theaters".
//
// No release_date means we can't tell either way, so it defaults to
// still-active rather than silently disappearing from Now Showing.
export const THEATRICAL_RUN_DAYS = 42;

export function isInTheaters(releaseDate: string | null | undefined): boolean {
  if (!releaseDate) return true;
  const released = new Date(releaseDate).getTime();
  if (Number.isNaN(released)) return true;
  const ageDays = (Date.now() - released) / 86400000;
  return ageDays <= THEATRICAL_RUN_DAYS;
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
