'use client';

import { useMemo, useState } from 'react';
import type { ComparedTable, ComparisonMovie } from '@/lib/compare/types';
import { isMoneyColumn, isDataColumn, isPercentColumn, isOccupancyColumn, occupancyColorClass } from '@/lib/tableFormat';
import { movieDotClass, movieTextClass } from './movieColors';

// One merged, side-by-side table for a single ComparedCategory (e.g.
// "State-wise" for "Day 2", or "Cumulative" itself) across every selected
// movie -- rows are already matched by name and columns already unioned
// by lib/compare/buildComparison.ts's buildComparedTable(); this
// component only renders that result and adds click-to-sort. Column
// headers group by METRIC first (Gross, Occupancy, ...) with one
// dot-colored sub-column per movie underneath, so a person scanning one
// metric across movies reads it as one connected group rather than
// hunting across N separate per-movie tables. Reuses the exact same
// isMoneyColumn/isPercentColumn/isOccupancyColumn/isDataColumn/
// occupancyColorClass cell-styling rules components/TableGroups.tsx
// already uses for a single movie's own breakdown table, so a comparison
// table and a single-movie table read as the same design language.
type SortState = { column: string; movieIndex: number; dir: 'asc' | 'desc' } | null;

// Strips everything but digits/./- so values sharing a unit (all of one
// column are already the same TrackTollywood-reported unit, e.g. "₹1.20Cr")
// compare correctly by magnitude. A value TrackTollywood didn't publish
// (null) sorts to the bottom on both directions by using -Infinity and
// flipping the comparator, never mixed in as if it were a real 0.
function parseSortValue(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function compareSort(a: string | null, b: string | null, dir: 'asc' | 'desc'): number {
  const av = parseSortValue(a);
  const bv = parseSortValue(b);
  if (av == null && bv == null) return 0;
  if (av == null) return 1; // N/A always last, regardless of direction
  if (bv == null) return -1;
  return dir === 'asc' ? av - bv : bv - av;
}

export default function ComparisonTable({
  table,
  movies,
  className = ''
}: {
  table: ComparedTable;
  movies: ComparisonMovie[];
  className?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(() => {
    if (!sort) return table.rows;
    const { column, movieIndex, dir } = sort;
    return [...table.rows].sort((a, b) =>
      compareSort(a.valuesByColumn[column]?.[movieIndex] ?? null, b.valuesByColumn[column]?.[movieIndex] ?? null, dir)
    );
  }, [table, sort]);

  function toggleSort(column: string, movieIndex: number) {
    setSort((prev) => {
      if (prev && prev.column === column && prev.movieIndex === movieIndex) {
        return prev.dir === 'desc' ? { column, movieIndex, dir: 'asc' } : null;
      }
      return { column, movieIndex, dir: 'desc' };
    });
  }

  if (table.columns.length === 0 || table.rows.length === 0) return null;

  return (
    <div className={`overflow-x-auto -mx-1 rounded-xl border border-border ${className}`}>
      <table className="w-full text-xs border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-white/[0.03]">
            <th
              rowSpan={2}
              className="text-left mdtype-overline py-2.5 px-3 align-bottom text-textFaint border-b-2 border-gold whitespace-nowrap"
            >
              {table.nameColumn}
            </th>
            {table.columns.map((col) => (
              <th
                key={col}
                colSpan={movies.length}
                className="text-center mdtype-overline py-2 px-3 text-textFaint border-b border-border border-l border-l-border whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
          <tr className="bg-white/[0.03] border-b-2 border-gold">
            {table.columns.map((col) =>
              movies.map((m, mi) => {
                const active = sort?.column === col && sort.movieIndex === mi;
                return (
                  <th key={`${col}-${m.slug}`} className={`py-2 px-2 text-right whitespace-nowrap ${mi === 0 ? 'border-l border-l-border' : ''}`}>
                    <button
                      type="button"
                      onClick={() => toggleSort(col, mi)}
                      aria-label={`Sort ${col} by ${m.details.title}${active ? `, currently ${sort!.dir === 'desc' ? 'descending' : 'ascending'}` : ''}`}
                      title={m.details.title}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold transition ${
                        active ? movieTextClass(mi) : 'text-textFaint hover:text-textDim'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-none ${movieDotClass(mi)}`} />
                      {active ? (sort!.dir === 'desc' ? '▼' : '▲') : ''}
                    </button>
                  </th>
                );
              })
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.name}
              className={`border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${ri % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
            >
              <td className="py-2.5 px-3 whitespace-nowrap text-textDim font-medium">{row.name}</td>
              {table.columns.map((col) =>
                movies.map((m, mi) => {
                  const value = row.valuesByColumn[col]?.[mi] ?? null;
                  const cellBase = `py-2.5 px-2 whitespace-nowrap text-right ${mi === 0 ? 'border-l border-l-border' : ''}`;
                  if (value == null) {
                    return (
                      <td key={`${col}-${m.slug}`} className={`${cellBase} text-textFaint`}>
                        N/A
                      </td>
                    );
                  }
                  if (isPercentColumn(col)) {
                    return (
                      <td key={`${col}-${m.slug}`} className={cellBase}>
                        <span className="inline-flex font-stat font-bold text-[12px] tabular-nums bg-gold/[0.14] text-gold px-2 py-0.5 rounded-full">
                          {value}
                        </span>
                      </td>
                    );
                  }
                  if (isOccupancyColumn(col)) {
                    return (
                      <td key={`${col}-${m.slug}`} className={`${cellBase} font-stat font-bold text-[12px] tabular-nums ${occupancyColorClass(value)}`}>
                        {value}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={`${col}-${m.slug}`}
                      className={`${cellBase} ${
                        isMoneyColumn(col)
                          ? 'font-stat font-bold text-[13px] text-gold'
                          : isDataColumn(col)
                            ? 'font-body text-[12px] tabular-nums text-textDim'
                            : 'text-textDim'
                      }`}
                    >
                      {value}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
