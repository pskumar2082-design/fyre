import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMovieDetails, parseReleaseDate } from '@/lib/bfilmy/source';
import type { TTMovieMetaItem } from '@/lib/boxoffice/types';
import { loadMovieAnalytics } from '@/lib/analytics/load';
import { formatGross } from '@/lib/analytics/format';
import SummaryCards from '@/components/analytics/SummaryCards';
import MovieBreakdownExplorer from '@/components/analytics/MovieBreakdownExplorer';
import { STATE_BADGE } from '@/lib/boxoffice/stateStyle';
import { Card } from '@/components/ui';
import { SITE_URL } from '@/lib/siteConfig';

export const dynamic = 'force-dynamic';

// Every scraped field is a generic label/value pair (see TTMovieMetaItem),
// not fixed Director/Cast/Genre properties -- this looks one up by label
// so both the metadata below and the JSON-LD further down can pull
// "whichever item has this label" without caring where it landed in the
// array.
function metaValue(meta: TTMovieMetaItem[], pattern: RegExp): string | null {
  return meta.find((m) => pattern.test(m.label))?.value ?? null;
}

// Per-movie <title>/description/Open Graph card -- this is the single
// biggest SEO gap this site had: every one of these pages was sharing
// the site's generic homepage title before, so Google (and a pasted
// link) had no way to tell one movie's page from another's.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  let details;
  let analytics;
  try {
    [details, analytics] = await Promise.all([getMovieDetails(params.slug, 'summary'), loadMovieAnalytics(params.slug)]);
  } catch {
    details = null;
  }
  if (!details || !analytics) return {};

  const gross = analytics.days.length ? formatGross(analytics.lifetime.gross) : null;
  const title = `${details.title} Box Office Collection${gross ? ` — ${gross}` : ''}`;
  const description = [
    `${details.title} live box office collection`,
    gross ? `at ${gross}` : null,
    '— day-wise breakdown, cast, director, genre and release date, updated daily.'
  ]
    .filter(Boolean)
    .join(' ');
  const url = `${SITE_URL}/movie/${params.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: details.poster ? [{ url: details.poster }] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: details.poster ? [details.poster] : undefined
    }
  };
}


export default async function MoviePage({ params }: { params: { slug: string } }) {
  let details;
  let analytics;
  try {
    [details, analytics] = await Promise.all([getMovieDetails(params.slug, 'summary'), loadMovieAnalytics(params.slug)]);
  } catch {
    details = null;
  }
  if (!details || !analytics) notFound();

  // Headline figure from Fyre Analytics -- the same numbers as the cards,
  // the breakdowns, Movie Comparison and the poster.
  const lt = analytics.lifetime;
  const latestAdvance = analytics.advance[analytics.advance.length - 1];
  const badgeText =
    analytics.state === 'live'
      ? `Live Tracking${analytics.latestDay && analytics.latestDay.day != null ? ` · ${analytics.latestDay.label}` : ''}`
      : analytics.state === 'advance'
        ? 'Advance Booking'
        : analytics.state === 'final'
          ? 'Final'
          : details.badgeText || details.state;
  const headlineGross = analytics.days.length ? formatGross(lt.gross) : latestAdvance ? formatGross(latestAdvance.metrics.gross) : details.headlineGross;
  const headlineLabel = analytics.days.length
    ? analytics.carriedOver
      ? 'Tracked gross since 1 Jan 2025'
      : `Tracked Gross · ${analytics.state === 'live' ? `${analytics.latestDay?.label ?? ''} running` : `Final · ${lt.days} days with shows`}`
    : latestAdvance
      ? `Advance Gross · ${latestAdvance.label}`
      : details.headlineLabel;
  const backHref =
    details.state === 'final' ? '/box-office' : details.state === 'live' ? '/now-showing' : '/upcoming';
  const backLabel =
    details.state === 'final' ? 'Box office archive' : details.state === 'live' ? 'Now showing' : 'Upcoming releases';

  // Schema.org structured data -- what actually earns a movie a rich
  // result (poster, cast, release date) in Google rather than a plain
  // blue link, the thing TrackTollywood/MovieMint already have and this
  // site didn't. Built from the same generic meta list rendered above,
  // so it's automatically complete for whatever TrackTollywood actually
  // published for this movie -- no field is required.
  const director = metaValue(details.meta, /director/i);
  const cast = metaValue(details.meta, /cast/i);
  const genre = metaValue(details.meta, /genre/i);
  const releaseDate = metaValue(details.meta, /^released$|releasing/i);
  // Schema.org wants ISO 8601 ("2026-09-11"), not TrackTollywood's own
  // display format ("11 Sep 2026") -- parseReleaseDate already parses
  // that exact format for the release-countdown logic elsewhere, so
  // it's reused here rather than writing a second date parser.
  const releaseDateIso = parseReleaseDate(releaseDate)?.toISOString().slice(0, 10);
  const movieJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: details.title,
    url: `${SITE_URL}/movie/${params.slug}`,
    image: details.poster || undefined,
    genre: genre ? genre.split(',').map((g) => g.trim()) : undefined,
    director: director ? director.split(',').map((d) => ({ '@type': 'Person', name: d.trim() })) : undefined,
    actor: cast ? cast.split(',').map((a) => ({ '@type': 'Person', name: a.trim() })) : undefined,
    datePublished: releaseDateIso || undefined
  };

  return (
    <div className="px-5 md:px-10 py-8 max-w-5xl mx-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(movieJsonLd) }} />
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-gold text-sm font-semibold hover:text-goldBright transition mb-5">
        <ArrowLeft size={15} /> {backLabel}
      </Link>

      {/* HERO — flat white card (matching the rest of the light theme,
          no dark blurred-poster backdrop): sharp poster thumbnail + state
          badge + headline gross. The badge itself still uses the on-photo
          treatment since it sits right against the poster art. */}
      <Card className="relative overflow-hidden mb-6">
        <div className="relative flex gap-5 p-5 sm:p-7 flex-wrap sm:flex-nowrap">
          <div className="relative w-[104px] sm:w-[130px] aspect-[2/3] flex-none rounded-xl overflow-hidden bg-surface2 border border-border shadow-card">
            {details.poster ? (
              <Image src={details.poster} alt={details.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-textFaint text-xs">No poster</div>
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            {analytics.state !== 'unknown' && (
              <span className={`inline-flex items-center gap-1.5 w-fit text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg mb-2.5 ${STATE_BADGE[analytics.state]}`}>
                {analytics.state === 'live' && (
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-white/60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
                {badgeText}
              </span>
            )}
            <h1 className="hdisplay text-2xl sm:text-3xl text-text">{details.title}</h1>
            {headlineGross && (
              <div className="mt-3">
                <div className="text-gold font-stat font-bold text-5xl sm:text-6xl leading-none">{headlineGross}</div>
                {headlineLabel && <div className="text-textFaint text-xs mt-1">{headlineLabel}</div>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* MOVIE INFO — Released/Releasing On, Cast, Director, Genre,
          Languages, Formats -- from the stored box-office data
          (lib/bfilmy/adapter.ts). Generic label/value list (see
          TTMovieMetaItem) rather than fixed fields, so this keeps
          working if a field is added or renamed.
          `wide` items (Cast, Production -- usually long comma lists)
          get two columns instead of one, same as the source site. */}
      {details.meta.length > 0 && (
        <Card className="p-5 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
            {details.meta.map((item, i) => (
              <div key={i} className={item.wide ? 'col-span-2' : ''}>
                <div className="mdtype-overline text-textFaint mb-1.5">{item.label}</div>
                <div className="text-text font-semibold">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SummaryCards m={analytics} />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-gold" />
          <h2 className="hdisplay text-lg">Performance breakdown</h2>
        </div>
        <Card className="p-4 sm:p-5">
          <MovieBreakdownExplorer m={analytics} />
        </Card>
      </div>
    </div>
  );
}
