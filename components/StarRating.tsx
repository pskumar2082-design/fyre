// Shared star-rating display. Renders exactly `rating` filled stars out of
// `max` (default 5) -- including partial fill for a fractional rating like
// 3.5 -- rather than always drawing a full row of filled stars. Previously
// every review card hand-wrote a literal "★★★★★" string next to the real
// numeric badge (app/page.tsx, app/reviews/page.tsx, components/
// NowShowing.tsx), so the stars never actually reflected the stored
// rating -- a 2/5 review still showed five filled stars. This component is
// the single place that turns a rating value into stars, so every call
// site agrees with its own numeric badge by construction.
//
// `rating` accepts the raw Supabase value as-is: the `reviews.rating`
// column is `text` (see supabase/schema.sql), so callers usually hand this
// a string like "4". A missing/blank/non-numeric value renders every star
// empty and reports "Not yet rated" to assistive tech, rather than
// guessing a rating from other fields.
function StarGlyph({ fill }: { fill: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <span className="relative inline-block w-[1em] leading-none" aria-hidden="true">
      {/* Empty base star -- visibly muted, matches the site's borderStrong
          translucent-white tier rather than a full-strength text color. */}
      <span className="text-white/[0.18]">★</span>
      {/* Filled overlay, clipped to the fraction of this star that's
          "on" (100% for a full star, 0-100% for the one partial star in a
          fractional rating, absent entirely for an empty star). */}
      {pct > 0 && (
        <span className="absolute inset-0 overflow-hidden text-star" style={{ width: `${pct}%` }}>
          ★
        </span>
      )}
    </span>
  );
}

export function StarRating({
  rating,
  max = 5,
  size = 'text-sm',
  className = ''
}: {
  rating: number | string | null | undefined;
  max?: number;
  size?: string;
  className?: string;
}) {
  const parsed = rating == null || rating === '' ? NaN : typeof rating === 'string' ? parseFloat(rating) : rating;
  const hasRating = Number.isFinite(parsed);
  const clamped = hasRating ? Math.min(max, Math.max(0, parsed as number)) : 0;
  const label = hasRating
    ? `Rated ${Number.isInteger(clamped) ? clamped : clamped.toFixed(1)} out of ${max} stars`
    : 'Not yet rated';

  return (
    <span className={`inline-flex items-center gap-0.5 ${size} ${className}`} role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <StarGlyph key={i} fill={hasRating ? clamped - i : 0} />
      ))}
    </span>
  );
}
