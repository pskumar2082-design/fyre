import { Card } from '@/components/ui';
import { formatAtp, formatGross, formatInt, formatOccupancy, formatTickets } from '@/lib/analytics/format';
import type { MovieAnalytics } from '@/lib/analytics/types';

// Headline figures for a movie, straight from Fyre Analytics. "Lifetime" is
// every tracked box-office date added up (advance never included).
export default function SummaryCards({ m }: { m: MovieAnalytics }) {
  const latest = m.latestDay;
  const lt = m.lifetime;
  const since = m.carriedOver ? ' (since 1 Jan 2025)' : '';
  const cards: { label: string; value: string; note?: string | null; accent?: boolean }[] = [];
  if (latest) {
    cards.push({
      label: latest.final ? `${latest.label} Gross` : `${latest.label} Gross · live`,
      value: formatGross(latest.metrics.gross),
      note: `${formatTickets(latest.metrics.tickets)} tickets · ${formatOccupancy(latest.metrics.occupancy)}`,
      accent: true
    });
  }
  if (m.days.length) {
    cards.push({ label: `Lifetime Gross${since}`, value: formatGross(lt.gross), note: `${lt.days} tracked days`, accent: true });
    cards.push({ label: 'Lifetime Tickets', value: formatTickets(lt.tickets) });
    cards.push({ label: 'Lifetime Shows', value: formatInt(lt.shows) });
    cards.push({ label: 'Lifetime Occupancy', value: formatOccupancy(lt.occupancy) });
    cards.push({ label: 'ATP', value: formatAtp(lt.atp) });
    if (lt.cities != null) cards.push({ label: 'Cities', value: formatInt(lt.cities) });
    if (lt.venues != null) cards.push({ label: 'Venues', value: formatInt(lt.venues) });
    if (lt.states != null) cards.push({ label: 'States', value: formatInt(lt.states) });
    if (lt.picGross != null) cards.push({ label: 'PIC Gross', value: formatGross(lt.picGross), note: `${formatTickets(lt.picTickets)} tickets` });
    if (lt.ff != null) cards.push({ label: 'Fast filling · Housefull', value: `${formatInt(lt.ff)} · ${formatInt(lt.hf)}`, note: 'shows' });
  } else if (m.advance.length) {
    const a = m.advance[m.advance.length - 1];
    cards.push({ label: `Advance · ${a.label}`, value: formatGross(a.metrics.gross), note: `${formatTickets(a.metrics.tickets)} tickets`, accent: true });
    cards.push({ label: 'Advance Shows', value: formatInt(a.metrics.shows) });
    cards.push({ label: 'Advance Occupancy', value: formatOccupancy(a.metrics.occupancy) });
  }
  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
      {cards.map((c) => (
        <Card key={c.label} className={`p-4 ${c.accent ? 'bg-gold/5 border-gold/25' : ''}`}>
          <div className="mdtype-overline text-textFaint truncate">{c.label}</div>
          <div className={`font-stat text-2xl mt-1 truncate ${c.accent ? 'font-bold text-gold' : 'font-semibold text-textDim'}`}>{c.value}</div>
          {c.note && <div className="text-textFaint text-[10px] mt-0.5">{c.note}</div>}
        </Card>
      ))}
    </div>
  );
}
