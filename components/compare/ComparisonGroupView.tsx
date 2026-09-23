'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Globe, Languages, LayoutGrid, Clock, MapPin, BarChart3, ListFilter } from 'lucide-react';
import type { ComparedReportGroup, ComparisonMovie } from '@/lib/compare/types';
import { buildComparedTable } from '@/lib/compare/buildComparison';
import { pickDefaultCategory } from '@/lib/compare/category';
import { isMoneyColumn } from '@/lib/tableFormat';
import { EmptyState } from '@/components/ui';
import MovieLegend from './MovieLegend';
import ComparisonTable from './ComparisonTable';
import ComparisonChart from './ComparisonChart';

// Renders one active ComparedReportGroup (a "Day N", "Day-wise
// Collection", "Cumulative" or "Advance <date>" tab from ComparisonTabs)
// -- its sub-category picker (State-wise / Top Cities / Language-wise /
// ... -- only shown when the group actually has more than one), the
// release-relative-vs-calendar-date toggle (only for the Day-wise
// Collection group, and only when at least one movie's own table
// actually has a "Date" column), and the merged chart + table for
// whichever category is active. Mirrors components/TableGroups.tsx's own
// category-icon choices so a comparison category picker reads like the
// same control, just comparing N movies instead of one; pickDefaultCategory
// itself lives in lib/compare/category.ts, shared with the comparison
// poster builder so both default to the same breakdown.
function categoryIcon(category: string): LucideIcon {
  const c = category.toLowerCase();
  if (c.includes('state')) return Globe;
  if (c.includes('language')) return Languages;
  if (c.includes('format')) return LayoutGrid;
  if (c.includes('time')) return Clock;
  if (c.includes('cit')) return MapPin;
  if (c.includes('day-wise')) return BarChart3;
  return ListFilter;
}

export default function ComparisonGroupView({
  group,
  movies,
  align,
  onAlignChange
}: {
  group: ComparedReportGroup;
  movies: ComparisonMovie[];
  align: 'day' | 'date';
  onAlignChange: (align: 'day' | 'date') => void;
}) {
  const [category, setCategory] = useState(() => pickDefaultCategory(group.categories));

  // The active tab changed under us (a different heading was picked from
  // ComparisonTabs) -- re-resolve which of the NEW group's own categories
  // should be active rather than keeping a category name that belonged
  // to the old heading.
  useEffect(() => {
    setCategory(pickDefaultCategory(group.categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.heading]);

  const activeCategory = group.categories.find((c) => c.category === category) ?? group.categories[0];

  const isDayWiseCollection = group.heading === 'Day-wise Collection';
  const hasDateColumn = isDayWiseCollection && activeCategory?.tablesByMovie.some((t) => t?.headers.includes('Date'));

  const mergedTable = activeCategory
    ? buildComparedTable(activeCategory.tablesByMovie, hasDateColumn && align === 'date' ? { keyColumn: 'Date' } : undefined)
    : { nameColumn: '', columns: [], rows: [] };

  const chartColumn = mergedTable.columns.find(isMoneyColumn) ?? mergedTable.columns[0];

  if (!activeCategory || mergedTable.rows.length === 0) {
    return (
      <div>
        <MovieLegend movies={movies} className="mb-4" />
        <EmptyState>No {group.headingLabel.toLowerCase()} data has been published for these movies yet.</EmptyState>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <MovieLegend movies={movies} />
        {hasDateColumn && (
          <div className="flex items-center gap-1 bg-surface border border-border rounded-full p-1 flex-none">
            <button
              type="button"
              onClick={() => onAlignChange('day')}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 transition ${
                align === 'day' ? 'bg-gold text-white' : 'text-textDim hover:text-text'
              }`}
            >
              Day 1 vs Day 1
            </button>
            <button
              type="button"
              onClick={() => onAlignChange('date')}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 transition ${
                align === 'date' ? 'bg-gold text-white' : 'text-textDim hover:text-text'
              }`}
            >
              Calendar date
            </button>
          </div>
        )}
      </div>

      {group.categories.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 mb-4">
          {group.categories.map((c) => {
            const Icon = categoryIcon(c.category);
            const active = c.category === activeCategory.category;
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => setCategory(c.category)}
                className={`flex-none flex items-center gap-1.5 text-xs font-semibold rounded-full h-9 px-3.5 border transition ${
                  active ? 'bg-gold/[0.08] border-gold/30 text-gold' : 'bg-surface border-border text-textDim hover:border-gold/30'
                }`}
              >
                <Icon size={14} className={active ? 'text-gold' : 'text-textFaint'} />
                {c.category}
              </button>
            );
          })}
        </div>
      )}

      {chartColumn && <ComparisonChart table={mergedTable} column={chartColumn} movies={movies} className="mb-5" />}
      <ComparisonTable table={mergedTable} movies={movies} />
    </div>
  );
}
