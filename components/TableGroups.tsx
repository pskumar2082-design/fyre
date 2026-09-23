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
  Layers,
  Check
} from 'lucide-react';
import type { TTTable, TTTableRow } from '@/lib/tracktollywood/types';
import { isMoneyColumn, isDataColumn, isPercentColumn, isOccupancyColumn, occupancyColorClass } from '@/lib/tableFormat';
import {
  headingLabel,
  categoryLabel as sharedCategoryLabel,
  categoryOf,
  sortBoxOfficeHeadings,
  sortAdvanceHeadings,
  type HeadingCategory
} from '@/lib/tracktollywood/tableGroups';

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
    <div className="overflow-x-auto -mx-1 rounded-xl border border-border">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead>
          <tr className="bg-white/[0.03] border-b-2 border-gold">
            {table.headers.map((h) => (
              <th
                key={h}
                className={`text-left mdtype-overline py-2.5 px-3 whitespace-nowrap text-textFaint ${
                  isMoneyColumn(h) || isDataColumn(h) || isPercentColumn(h) || isOccupancyColumn(h) ? 'text-right' : ''
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
                  : `border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`
              }
            >
              {table.headers.map((h) => {
                const value = String(row[h] ?? '');
                if (isPercentColumn(h)) {
                  return (
                    <td key={h} className="py-2.5 px-3 whitespace-nowrap text-right">
                      <span className="inline-flex font-stat font-bold text-[13px] tabular-nums bg-gold/[0.14] text-gold px-2.5 py-1 rounded-full">
                        {value}
                      </span>
                    </td>
                  );
                }
                if (isOccupancyColumn(h)) {
                  return (
                    <td
                      key={h}
                      className={`py-2.5 px-3 whitespace-nowrap text-right font-stat font-bold text-[13px] tabular-nums ${occupancyColorClass(value)}`}
                    >
                      {value}
                    </td>
                  );
                }
                return (
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
                    {value}
                  </td>
                );
              })}
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

// One option row, shared by all three sections below so the "Tracked
// Days" / "Box Office" / "Advance" lists read as one consistent list
// rather than three differently-styled ones.
function HeadingOption({
  g,
  meta,
  isActive,
  isLatest,
  date,
  onSelect
}: {
  g: Group;
  meta: { label: string; icon: LucideIcon };
  isActive: boolean;
  isLatest: boolean;
  date?: string;
  onSelect: () => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      className={`w-full flex items-center justify-between gap-2.5 text-sm px-4 py-3 text-left transition ${
        isActive ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-white/[0.05] hover:text-text'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <Icon size={16} strokeWidth={2.25} className="flex-none" />
        <span className="truncate">
          {meta.label}
          {date && <span className="text-textFaint font-normal"> — {date}</span>}
        </span>
      </span>
      <span className="flex-none flex items-center gap-1.5">
        {isLatest && (
          <span className="text-[10px] font-bold uppercase bg-goldDim/10 text-goldDim border border-goldDim/20 px-2 py-0.5 rounded-full">
            Latest
          </span>
        )}
        {isActive && <Check size={15} strokeWidth={2.75} className="text-gold" />}
      </span>
    </button>
  );
}

// Four independent, always-visible report/dimension controls in the
// "Performance breakdown" toolbar -- three report-category dropdowns
// (Tracked Days / Box Office / Advance) plus the separate State-wise
// CategoryDropdown further below. Each report-category button is its own
// always-visible control (not sections inside one combined dropdown), but
// all three drive the SAME single "which report is active" selection
// (TableGroups' own `heading` / `selectHeading`) -- there is exactly one
// active report at a time, and whichever category currently owns it shows
// itself in gold; the other two stay neutral with just their category
// name. ReportCategoryDropdown below is the one shared rendering engine
// for all three (same useDropdown/HeadingOption primitives, same active-
// label formatting the old combined dropdown used) so nothing about a
// single dropdown's open/close behaviour, list rendering, Latest badge,
// or date formatting is implemented three times -- TrackedDaysDropdown /
// BoxOfficeDropdown / AdvanceDropdown just supply their own category's
// filtered+sorted items and icon/label.
function reportItemMeta(category: HeadingCategory, heading: string): { label: string; icon: LucideIcon } {
  return category === 'day' ? { label: heading, icon: Film } : headingMeta(heading);
}

// Exactly the label text the old combined "Breakdown for:" dropdown used
// for its active value -- reused as-is so splitting the dropdown apart
// doesn't change what a selected report reads as. "Advance · 23 Sept"
// already names its own category, so it isn't prefixed again.
function activeReportLabel(category: HeadingCategory, heading: string, dayDateMap: Record<string, string>): string {
  const meta = reportItemMeta(category, heading);
  const date = category === 'day' ? dayDateMap[heading] : undefined;
  const itemLabel = date ? `${heading} — ${date}` : meta.label;
  if (category === 'day') return `Tracked Days · ${itemLabel}`;
  if (category === 'boxoffice') return `Box Office · ${itemLabel}`;
  return itemLabel;
}

function ReportCategoryDropdown({
  categoryKey,
  categoryLabel: label,
  icon: CategoryIcon,
  items,
  heading,
  dayDateMap,
  latest,
  onSelect
}: {
  categoryKey: HeadingCategory;
  categoryLabel: string;
  icon: LucideIcon;
  items: Group[];
  heading: string;
  dayDateMap: Record<string, string>;
  latest: string | null;
  onSelect: (h: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  if (items.length === 0) return null;

  const isOwner = categoryOf(heading) === categoryKey;
  const buttonLabel = isOwner ? activeReportLabel(categoryKey, heading, dayDateMap) : label;

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2.5 text-sm bg-surface border rounded-full h-[50px] pl-4 pr-3.5 transition ${
          isOwner ? 'border-gold/30 hover:border-gold/50' : 'border-border hover:border-gold/30'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CategoryIcon size={17} className={`flex-none ${isOwner ? 'text-gold' : 'text-textFaint'}`} />
          <span className={`truncate ${isOwner ? 'font-semibold text-gold' : 'text-textDim'}`}>{buttonLabel}</span>
        </span>
        <ChevronDown size={17} className={`text-textFaint flex-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 right-0 sm:right-auto mt-1.5 w-full sm:w-72 max-h-[22rem] overflow-y-auto bg-surface border border-border rounded-2xl shadow-card py-1.5"
        >
          {items.map((g) => (
            <HeadingOption
              key={g.heading}
              g={g}
              meta={reportItemMeta(categoryKey, g.heading)}
              isActive={isOwner && g.heading === heading}
              isLatest={g.heading === latest}
              date={categoryKey === 'day' ? dayDateMap[g.heading] : undefined}
              onSelect={() => {
                onSelect(g.heading);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Dropdown 1 -- "Tracked Days": every "Day N" this movie has (however many
// exist -- nothing hardcoded), each with its real scraped date and a
// Latest badge on the most recently tracked day. Shows nothing but day
// entries.
function TrackedDaysDropdown({
  groups,
  heading,
  dayDateMap,
  latest,
  onSelect
}: {
  groups: Group[];
  heading: string;
  dayDateMap: Record<string, string>;
  latest: string | null;
  onSelect: (h: string) => void;
}) {
  const items = groups
    .filter((g) => categoryOf(g.heading) === 'day')
    .slice()
    .sort((a, b) => dayNumber(a.heading)! - dayNumber(b.heading)!);
  return (
    <ReportCategoryDropdown
      categoryKey="day"
      categoryLabel="Tracked Days"
      icon={CalendarDays}
      items={items}
      heading={heading}
      dayDateMap={dayDateMap}
      latest={latest}
      onSelect={onSelect}
    />
  );
}

// Dropdown 2 -- "Box Office": Day-wise Collection / Other / Cumulative --
// All Days, in that fixed reading order. Shows nothing but box-office
// entries -- no tracked days, no advance dates.
function BoxOfficeDropdown({
  groups,
  heading,
  latest,
  onSelect
}: {
  groups: Group[];
  heading: string;
  latest: string | null;
  onSelect: (h: string) => void;
}) {
  const items = sortBoxOfficeHeadings(groups.filter((g) => categoryOf(g.heading) === 'boxoffice'));
  return (
    <ReportCategoryDropdown
      categoryKey="boxoffice"
      categoryLabel="Box Office"
      icon={BarChart3}
      items={items}
      heading={heading}
      dayDateMap={{}}
      latest={latest}
      onSelect={onSelect}
    />
  );
}

// Dropdown 3 -- "Advance": every "Advance <date>" this movie has,
// dynamically generated and chronologically sorted, oldest first. Shows
// nothing but advance dates -- no tracked days, no box-office entries.
function AdvanceDropdown({
  groups,
  heading,
  latest,
  onSelect
}: {
  groups: Group[];
  heading: string;
  latest: string | null;
  onSelect: (h: string) => void;
}) {
  const items = sortAdvanceHeadings(groups.filter((g) => categoryOf(g.heading) === 'advance'));
  return (
    <ReportCategoryDropdown
      categoryKey="advance"
      categoryLabel="Advance"
      icon={CalendarDays}
      items={items}
      heading={heading}
      dayDateMap={{}}
      latest={latest}
      onSelect={onSelect}
    />
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
                  isActive ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-white/[0.05] hover:text-text'
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
  const latest = useMemo(() => latestDayHeading(groups.map((g) => g.heading)), [groups]);

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
      <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center mb-4">
        <TrackedDaysDropdown groups={groups} heading={heading} dayDateMap={dayDateMap} latest={latest} onSelect={selectHeading} />
        <BoxOfficeDropdown groups={groups} heading={heading} latest={latest} onSelect={selectHeading} />
        <AdvanceDropdown groups={groups} heading={heading} latest={latest} onSelect={selectHeading} />
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
