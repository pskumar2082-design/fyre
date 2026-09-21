'use client';

import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Globe, Languages, LayoutGrid, Clock, MapPin, BarChart3, CalendarDays, Film, ListFilter } from 'lucide-react';
import type { TTTable, TTTableRow } from '@/lib/tracktollywood/types';

type Group = { heading: string; tables: TTTable[] };

// TrackTollywood's own data-snapshot labels always carry the group's
// heading as a prefix or suffix -- "Top Cities — Day 2" (heading "Day
// 2"), "Advance 2026-09-18 — State-wise" (heading "Advance
// 2026-09-18"), "Cumulative Language-wise" (heading "Cumulative"). Strip
// whichever side matches to get the clean category name for a filter
// pill; fall back to the raw label for a single-table group like
// "Day-wise Collection", where nothing is left after stripping.
function categoryLabel(table: TTTable, heading: string): string {
  let label = table.label;
  if (label.startsWith(heading)) label = label.slice(heading.length);
  else if (label.endsWith(heading)) label = label.slice(0, label.length - heading.length);
  label = label.replace(/^[\s—-]+|[\s—-]+$/g, '');
  return label || table.label;
}

function categoryIcon(category: string): LucideIcon {
  const c = category.toLowerCase();
  if (c.includes('state')) return Globe;
  if (c.includes('language')) return Languages;
  if (c.includes('format')) return LayoutGrid;
  if (c.includes('time')) return Clock;
  if (c.includes('cit')) return MapPin; // "Top Cities" / "City-wise"
  if (c.includes('day-wise')) return BarChart3;
  return ListFilter;
}

function headingMeta(heading: string): { label: string; icon: LucideIcon } {
  if (heading === 'Day-wise Collection') return { label: 'Day-wise', icon: BarChart3 };
  if (heading === 'Cumulative') return { label: 'Cumulative', icon: BarChart3 };
  if (heading.startsWith('Advance ')) {
    const raw = heading.slice('Advance '.length);
    const d = new Date(raw);
    const label = Number.isNaN(d.getTime())
      ? heading
      : `Adv · ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
    return { label, icon: CalendarDays };
  }
  return { label: heading, icon: Film };
}

// Preferred sub-category order within a day/date group -- matches the
// order a person actually scans a box-office breakdown in.
const CATEGORY_ORDER = ['state-wise', 'top cities', 'city-wise', 'language-wise', 'format-wise', 'time slots'];

function pickDefaultHeading(groups: Group[]): string {
  const headings = groups.map((g) => g.heading);
  const dayHeadings = headings.filter((h) => /^Day \d+$/.test(h));
  if (dayHeadings.length) {
    return dayHeadings.slice().sort((a, b) => parseInt(b.slice(4), 10) - parseInt(a.slice(4), 10))[0];
  }
  const advanceHeadings = headings.filter((h) => h.startsWith('Advance '));
  if (advanceHeadings.length) return advanceHeadings[advanceHeadings.length - 1];
  if (headings.includes('Day-wise Collection')) return 'Day-wise Collection';
  return headings[0] ?? '';
}

function isMoneyColumn(header: string): boolean {
  return /gross|collection|coll\./i.test(header);
}

function TableView({ table }: { table: TTTable }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/10">
            {table.headers.map((h) => (
              <th
                key={h}
                className={`text-left mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint ${isMoneyColumn(h) ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row: TTTableRow, i) => (
            <tr
              key={i}
              className={
                row.__isTotal
                  ? 'bg-gold/10 border-t-2 border-gold/30 font-bold'
                  : `border-b border-white/5 hover:bg-white/[0.03] transition ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`
              }
            >
              {table.headers.map((h) => (
                <td
                  key={h}
                  className={`py-2.5 px-3 whitespace-nowrap ${
                    isMoneyColumn(h) ? 'text-right font-stat text-base tracking-wide text-text' : 'text-textDim'
                  } ${row.__isTotal ? 'text-text' : ''}`}
                >
                  {row[h] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TableGroups({ groups }: { groups: Group[] }) {
  const [heading, setHeading] = useState(() => pickDefaultHeading(groups));
  const activeGroup = groups.find((g) => g.heading === heading) ?? groups[0];

  const categories = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.tables.map((t) => ({ table: t, label: categoryLabel(t, activeGroup.heading) }));
  }, [activeGroup]);

  const [category, setCategory] = useState(() => defaultCategory(categories));

  // Selected group changed under us (user clicked a different day pill) --
  // re-resolve which category tab should be active for the new group.
  const resolvedCategory = categories.some((c) => c.label === category) ? category : defaultCategory(categories);
  const activeTable = categories.find((c) => c.label === resolvedCategory)?.table;

  function selectHeading(h: string) {
    setHeading(h);
    const nextGroup = groups.find((g) => g.heading === h);
    const nextCategories = (nextGroup?.tables ?? []).map((t) => ({ table: t, label: categoryLabel(t, h) }));
    setCategory(defaultCategory(nextCategories));
  }

  if (!activeGroup) return null;

  return (
    <div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        {groups.map((g) => {
          const meta = headingMeta(g.heading);
          const Icon = meta.icon;
          const active = g.heading === heading;
          return (
            <button
              key={g.heading}
              type="button"
              onClick={() => selectHeading(g.heading)}
              className={`flex-none inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition ${
                active
                  ? 'bg-white/[0.12] text-text border-white/[0.12]'
                  : 'bg-surface text-textDim border-white/5 hover:border-white/15 hover:text-text'
              }`}
            >
              <Icon size={14} strokeWidth={2.25} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {categories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {categories.map(({ label }) => {
            const Icon = categoryIcon(label);
            const active = label === resolvedCategory;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setCategory(label)}
                className={`flex-none inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                  active
                    ? 'bg-white/[0.12] text-text border-white/[0.12]'
                    : 'bg-transparent text-textFaint border-white/5 hover:border-white/15 hover:text-textDim'
                }`}
              >
                <Icon size={13} strokeWidth={2.25} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {activeTable && <TableView table={activeTable} />}
    </div>
  );
}

function defaultCategory(categories: { table: TTTable; label: string }[]): string {
  if (!categories.length) return '';
  for (const preferred of CATEGORY_ORDER) {
    const hit = categories.find((c) => c.label.toLowerCase() === preferred);
    if (hit) return hit.label;
  }
  return categories[0].label;
}
