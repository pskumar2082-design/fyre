import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { StarRating } from '@/components/StarRating';

export type ReviewCardData = {
  id: string;
  title: string;
  excerpt?: string | null;
  rating?: string | number | null;
  image_url?: string | null;
};

// Shared review-card presentation -- used by both the homepage's "Fresh
// reviews" teaser (app/page.tsx) and the full listing (app/reviews/page.tsx)
// so the two never quietly drift apart, and a fix like the star-rating bug
// only has to happen in one place.
//
// Compact "image-overlay" layout: the review's own uploaded image fills
// the entire card (object-cover, no distortion) instead of sitting in a
// separate panel above a second text block underneath -- rating, stars,
// title, headline and the Read Review CTA are all laid directly over the
// image's lower half. A bottom-anchored gradient (an inline
// linear-gradient, not Tailwind's from-*/via-*/to-* utilities, so the
// stop positions are exact) stays transparent through the upper ~45% of
// the image and only goes fully opaque near the very bottom, so the
// photo itself stays visible per the design brief -- never a flat dark
// wash over the whole card -- while the text underneath still gets
// guaranteed contrast regardless of whether the uploaded photo is bright
// or dark.
//
// No movie-poster fallback: the `reviews` table (supabase/schema.sql) has
// no column linking a review to a specific tracked movie, so there's no
// reliable poster to substitute without guessing by title match. A
// missing image_url instead falls back to the same muted "no image"
// placeholder pattern used for a poster-less MovieCard
// (components/MovieCard.tsx) -- never a fabricated picture -- with the
// same text overlay laid on top of that flat surface.
export default function ReviewCard({ review, className = '' }: { review: ReviewCardData; className?: string }) {
  const raw = review.rating;
  const parsed = raw == null || raw === '' ? NaN : typeof raw === 'string' ? parseFloat(raw) : raw;
  const hasRating = Number.isFinite(parsed);
  const badgeRating = hasRating ? (Number.isInteger(parsed) ? String(parsed) : (parsed as number).toFixed(1)) : null;

  return (
    <Link
      href={`/reviews/${review.id}`}
      aria-label={`Read review: ${review.title}${hasRating ? `, rated ${badgeRating} out of 5` : ', not yet rated'}`}
      className={`group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${className}`}
    >
      <Card className="relative w-full aspect-[16/10] overflow-hidden p-0 transition group-hover:border-gold/30">
        {review.image_url ? (
          <Image
            src={review.image_url}
            alt=""
            fill
            className="object-cover object-center transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-textFaint text-[11px]">No image</div>
        )}

        {/* Bottom-anchored readability gradient. Transparent until ~45%
            up from the bottom, fully opaque only right at the edge --
            guarantees the overlay text reads over any uploaded photo
            without hiding the image itself. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(10,11,15,0.92) 0%, rgba(10,11,15,0.78) 20%, rgba(10,11,15,0.32) 45%, rgba(10,11,15,0) 65%)'
          }}
        />

        {hasRating && (
          <span className="absolute top-2.5 right-2.5 bg-gold text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-card">
            {badgeRating} / 5
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3.5 sm:p-4">
          <StarRating rating={hasRating ? parsed : null} size="text-xs" className="mb-1.5" />
          <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-2 mb-1">{review.title}</h3>
          {review.excerpt && (
            <p className="text-xs sm:text-sm text-white/80 leading-snug line-clamp-2 mb-1.5">{review.excerpt}</p>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold group-hover:text-goldBright transition">
            Read review
            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </Card>
    </Link>
  );
}
