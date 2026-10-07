import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMovieDetails, parseReleaseDate } from '@/lib/bfilmy/source';
import { formatDate } from '@/lib/bfilmy/adapter';
import type { TTMovieMetaItem } from '@/lib/boxoffice/types';
import { loadMovieAnalytics } from '@/lib/analytics/load';
import { formatGross, formatMoney } from '@/lib/analytics/format';
import TerritoryTabs from '@/components/analytics/TerritoryTabs';
import { loadUsaAnalytics } from '@/lib/analytics/usa';
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
  let usa;
  try {
    [details, analytics, usa] = await Promise.all([getMovieDetails(params.slug, 'summary'), loadMovieAnalytics(params.slug), loadUsaAnalytics(params.slug).catch(() => null)]);
  } catch {
    details = null;
  }
  if (!details || (!analytics && !usa)) return {};

  const gross = analytics?.days.length ? formatGross(analytics.lifetime.gross) : usa?.days.length ? `${formatMoney(usa.lifetime.gross, 'USD')} (USA)` : null;
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
  let usa;
  try {
    // India and USA (Indian-language screenings) load independently: a Fyre
    // movie can have either or both, and a USA failure never takes the
    // India page down.
    [details, analytics, usa] = await Promise.all([getMovieDetails(params.slug, 'summary'), loadMovieAnalytics(params.slug), loadUsaAnalytics(params.slug).catch(() => null)]);
  } catch {
    details = null;
  }
  if (!details || (!analytics && !usa)) notFound();

  // Headline figure from Fyre Analytics -- the same numbers as the cards,
  // the breakdowns, Movie Comparison and the poster. India leads when the
  // movie has India data; a USA-only movie leads with its USA figure (USD).
  const lead = analytics ?? usa!;
  const cur = lead.currency ?? 'INR';
  const lt = lead.lifetime;
  const latestAdvance = lead.advance[lead.advance.length - 1];
  const badgeText =
    lead.state === 'live'
      ? `Live Tracking${lead.latestDay && lead.latestDay.day != null ? ` · ${lead.latestDay.label}` : ''}`
      : lead.state === 'advance'
        ? 'Advance Booking'
        : lead.state === 'final'
          ? 'Final'
          : details.badgeText || details.state;
  const headlineGross = lead.days.length ? formatMoney(lt.gross, cur) : latestAdvance ? formatMoney(latestAdvance.metrics.gross, cur) : details.headlineGross;
  const headlineLabel = lead.days.length
    ? lead.carriedOver
      ? `Tracked gross since ${formatDate(lead.historyStart ?? '2025-01-01')}`
      : `Tracked Gross · ${lead.state === 'live' ? `${lead.latestDay?.label ?? ''} running` : `Final · ${lt.days} days with shows`}`
    : latestAdvance
      ? `Advance Gross · ${latestAdvance.label}`
      : details.headlineLabel;
  const headlinePrefix = analytics ? (usa ? 'India · ' : '') : 'USA · Indian-language screenings · ';
  const state = analytics ? details.state : usa!.state;
  const backHref = state === 'final' ? '/box-office' : state === 'live' ? '/now-showing' : '/upcoming';
  const backLabel = state === 'final' ? 'Box office archive' : state === 'live' ? 'Now showing' : 'Upcoming releases';

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
            {lead.state !== 'unknown' && (
              <span className={`inline-flex items-center gap-1.5 w-fit text-[11px] font-bold uppercase px-2.5 py-1 rounded-lg mb-2.5 ${STATE_BADGE[lead.state]}`}>
                {lead.state === 'live' && (
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
                {headlineLabel && <div className="text-textFaint text-xs mt-1">{`${headlinePrefix}${headlineLabel}`}</div>}
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

      <TerritoryTabs india={analytics ?? null} usa={usa ?? null} />
    </div>
  );
}
