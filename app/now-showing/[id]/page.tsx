import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BreakdownTable, { type BreakdownRow } from '@/components/BreakdownTable';

export const revalidate = 0;

type Kind = 'advance' | 'tracked';

export default async function MovieDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { kind?: string };
}) {
  const { data: movie } = await supabase.from('now_showing').select('*').eq('id', params.id).single();
  if (!movie) return notFound();

  // matched by title, same as the homepage — there's no foreign key between
  // now_showing and reviews, they're just two independently-managed tables
  const { data: review } = await supabase.from('reviews').select('*').ilike('title', movie.title).maybeSingle();

  // Advance = pre-release booking numbers, Tracked = actual post-release
  // collections — same idea as the Advance/Tracked toggle on box-office
  // tracker sites. Defaults to Tracked once a movie has released, Advance
  // before that, but either can be opened directly via ?kind=.
  const isReleased = movie.release_date ? new Date(movie.release_date).getTime() <= Date.now() : true;
  const defaultKind: Kind = isReleased ? 'tracked' : 'advance';
  const kind: Kind = searchParams.kind === 'advance' || searchParams.kind === 'tracked' ? searchParams.kind : defaultKind;
  const otherKind: Kind = kind === 'advance' ? 'tracked' : 'advance';

  const { data: breakdownRows } = await supabase
    .from('box_office_breakdown')
    .select('*')
    .eq('movie_id', movie.id)
    .eq('kind', kind)
    .order('day_date', { ascending: false });
  const breakdown: BreakdownRow[] = breakdownRows ?? [];

  // Auto-synced day-wise history from /api/sync-boxoffice (see
  // supabase/migration_scraper.sql) — only meaningful once a movie has
  // actually released, so only fetched/shown on the Tracked side.
  let dailyRows: any[] | null = null;
  if (kind === 'tracked') {
    const { data } = await supabase
      .from('daily_collections')
      .select('*')
      .eq('movie_id', movie.id)
      .order('day_number', { ascending: false });
    dailyRows = data;
  }

  const releaseDateLabel = movie.release_date
    ? new Date(movie.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const metaLine = [releaseDateLabel && `Release: ${releaseDateLabel}`, movie.language, movie.genre].filter(Boolean).join(' · ');

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/#boxoffice" className="text-goldBright text-sm font-semibold">
          ← Back to Now showing
        </Link>
        <Link
          href={`/now-showing/${movie.id}?kind=${otherKind}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-textDim border border-border rounded-full px-3 py-1.5 hover:border-goldDim transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {otherKind === 'advance' ? 'Advance' : 'Tracked'}
        </Link>
      </div>

      <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-40 h-60 flex-none rounded-2xl overflow-hidden border border-border relative bg-surface2">
          {movie.image_url && <Image src={movie.image_url} alt="" fill className="object-cover object-top" />}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="hdisplay text-3xl md:text-4xl">{movie.title}</h1>
          {metaLine && <div className="text-textFaint text-sm mt-2">{metaLine}</div>}
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-goldBright bg-goldDim/15 border border-gold/30 rounded-full px-3 py-1 mt-3 capitalize">
            {kind} data
          </div>

          {kind === 'tracked' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              <StatCard label="Lifetime gross" value={movie.lifetime_gross} accent="text-goldBright" highlight />
              <StatCard label="Lifetime shows" value={movie.lifetime_shows} />
              <StatCard label="Occupancy" value={movie.lifetime_occupancy != null ? `${movie.lifetime_occupancy}%` : null} />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              <StatCard label="Advance gross" value={movie.advance_gross} accent="text-goldBright" highlight />
              <StatCard label="Tickets sold" value={movie.advance_tickets} />
              <StatCard label="Shows" value={movie.advance_shows} />
              <StatCard label="Cities" value={movie.advance_cities} />
              <StatCard label="Occupancy" value={movie.advance_occupancy != null ? `${movie.advance_occupancy}%` : null} />
            </div>
          )}
        </div>
      </div>

      {review && (
        <div className="mt-8 bg-surface border border-border rounded-2xl p-5 max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-gold text-white text-xs font-bold px-2 py-1 rounded-lg">{review.rating} / 5</span>
            <span className="text-goldBright text-xs">★★★★★</span>
          </div>
          <p className="text-sm text-textDim mb-2">{review.excerpt}</p>
          <Link href={`/reviews/${review.id}`} className="text-goldBright text-xs font-semibold">
            Read full review →
          </Link>
        </div>
      )}

      {kind === 'tracked' && dailyRows && dailyRows.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <h2 className="hdisplay text-xl">Day-wise collection</h2>
            </div>
            {movie.source_synced_at && (
              <span className="text-[11px] text-textFaint">
                Auto-synced from a public source · last updated {new Date(movie.source_synced_at).toLocaleString()}
              </span>
            )}
          </div>
          <div className="overflow-x-auto bg-surface border border-border rounded-2xl">
            <table className="w-full text-sm border-collapse min-w-[560px]">
              <thead>
                <tr className="text-textFaint text-xs uppercase border-b border-border bg-bgAlt/50">
                  <th className="text-left py-3 px-4">Day</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-right py-3 px-4">Gross</th>
                  <th className="text-right py-3 px-4">Net</th>
                  <th className="text-right py-3 px-4">Shows</th>
                  <th className="text-right py-3 px-4">Occ %</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((d: any) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 px-4">
                      Day {d.day_number}
                      {d.day_label && <span className="text-textFaint text-xs"> · {d.day_label}</span>}
                    </td>
                    <td className="py-2.5 px-4 text-textDim">{d.day_date ?? '—'}</td>
                    <td className="text-right py-2.5 px-4">{d.gross != null ? `₹${Number(d.gross).toFixed(2)} Cr` : '—'}</td>
                    <td className="text-right py-2.5 px-4 text-goldBright font-semibold">
                      {d.net != null ? `₹${Number(d.net).toFixed(2)} Cr` : '—'}
                    </td>
                    <td className="text-right py-2.5 px-4">{d.shows ?? '—'}</td>
                    <td className="text-right py-2.5 px-4">{d.occ_pct != null ? `${d.occ_pct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-10 pb-16">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <h2 className="hdisplay text-xl capitalize">{kind} breakdown</h2>
        </div>
        <BreakdownTable rows={breakdown} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  highlight
}: {
  label: string;
  value: string | number | null | undefined;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 border ${
        highlight ? 'bg-goldDim/15 border-gold/30' : 'bg-surface border-border'
      }`}
    >
      <div className="text-textFaint text-[10px] uppercase tracking-wide mb-1">{label}</div>
      <div className={`hdisplay text-xl ${accent ?? 'text-text'}`}>{value ?? '—'}</div>
    </div>
  );
}
