'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Globe,
  Languages,
  LayoutGrid,
  Clock,
  MapPin,
  BarChart3,
  CalendarDays,
  Film,
  ListFilter,
  ChevronDown,
  Layers
} from 'lucide-react';
import type { TTTable, TTTableRow } from '@/lib/tracktollywood/types';
import { isMoneyColumn, isDataColumn } from '@/lib/tableFormat';
import { headingLabel, categoryLabel as sharedCategoryLabel } from '@/lib/tracktollywood/tableGroups';

type Group = { heading: string; tables: TTTable[] };

// TrackTollywood's own data-snapshot labels always carry the group's
// heading as a prefix or suffix -- "Top Cities — Day 2" (heading "Day
// 2"), "Advance 2026-09-18 — State-wise" (heading "Advance
// 2026-09-18"), "Cumulative Language-wise" (heading "Cumulative"). Strip
// whichever side matches to get the clean category name for a filter
// pill; fall back to the raw label for a single-table group like
// "Day-wise Collection", where nothing is left after stripping.
const categoryLabel = sharedCategoryLabel;

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

// Text comes from the shared lib/tracktollywood/tableGroups.ts (including
// its UTC-pinned date formatting -- see that file's comment); only the
// per-heading icon choice is UI-specific enough to stay local to this
// dropdown component.
function headingMeta(heading: string): { label: string; icon: LucideIcon } {
  const label = headingLabel(heading);
  if (heading === 'Day-wise Collection') return { label, icon: BarChart3 };
  if (heading === 'Cumulative') return { label, icon: Layers };
  if (heading.startsWith('Advance ')) return { label, icon: CalendarDays };
  return { label, icon: Film };
}

// The "Day-wise Collection" table always carries its own "Day" + "Date"
// columns straight from TrackTollywood (e.g. row.Day === "Day 11",
// row.Date === "21 Sep") -- real scraped dates, not a guess. Reading them
// here (rather than inferring a date from "today minus N days", which
// breaks the moment a day is skipped or a movie has finished its run)
// keeps every date in the dropdown honest. Returns {} if that table
// isn't present in this movie's tables yet (e.g. an advance-only title).
function buildDayDateMap(groups: Group[]): Record<string, string> {
  const daywise = groups.find((g) => g.heading === 'Day-wise Collection')?.tables[0];
  const map: Record<string, string> = {};
  if (!daywise) return map;
  for (const row of daywise.rows as TTTableRow[]) {
    if (row.__isTotal) continue;
    const day = row['Day'];
    const date = row['Date'];
    if (day && date && /^Day \d+$/.test(day)) map[day] = date;
  }
  return map;
}

function dayNumber(heading: string): number | null {
  const m = heading.match(/^Day (\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

// The highest-numbered "Day N" group among the tabs actually available --
// this is TrackTollywood's own most-recently-tracked day, used for the
// dropdown's "LATEST" badge. Independent of which group is currently
// selected (a person can browse back to an older day without the badge
// jumping to follow them).
function latestDayHeading(headings: string[]): string | null {
  let best: { heading: string; n: number } | null = null;
  for (const h of headings) {
    const n = dayNumber(h);
    if (n != null && (!best || n > best.n)) best = { heading: h, n };
  }
  return best?.heading ?? null;
}

function pickDefaultHeading(groups: Group[]): string {
  const headings = groups.map((g) => g.heading);
  const latest = latestDayHeading(headings);
  if (latest) return latest;
  const advanceHeadings = headings.filter((h) => h.startsWith('Advance '));
  if (advanceHeadings.length) return advanceHeadings[advanceHeadings.length - 1];
  if (headings.includes('Day-wise Collection')) return 'Day-wise Collection';
  return headings[0] ?? '';
}

// Preferred sub-category order within a day/date group -- matches the
// order a person actually scans a box-office breakdown in.
const CATEGORY_ORDER = ['state-wise', 'top cities', 'city-wise', 'language-wise', 'format-wise', 'time slots'];

function TableView({ table }: { table: TTTable }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead>
          <tr className="bg-black/[0.02] border-b border-border">
            {table.headers.map((h) => (
              <th
                key={h}
                className={`text-left mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint ${
                  isMoneyColumn(h) || isDataColumn(h) ? 'text-right' : ''
                }`}
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
                  ? 'bg-gold/[0.06] border-t-2 border-gold/20 font-bold'
                  : `border-b border-border hover:bg-black/[0.02] transition ${i % 2 === 1 ? 'bg-black/[0.012]' : ''}`
              }
            >
              {table.headers.map((h) => (
                <td
                  key={h}
                  className={`py-2.5 px-3 whitespace-nowrap ${
                    isMoneyColumn(h)
                      ? 'text-right font-stat font-bold text-base text-gold'
                      : isDataColumn(h)
                        ? 'text-right font-body text-[13px] leading-[1.3] tabular-nums text-textDim'
                        : 'text-textDim'
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

// Shared open/close-on-outside-click/Escape behaviour for both dropdowns
// below -- everything about a listbox-style filter control except what's
// actually inside the panel.
function useDropdown<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

// The primary "Breakdown for: Day 11 — 21 Sep ▾" selector -- full width
// and stacked above the category dropdown on mobile (an overflow-x
// scroll of 10+ day pills is what this replaces), inline and compact on
// tablet/desktop. Non-day groups (Cumulative, Day-wise Collection,
// Advance-booking dates) are pinned above a "TRACKED DATES" section that
// lists every scraped day in order, oldest first, with its real date and
// a LATEST badge on whichever day TrackTollywood most recently tracked.
function HeadingDropdown({
  groups,
  heading,
  dayDateMap,
  onSelect
}: {
  groups: Group[];
  heading: string;
  dayDateMap: Record<string, string>;
  onSelect: (h: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  const otherGroups = groups.filter((g) => dayNumber(g.heading) == null);
  const dayGroups = groups
    .filter((g) => dayNumber(g.heading) != null)
    .slice()
    .sort((a, b) => (dayNumber(a.heading)! - dayNumber(b.heading)!));
  const latest = latestDayHeading(groups.map((g) => g.heading));

  const activeMeta = headingMeta(heading);
  const activeDayDate = dayDateMap[heading];
  const activeLabel = activeDayDate ? `${heading} — ${activeDayDate}` : activeMeta.label;

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 text-sm bg-surface border border-border rounded-full h-[50px] pl-4 pr-3.5 hover:border-gold/30 transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays size={17} className="text-textFaint flex-none" />
          <span className="text-textDim truncate">
            Breakdown for: <span className="font-semibold text-gold">{activeLabel}</span>
          </span>
        </span>
        <ChevronDown size={17} className={`text-textFaint flex-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 right-0 sm:right-auto mt-1.5 w-full sm:w-80 max-h-[22rem] overflow-y-auto bg-surface border border-border rounded-2xl shadow-card py-1.5"
        >
          {otherGroups.map((g) => {
            const meta = headingMeta(g.heading);
            const Icon = meta.icon;
            const isActive = g.heading === heading;
            return (
              <button
                key={g.heading}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(g.heading);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 text-sm px-4 py-3 text-left transition ${
                  isActive ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-black/[0.03] hover:text-text'
                }`}
              >
                <Icon size={16} strokeWidth={2.25} className="flex-none" />
                {meta.label}
              </button>
            );
          })}

          {otherGroups.length > 0 && dayGroups.length > 0 && <div className="h-px bg-border my-1.5" />}

          {dayGroups.length > 0 && (
            <div className="mdtype-overline text-textFaint px-4 pt-1.5 pb-1">Tracked Dates</div>
          )}
          {dayGroups.map((g) => {
            const isActive = g.heading === heading;
            const isLatest = g.heading === latest;
            const date = dayDateMap[g.heading];
            return (
              <button
                key={g.heading}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(g.heading);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 text-sm px-4 py-3 text-left transition ${
                  isActive ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-black/[0.03] hover:text-text'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Film size={16} strokeWidth={2.25} className="flex-none" />
                  <span className="truncate">
                    {g.heading}
                    {date && <span className="text-textFaint font-normal"> — {date}</span>}
                  </span>
                </span>
                {isLatest && (
                  <span className="flex-none flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase bg-goldDim/10 text-goldDim border border-goldDim/20 px-2 py-0.5 rounded-full">
                      Latest
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-goldDim" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The secondary "State-wise / Top Cities / Language-wise / ..." selector
// for whichever day/date is active -- same dropdown mechanics, a flat
// list instead of a sectioned one.
function CategoryDropdown({
  categories,
  active,
  onSelect
}: {
  categories: { table: TTTable; label: string }[];
  active: string;
  onSelect: (label: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();
  const ActiveIcon = categoryIcon(active);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 text-sm bg-surface border border-border rounded-full h-[50px] pl-4 pr-3.5 hover:border-gold/30 transition"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ActiveIcon size={17} className="text-gold flex-none" />
          <span className="font-semibold text-text truncate">{active}</span>
        </span>
        <ChevronDown size={17} className={`text-textFaint flex-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 right-0 sm:right-auto mt-1.5 w-full sm:w-64 max-h-72 overflow-y-auto bg-surface border border-border rounded-2xl shadow-card py-1.5"
        >
          {categories.map(({ label }) => {
            const Icon = categoryIcon(label);
            const isActive = label === active;
            return (
              <button
                key={label}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(label);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 text-sm px-4 py-3 text-left transition ${
                  isActive ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-black/[0.03] hover:text-text'
                }`}
              >
                <Icon size={16} strokeWidth={2.25} className="flex-none" />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TableGroups({ groups }: { groups: Group[] }) {
  const [heading, setHeading] = useState(() => pickDefaultHeading(groups));
  const activeGroup = groups.find((g) => g.heading === heading) ?? groups[0];
  const dayDateMap = useMemo(() => buildDayDateMap(groups), [groups]);

  const categories = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.tables.map((t) => ({ table: t, label: categoryLabel(t, activeGroup.heading) }));
  }, [activeGroup]);

  const [category, setCategory] = useState(() => defaultCategory(categories));

  // Selected group changed under us (user picked a different day from the
  // dropdown) -- re-resolve which category tab should be active for the
  // new group.
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
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 mb-4">
        <HeadingDropdown groups={groups} heading={heading} dayDateMap={dayDateMap} onSelect={selectHeading} />
        {categories.length > 1 && (
          <CategoryDropdown categories={categories} active={resolvedCategory} onSelect={setCategory} />
        )}
      </div>

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
