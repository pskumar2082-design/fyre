import Image from 'next/image';
import Link from 'next/link';
import { ChartNoAxesColumnIncreasing, GitCompareArrows, ImageDown, TrendingUp } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMovieDetails, parseReleaseDate } from '@/lib/bfilmy/source';
import { formatDate } from '@/lib/bfilmy/adapter';
import type { TTMovieMetaItem } from '@/lib/boxoffice/types';
import { loadMovieAnalytics } from '@/lib/analytics/load';
import { formatGross, formatMetric, formatMoney, formatOccupancy } from '@/lib/analytics/format';
import StatsDashboard from '@/components/stats/StatsDashboard';
import { statsFrom } from '@/lib/analytics/stats';
import { loadUsaAnalytics } from '@/lib/analytics/usa';
import { SectionHeading } from '@/components/ui';
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

  // Detail-hero content (reference: movie detail page), all from Fyre's
  // own data: metadata pills, languages/formats as genre-style chips, a
  // box-office summary in place of a synopsis, and real actions only.
  const year = (releaseDateIso ?? '').slice(0, 4) || null;
  const chips = [metaValue(details.meta, /language/i), metaValue(details.meta, /format/i)]
    .flatMap((v) => (v ? v.split(',') : []))
    .map((v) => v.trim())
    .filter(Boolean);
  const infoItems = details.meta.filter((m) => !/language|format/i.test(m.label));
  const summary = [
    releaseDate ? `${/releasing/i.test(details.meta.find((m) => /^released$|releasing/i.test(m.label))?.label ?? '') ? 'Releasing' : 'Released'} ${releaseDate}.` : null,
    analytics?.days.length
      ? `${formatMoney(analytics.lifetime.gross, 'INR')} ${analytics.carriedOver ? 'tracked' : 'gross'} in India across ${analytics.lifetime.days} day${analytics.lifetime.days === 1 ? '' : 's'}: ${formatMetric('shows', analytics.lifetime.shows, 'INR')} shows, ${formatMetric('tickets', analytics.lifetime.tickets, 'INR')} tickets, ${formatOccupancy(analytics.lifetime.occupancy)} occupancy.`
      : null,
    usa?.days.length ? `USA (Indian-language screenings): ${formatMoney(usa.lifetime.gross, 'USD')} from ${formatMetric('shows', usa.lifetime.shows, 'USD')} shows.` : null,
    !lead.days.length && latestAdvance ? `Advance bookings: ${formatMoney(latestAdvance.metrics.gross, cur)} (${latestAdvance.label}).` : null
  ]
    .filter(Boolean)
    .join(' ');
  const pill = 'inline-flex items-center gap-1.5 h-7 sm:h-[30px] px-3 rounded-full border border-border bg-surface2/60 font-mono text-[13px] sm:text-[15px] text-zinc-300 leading-none';
  const action = 'w-full inline-flex items-center justify-center gap-3 h-12 sm:h-14 2xl:h-[58px] rounded-xl text-base sm:text-lg 2xl:text-xl transition-colors';

  return (
    <div className="relative isolate">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(movieJsonLd) }} />
      {details.poster && (
        <div className="absolute inset-x-0 top-0 h-[760px] -z-10 overflow-hidden" aria-hidden>
          <Image src={details.poster} alt="" fill unoptimized className="object-cover object-top opacity-[0.18] blur-3xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black" />
        </div>
      )}

      <div className="fx-container-detail pt-8 sm:pt-12 2xl:pt-[58px]">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 2xl:gap-[60px]">
          <div className="relative w-[190px] sm:w-[240px] md:w-[260px] lg:w-[320px] 2xl:w-[420px] aspect-[2/3] flex-none self-center md:self-start rounded-xl overflow-hidden border border-border bg-surface2 shadow-lift">
            {details.poster ? (
              <Image src={details.poster} alt={details.title} fill unoptimized priority className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-textFaint">No poster</div>
            )}
          </div>

          <div className="min-w-0 flex-1 max-w-[1320px]">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {lead.state !== 'unknown' && (
                <span className={`${pill} !text-white font-bold uppercase tracking-wider`}>
                  {lead.state === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />}
                  {badgeText}
                </span>
              )}
              {year && <span className={pill}>{year}</span>}
              {headlineGross && (
                <span className={`${pill} !border-gold/30 !bg-gold/10 !text-gold font-bold`}>
                  <TrendingUp className="w-4 h-4" strokeWidth={2.5} />
                  {headlineGross}
                </span>
              )}
              {usa && analytics && usa.days.length > 0 && <span className={pill}>USA {formatMoney(usa.lifetime.gross, 'USD')}</span>}
            </div>

            <h1 className="type-xl-headline text-[44px] sm:text-6xl 2xl:text-[76px] text-white mt-6 2xl:mt-8">{details.title}</h1>
            {headlineLabel && <p className="font-serif italic text-lg sm:text-xl 2xl:text-[22px] text-zinc-400 mt-4">{`${headlinePrefix}${headlineLabel}`}</p>}

            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 sm:gap-2.5 mt-6">
                {chips.map((c) => (
                  <span key={c} className="inline-flex items-center h-8 sm:h-[33px] px-3 rounded-md border border-border bg-surface/80 text-sm sm:text-base text-zinc-200">
                    {c}
                  </span>
                ))}
              </div>
            )}

            {summary && <p className="text-base sm:text-lg 2xl:text-xl leading-relaxed text-zinc-300 mt-6 2xl:mt-8 max-w-[1130px]">{summary}</p>}

            {infoItems.length > 0 && (
              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 mt-6 max-w-[1130px]">
                {infoItems.map((item, i) => (
                  <div key={i} className={item.wide ? 'col-span-2' : ''}>
                    <dt className="mdtype-overline text-textFaint">{item.label}</dt>
                    <dd className="text-sm sm:text-base text-zinc-200 mt-1">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex flex-col gap-4 2xl:gap-5 mt-8 2xl:mt-10">
              <a href="#box-office" className={`${action} bg-white text-black font-bold hover:bg-zinc-200`}>
                <ChartNoAxesColumnIncreasing className="w-5 h-5 2xl:w-6 2xl:h-6" strokeWidth={2.5} />
                View Box Office
              </a>
              <Link href={`/compare?movies=${encodeURIComponent(params.slug)}`} className={`${action} bg-surface2/80 border border-border text-white font-semibold hover:bg-surface2 hover:border-borderStrong`}>
                <GitCompareArrows className="w-5 h-5 2xl:w-6 2xl:h-6" strokeWidth={2} />
                Compare with Another Movie
              </Link>
              {lead.days.length > 0 && (
                <a
                  href={`/api/social-poster/x-compare?movies=${encodeURIComponent(params.slug)}&basis=lifetime${analytics ? '' : '&territory=us'}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${action} bg-surface2/80 border border-border text-white font-semibold hover:bg-surface2 hover:border-borderStrong`}
                >
                  <ImageDown className="w-5 h-5 2xl:w-6 2xl:h-6" strokeWidth={2} />
                  Box Office Poster
                </a>
              )}
            </div>
          </div>
        </div>

        <section id="box-office" className="scroll-mt-24 mt-16 sm:mt-24">
          <SectionHeading title="Box Office" subtitle={`${analytics && usa ? 'India and USA' : analytics ? 'India' : 'USA'} collections, day-wise and breakdowns`} />
          <StatsDashboard
            india={analytics ? statsFrom(analytics) : null}
            usa={usa ? statsFrom(usa) : null}
            releaseLabel={releaseDate ? `${/releasing/i.test(details.meta.find((m) => /^released$|releasing/i.test(m.label))?.label ?? '') ? 'Releasing' : 'Released'} ${releaseDate}` : lead.dayOne ? `Day 1 · ${formatDate(lead.dayOne)}` : null}
            languages={analytics?.languages ?? []}
          />
        </section>
      </div>
    </div>
  );
}
