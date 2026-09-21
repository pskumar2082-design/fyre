import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import type { TTTable } from '@/lib/tracktollywood/types';
import { STATE_BADGE } from '@/lib/tracktollywood/stateStyle';
import { Card } from '@/components/ui';
import TableGroups from '@/components/TableGroups';

export const dynamic = 'force-dynamic';

// Groups TrackTollywood's flat table list (54+ tables for a well-into-its-run
// movie) into sections a person can actually scan: one per release day, one
// per advance-booking date, and a Cumulative section -- instead of one long
// unlabeled list. Pure string matching on the site's own data-snapshot
// labels (e.g. "Top Cities — Day 2", "Advance 2026-09-18 — State-wise",
// "Cumulative Language-wise") -- no hard-coded day count, so this keeps
// working as a movie's run gets longer or an advance window changes. See
// components/TableGroups.tsx for the interactive filter UI built on top of
// this grouping.
function groupTables(tables: TTTable[]): { heading: string; tables: TTTable[] }[] {
  const groups = new Map<string, TTTable[]>();
  const order: string[] = [];

  for (const t of tables) {
    let heading: string;
    if (t.label === 'Day-wise Collection') heading = 'Day-wise Collection';
    else if (/Cumulative/i.test(t.label)) heading = 'Cumulative';
    else if (/^Advance /i.test(t.label)) heading = t.label.split(' — ')[0]; // "Advance 2026-09-18"
    else {
      const m = t.label.match(/— (Day \d+)$/);
      heading = m ? m[1] : 'Other';
    }
    if (!groups.has(heading)) {
      groups.set(heading, []);
      order.push(heading);
    }
    groups.get(heading)!.push(t);
  }

  return order.map((heading) => ({ heading, tables: groups.get(heading)! }));
}

export default async function TrackTollywoodMoviePage({ params }: { params: { slug: string } }) {
  let details;
  try {
    details = await getMovieDetails(params.slug);
  } catch {
    details = null;
  }
  if (!details) notFound();

  const groups = groupTables(details.tables);
  const backHref =
    details.state === 'final' ? '/box-office' : details.state === 'live' ? '/now-showing' : '/upcoming';
  const backLabel =
    details.state === 'final' ? 'Box office archive' : details.state === 'live' ? 'Now showing' : 'Upcoming releases';

  return (
    <div className="px-5 md:px-10 py-8 max-w-5xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-gold text-sm font-semibold hover:text-goldBright transition mb-5">
        <ArrowLeft size={15} /> {backLabel}
      </Link>

      {/* HERO — flat white card (matching the rest of the light theme,
          no dark blurred-poster backdrop): sharp poster thumbnail + state
          badge + headline gross. The badge itself still uses the on-photo
          treatment since it sits right against the poster art. */}
      <Card className="relative overflow-hidden mb-6">
        <div className="relative flex gap-5 p-5 sm:p-7 flex-wrap sm:flex-nowrap">
          <div className="relative w-[104px] sm:w-[130px] aspect-[2/3] flex-none rounded-xl overflow-hidden bg-surface2 border border-black/[0.06] shadow-card">
            {details.poster ? (
              <Image src={details.poster} alt={details.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-textFaint text-xs">No poster</div>
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            {details.state !== 'unknown' && (
              <span className={`inline-flex items-center gap-1.5 w-fit text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg mb-2.5 ${STATE_BADGE[details.state]}`}>
                {details.state === 'live' && (
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-white/60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
                {details.badgeText || details.state}
              </span>
            )}
            <h1 className="hdisplay text-2xl sm:text-3xl text-text">{details.title}</h1>
            {details.headlineGross && (
              <div className="mt-3">
                <div className="text-text font-stat text-4xl sm:text-5xl tracking-wide">{details.headlineGross}</div>
                {details.headlineLabel && <div className="text-textFaint text-xs mt-1">{details.headlineLabel}</div>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* STAT CARDS — the label matching /gross/i gets the accent
          treatment, same restraint as the rest of the site: green means
          "this is the money number", everything else stays neutral. */}
      {details.stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {details.stats.map((s, i) => {
            const highlight = /gross/i.test(s.label);
            return (
              <Card
                key={i}
                className={`p-4 ${highlight ? 'bg-gold/5 border-gold/25' : ''}`}
              >
                <div className="mdtype-overline text-textFaint truncate">{s.label}</div>
                <div className={`font-stat text-xl tracking-wide mt-1 truncate ${highlight ? 'text-text' : 'text-textDim'}`}>{s.value}</div>
                {s.note && <div className="text-textFaint text-[10px] mt-0.5">{s.note}</div>}
              </Card>
            );
          })}
        </div>
      )}

      {groups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-gold" />
            <h2 className="hdisplay text-lg">Performance breakdown</h2>
          </div>
          <Card className="p-4 sm:p-5">
            <TableGroups groups={groups} />
          </Card>
        </div>
      )}
    </div>
  );
}
