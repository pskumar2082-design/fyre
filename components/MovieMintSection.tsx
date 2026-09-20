import { Card } from '@/components/ui';
import BreakdownTable, { type BreakdownRow } from '@/components/BreakdownTable';

// ---------------------------------------------------------------------------
// Renders MovieMint-sourced data on a movie's detail page. Everything here
// is additive to the existing (Sacnilk-backed) sections above it on the
// page -- it reads only source_snapshots/box_office_breakdown/
// multiplex_breakdown rows with source='moviemint', never now_showing's
// lifetime_*/advance_* columns, so there's no chance of this section
// showing (or being confused with) Sacnilk's numbers. See
// lib/syncMovieMint.ts for why that split exists.
//
// Every metric here can legitimately be missing (MovieMint simply didn't
// report it) -- StatCard already renders `null`/`undefined` as '—', the
// same convention the rest of this page uses, so nothing here invents a 0.
// ---------------------------------------------------------------------------

type MovieMintSnapshot = {
  kind: 'advance' | 'tracked';
  gross: number | null;
  tickets: number | null;
  shows: number | null;
  cities: number | null;
  occupancy: number | null;
  source_updated_text: string | null;
};

type MultiplexRow = {
  chain: string;
  gross: number | null;
  shows: number | null;
};

export default function MovieMintSection({
  snapshots,
  breakdownRows,
  multiplexRows
}: {
  snapshots: MovieMintSnapshot[];
  breakdownRows: BreakdownRow[];
  multiplexRows: MultiplexRow[];
}) {
  const advance = snapshots.find((s) => s.kind === 'advance') ?? null;
  const tracked = snapshots.find((s) => s.kind === 'tracked') ?? null;

  if (!advance && !tracked && breakdownRows.length === 0 && multiplexRows.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <h2 className="hdisplay text-xl">MovieMint Data</h2>
        </div>
        <a
          href="https://moviemintbo.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold border border-gold/30 rounded-full px-3 py-1 hover:border-gold transition"
        >
          Source: MovieMint →
        </a>
      </div>

      {advance && (
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-textFaint uppercase tracking-wide mb-2">Advance sales</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <StatCard label="Advance gross" value={advance.gross != null ? `₹${advance.gross.toFixed(2)} Cr` : null} highlight />
            <StatCard label="Tickets" value={advance.tickets} />
            <StatCard label="Shows" value={advance.shows} />
            <StatCard label="Cities" value={advance.cities} />
            <StatCard label="Occupancy" value={advance.occupancy != null ? `${advance.occupancy}%` : null} />
          </div>
          {advance.source_updated_text && <p className="text-[11px] text-textFaint mt-2">{advance.source_updated_text}</p>}
        </div>
      )}

      {tracked && (
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-textFaint uppercase tracking-wide mb-2">Tracked</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <StatCard label="Today's gross" value={tracked.gross != null ? `₹${tracked.gross.toFixed(2)} Cr` : null} highlight />
            <StatCard label="Lifetime tickets" value={tracked.tickets} />
            <StatCard label="Lifetime shows" value={tracked.shows} />
            <StatCard label="Cities" value={tracked.cities} />
            <StatCard label="Occupancy" value={tracked.occupancy != null ? `${tracked.occupancy}%` : null} />
          </div>
          {tracked.source_updated_text && <p className="text-[11px] text-textFaint mt-2">{tracked.source_updated_text}</p>}
        </div>
      )}

      {breakdownRows.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-textFaint uppercase tracking-wide mb-2">Breakdown</div>
          <BreakdownTable rows={breakdownRows} />
          <p className="text-[11px] text-textFaint mt-2">
            &ldquo;FF&rdquo; is reported by MovieMint as-is — its exact meaning hasn&rsquo;t been confirmed, so it&rsquo;s shown
            unmodified rather than interpreted.
          </p>
        </div>
      )}

      {multiplexRows.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-textFaint uppercase tracking-wide mb-2">Selected Multiplexes</div>
          <p className="text-[11px] text-textFaint mb-2">
            A limited, named set of multiplex chains MovieMint tracks directly — not all theatres screening this movie.
          </p>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[420px]">
              <thead>
                <tr className="text-textFaint text-xs uppercase border-b border-border bg-bgAlt/60">
                  <th className="text-left py-3 px-4">Chain</th>
                  <th className="text-right py-3 px-4">Gross</th>
                  <th className="text-right py-3 px-4">Shows</th>
                </tr>
              </thead>
              <tbody>
                {multiplexRows.map((r, i) => (
                  <tr key={i} className="border-b border-[#F2F4F7] last:border-0">
                    <td className="py-2.5 px-4 font-medium">{r.chain}</td>
                    <td className="text-right py-2.5 px-4 text-gold font-semibold">
                      {r.gross != null ? `₹${Number(r.gross).toFixed(2)} Cr` : '—'}
                    </td>
                    <td className="text-right py-2.5 px-4 text-textDim">{r.shows ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <Card className={`p-4 ${highlight ? 'bg-tintBlue' : ''}`}>
      <div className={`text-[10px] uppercase tracking-wide mb-1 ${highlight ? 'text-gold/70' : 'text-textFaint'}`}>{label}</div>
      <div className={`hdisplay text-xl ${highlight ? 'text-gold' : 'text-text'}`}>{value ?? '—'}</div>
    </Card>
  );
}
