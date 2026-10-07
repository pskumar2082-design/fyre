import { Card } from '@/components/ui';
import { formatMetric, formatMoney, formatOccupancy } from '@/lib/analytics/format';
import type { MovieAnalytics } from '@/lib/analytics/types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[(m || 1) - 1]} ${y}`;
};

// Headline figures for a movie, straight from Fyre Analytics. "Lifetime" is
// every tracked box-office date added up (advance never included) -- and
// only when that is the movie's whole run. A tracked period (carried over,
// or only the recent part imported under the 90-day rule) is labelled
// "Tracked ... (since <date>)", never lifetime.
// USA figures are in USD and labelled as Indian-language screenings.
export default function SummaryCards({ m }: { m: MovieAnalytics }) {
  const cur = m.currency ?? 'INR';
  const us = m.territory === 'US';
  const f = (k: Parameters<typeof formatMetric>[0], v: number | null) => formatMetric(k, v, cur);
  const latest = m.latestDay;
  const lt = m.lifetime;
  const partial = m.carriedOver;
  const since = partial ? ` (since ${shortDate(m.historyStart ?? '2025-01-01')})` : '';
  const total = (what: string) => (partial ? `Tracked ${what}` : us ? `Total ${what}` : `Lifetime ${what}`);
  const cards: { label: string; value: string; note?: string | null; accent?: boolean }[] = [];
  if (latest) {
    const p = latest.provenance;
    cards.push({
      label: latest.final ? `${latest.label} Gross` : `${latest.label} Gross · live`,
      value: formatMoney(latest.metrics.gross, cur),
      note: `${f('tickets', latest.metrics.tickets)} tickets · ${formatOccupancy(latest.metrics.occupancy)}${p && p.occupancySource != null ? ` (source ${p.occupancySource.toFixed(2)}%, unweighted)` : ''}`,
      accent: true
    });
  }
  if (m.days.length) {
    cards.push({ label: `${total('Gross')}${since}`, value: formatMoney(lt.gross, cur), note: `${lt.days} tracked days`, accent: true });
    cards.push({ label: total('Tickets'), value: f('tickets', lt.tickets) });
    cards.push({ label: total('Shows'), value: f('shows', lt.shows) });
    cards.push({
      label: us ? 'Occupancy' : partial ? 'Tracked Occupancy' : 'Lifetime Occupancy',
      value: formatOccupancy(lt.occupancy),
      note: us && m.days.some((d) => (d.provenance?.zeroSeatShows ?? 0) > 0) ? 'tickets ÷ seats; shows with no seat count excluded' : us ? 'tickets ÷ seats' : null
    });
    cards.push({ label: 'ATP', value: f('atp', lt.atp) });
    if (lt.cities != null) cards.push({ label: 'Cities', value: f('cities', lt.cities) });
    if (lt.venues != null) cards.push({ label: us ? 'Theatres' : 'Venues', value: f('venues', lt.venues) });
    if (lt.states != null) cards.push({ label: 'States', value: f('states', lt.states) });
    if (lt.picGross != null) cards.push({ label: 'PIC Gross', value: formatMoney(lt.picGross, cur), note: `${f('picTickets', lt.picTickets)} tickets` });
    if (lt.ff != null) cards.push({ label: 'Fast filling · Housefull', value: `${f('ff', lt.ff)} · ${f('hf', lt.hf)}`, note: 'shows' });
  } else if (m.advance.length) {
    const a = m.advance[m.advance.length - 1];
    cards.push({ label: `Advance · ${a.label}`, value: formatMoney(a.metrics.gross, cur), note: `${f('tickets', a.metrics.tickets)} tickets`, accent: true });
    cards.push({ label: 'Advance Shows', value: f('shows', a.metrics.shows) });
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
