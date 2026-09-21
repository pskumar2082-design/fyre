import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import type { TTTable } from '@/lib/tracktollywood/types';
import { Card } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATE_LABEL: Record<string, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

// Groups TrackTollywood's flat table list (54+ tables for a well-into-its-run
// movie) into sections a person can actually scan: one per release day, one
// per advance-booking date, and a Cumulative section -- instead of one long
// unlabeled list. Pure string matching on the site's own data-snapshot
// labels (e.g. "Top Cities — Day 2", "Advance 2026-09-18 — State-wise",
// "Cumulative Language-wise") -- no hard-coded day count, so this keeps
// working as a movie's run gets longer or an advance window changes.
function groupTables(tables: TTTable[]): { heading: string; tables: TTTable[]; defaultOpen: boolean }[] {
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

  return order.map((heading) => ({
    heading,
    tables: groups.get(heading)!,
    // Day-wise Collection (the headline summary table) and the most
    // recent release day open by default; everything else stays
    // collapsed behind <details> so the page isn't a wall of tables.
    defaultOpen: heading === 'Day-wise Collection'
  }));
}

function TableView({ table }: { table: TTTable }) {
  return (
    <div className="mb-4 last:mb-0">
      {table.label.includes('—') && (
        <div className="text-textFaint text-xs font-semibold uppercase tracking-wide mb-1">
          {table.label.split('—').slice(1).join('—').trim() || table.label}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-black/10">
              {table.headers.map((h) => (
                <th key={h} className="text-left font-semibold py-1.5 pr-4 whitespace-nowrap text-textFaint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={`border-b border-black/5 ${row.__isTotal ? 'font-bold' : ''}`}>
                {table.headers.map((h) => (
                  <td key={h} className="py-1.5 pr-4 whitespace-nowrap">
                    {row[h] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
    details.state === 'final' ? '← Box office archive' : details.state === 'live' ? '← Now showing' : '← Upcoming releases';

  return (
    <div className="px-5 md:px-10 py-8 max-w-4xl mx-auto">
      <Link href={backHref} className="text-gold text-sm font-semibold hover:underline">
        {backLabel}
      </Link>

      <div className="flex gap-5 mt-4 mb-8 flex-wrap sm:flex-nowrap">
        <div className="relative w-[120px] aspect-[2/3] flex-none rounded-xl overflow-hidden bg-tintBlue">
          {details.poster ? (
            <Image src={details.poster} alt={details.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-textFaint text-xs">No poster</div>
          )}
        </div>
        <div>
          <h1 className="hdisplay text-2xl">{details.title}</h1>
          {details.badgeText && <div className="text-textFaint text-sm mt-1">{details.badgeText}</div>}
          {details.headlineGross && (
            <div className="mt-3">
              <div className="text-gold font-bold text-3xl">{details.headlineGross}</div>
              {details.headlineLabel && <div className="text-textFaint text-xs mt-0.5">{details.headlineLabel}</div>}
            </div>
          )}
        </div>
      </div>

      {details.stats.length > 0 && (
        <Card className="p-5 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {details.stats.map((s, i) => (
            <div key={i}>
              <div className="font-bold text-sm">{s.value}</div>
              <div className="text-textFaint text-[10px] uppercase tracking-wide">
                {s.label}
                {s.note ? ` · ${s.note}` : ''}
              </div>
            </div>
          ))}
        </Card>
      )}

      {groups.map((group) => (
        <details key={group.heading} open={group.defaultOpen} className="mb-3">
          <summary className="cursor-pointer font-semibold text-sm py-2 select-none">{group.heading}</summary>
          <Card className="p-4 mt-2">
            {group.tables.map((t, i) => (
              <TableView key={i} table={t} />
            ))}
          </Card>
        </details>
      ))}

    </div>
  );
}
