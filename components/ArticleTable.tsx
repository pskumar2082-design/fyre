import type { ParsedTable } from '@/lib/articleTable';
import { isMoneyColumn, isDataColumn, isPercentColumn, isOccupancyColumn, occupancyColorClass } from '@/lib/tableFormat';

// A hand-authored table embedded in a news article or review -- same visual
// language as the TrackTollywood breakdown tables (components/TableGroups.tsx's
// TableView) so a comparison table an admin builds for an article reads as
// the same design system as the rest of the site, not a generic markdown
// table dropped into the page.
export default function ArticleTable({ table }: { table: ParsedTable }) {
  return (
    <div className="overflow-x-auto my-6 -mx-1 rounded-xl border border-border">
      <table className="w-full text-xs border-collapse min-w-[420px]">
        <thead>
          <tr className="bg-white/[0.03] border-b-2 border-gold">
            {table.headers.map((h, i) => (
              <th
                key={i}
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
          {table.rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-border last:border-b-0 hover:bg-white/[0.03] transition ${
        i % 2 === 1 ? 'bg-white/[0.015]' : ''
      }`}
            >
              {table.headers.map((h, j) => {
                const value = String(row[j] ?? '');
                if (isPercentColumn(h)) {
                  return (
                    <td key={j} className="py-2.5 px-3 whitespace-nowrap text-right">
                      <span className="inline-flex font-stat font-bold text-[13px] tabular-nums bg-gold/[0.14] text-gold px-2.5 py-1 rounded-full">
                        {value}
                      </span>
                    </td>
                  );
                }
                if (isOccupancyColumn(h)) {
                  return (
                    <td
                      key={j}
                      className={`py-2.5 px-3 whitespace-nowrap text-right font-stat font-bold text-[13px] tabular-nums ${occupancyColorClass(value)}`}
                    >
                      {value}
                    </td>
                  );
                }
                return (
                  <td
                    key={j}
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      isMoneyColumn(h)
                        ? 'text-right font-stat font-bold text-gold'
                        : isDataColumn(h)
                          ? 'text-right font-body text-[13px] leading-[1.3] tabular-nums text-textDim'
                          : 'text-textDim'
                    }`}
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
