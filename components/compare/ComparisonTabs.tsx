'use client';

import { ChevronDown, Check, LayoutGrid, Layers, CalendarDays, BarChart3 } from 'lucide-react';
import type { ComparedReportGroup } from '@/lib/compare/types';
import { type ComparisonMode } from '@/lib/compare/mode';
import { useDropdown } from './useDropdown';

// The primary "which report" tab row for a comparison, built entirely
// from the union of report-group headings the selected movies actually
// have (ComparedReportGroup[] from lib/compare/buildComparison.ts) --
// never a fixed list of tabs. A movie selection with no Advance data
// anywhere simply never shows an Advance control; a 2-movie comparison
// where neither has a Cumulative table never shows a Cumulative tab.
// Mirrors the reading order and dropdown mechanics
// components/TableGroups.tsx's own three report-category dropdowns
// already use on the single-movie page, adapted for a comparison of
// several movies instead of one.
//
// ComparisonMode itself, and the modeKey/modeFromKey/defaultMode helpers
// that convert it to and from the /compare page's `?mode=` URL param,
// live in lib/compare/mode.ts (plain TS, no 'use client') rather than
// here, so the Server Component that parses the initial URL doesn't have
// to import a client-only module just to read a type.
export type { ComparisonMode };

function TabPill({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none flex items-center gap-2 text-sm rounded-full h-[46px] px-4 border transition ${
        active ? 'bg-gold/[0.08] border-gold/30 text-gold font-semibold' : 'bg-surface border-border text-textDim hover:border-gold/30'
      }`}
    >
      <Icon size={16} className={active ? 'text-gold' : 'text-textFaint'} />
      {children}
    </button>
  );
}

function HeadingDropdown({
  label,
  icon: Icon,
  headings,
  activeHeading,
  onSelect
}: {
  label: string;
  icon: any;
  headings: { heading: string; headingLabel: string }[];
  activeHeading: string | null;
  onSelect: (heading: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();
  if (headings.length === 0) return null;
  const activeItem = headings.find((h) => h.heading === activeHeading);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex items-center gap-2 text-sm rounded-full h-[46px] pl-4 pr-3 border transition ${
          activeItem ? 'bg-gold/[0.08] border-gold/30 text-gold font-semibold' : 'bg-surface border-border text-textDim hover:border-gold/30'
        }`}
      >
        <Icon size={16} className={activeItem ? 'text-gold' : 'text-textFaint'} />
        <span className="whitespace-nowrap">{activeItem ? activeItem.headingLabel : label}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 left-0 mt-1.5 w-56 max-h-72 overflow-y-auto bg-surface border border-border rounded-2xl shadow-card py-1.5"
        >
          {headings.map((h) => (
            <button
              key={h.heading}
              type="button"
              role="option"
              aria-selected={h.heading === activeHeading}
              onClick={() => {
                onSelect(h.heading);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 text-sm px-4 py-2.5 text-left transition ${
                h.heading === activeHeading ? 'bg-gold/[0.08] text-gold font-semibold' : 'text-textDim hover:bg-white/[0.05] hover:text-text'
              }`}
            >
              {h.headingLabel}
              {h.heading === activeHeading && <Check size={14} className="text-gold flex-none" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComparisonTabs({
  groups,
  mode,
  onChange
}: {
  groups: ComparedReportGroup[];
  mode: ComparisonMode;
  onChange: (mode: ComparisonMode) => void;
}) {
  const hasCollections = groups.some((g) => g.heading === 'Day-wise Collection');
  const hasCumulative = groups.some((g) => g.heading === 'Cumulative');
  const dayHeadings = groups.filter((g) => g.category === 'day').map((g) => ({ heading: g.heading, headingLabel: g.headingLabel }));
  const advanceHeadings = groups.filter((g) => g.category === 'advance').map((g) => ({ heading: g.heading, headingLabel: g.headingLabel }));

  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 mb-4">
      <TabPill active={mode.kind === 'overview'} onClick={() => onChange({ kind: 'overview' })} icon={LayoutGrid}>
        Overview
      </TabPill>
      {hasCollections && (
        <TabPill active={mode.kind === 'collections'} onClick={() => onChange({ kind: 'collections' })} icon={BarChart3}>
          Collections
        </TabPill>
      )}
      <HeadingDropdown
        label="Day-wise"
        icon={CalendarDays}
        headings={dayHeadings}
        activeHeading={mode.kind === 'day' ? mode.heading : null}
        onSelect={(heading) => onChange({ kind: 'day', heading })}
      />
      {hasCumulative && (
        <TabPill active={mode.kind === 'cumulative'} onClick={() => onChange({ kind: 'cumulative' })} icon={Layers}>
          Cumulative
        </TabPill>
      )}
      <HeadingDropdown
        label="Advance"
        icon={CalendarDays}
        headings={advanceHeadings}
        activeHeading={mode.kind === 'advance' ? mode.heading : null}
        onSelect={(heading) => onChange({ kind: 'advance', heading })}
      />
    </div>
  );
}
