'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info } from 'lucide-react';

// Building blocks of the Movie Stats dashboard. Layout and type scale follow
// a dense trading-dashboard pattern (chart cards with a legend of latest
// values, a stat strip, compact sortable tables); colors stay Fyre's black /
// zinc with the amber accent.

export function ChartCard({
  title,
  sub,
  right,
  legend,
  small = false,
  className = '',
  children
}: {
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  legend?: React.ReactNode;
  small?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-[10px] border border-white/10 bg-surface ${small ? 'p-4 sm:p-5' : 'p-4 sm:px-[26px] sm:py-6'} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className={`${small ? 'text-[15px]' : 'text-[17px]'} font-semibold leading-tight text-text`}>{title}</h3>
          {sub && <div className="mt-1 text-xs text-textFaint">{sub}</div>}
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {legend && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">{legend}</div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function LegendItem({ color, label, value, dashed = false }: { color: string; label: string; value?: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-textDim">
      <span className="inline-block w-4" style={{ borderTop: `${dashed ? '2px dashed' : '3px solid'} ${color}` }} />
      {label}
      {value != null && (
        <span className="font-mono text-base font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
      )}
    </span>
  );
}

export function Tag({ children, tone = 'amber', title }: { children: React.ReactNode; tone?: 'amber' | 'zinc' | 'red' | 'green'; title?: string }) {
  const t = {
    amber: 'bg-gold/[0.12] border-gold/25 text-gold',
    zinc: 'bg-white/[0.04] border-white/10 text-textDim',
    red: 'bg-red/[0.12] border-red/30 text-red',
    green: 'bg-goldDim/[0.12] border-goldDim/30 text-goldDim'
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-[9px] py-1 font-mono text-[11px] font-semibold uppercase leading-none tracking-wide ${t}`}>
      {children}
    </span>
  );
}

export type SegOption<T extends string> = { value: T; label: string; disabled?: boolean; reason?: string };

export function Segmented<T extends string>({ value, options, onChange, label, size = 'md' }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border border-white/10 bg-black p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.disabled ? o.reason ?? 'Not available' : undefined}
          onClick={() => onChange(o.value)}
          className={`whitespace-nowrap rounded-md font-semibold transition-colors ${size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-xs'} ${
            value === o.value ? 'bg-white text-black' : o.disabled ? 'cursor-not-allowed text-zinc-700 line-through decoration-zinc-700' : 'text-textDim hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, label, children, disabled = false, title }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-textFaint" title={title}>
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-[11rem] rounded-lg border border-white/10 bg-black px-2 font-mono text-xs text-text outline-none focus:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {children}
      </select>
    </label>
  );
}

export function Skeleton({ h = 200 }: { h?: number }) {
  return <div className="w-full animate-pulse rounded-lg bg-white/[0.035]" style={{ height: h }} aria-hidden />;
}

export function Empty({ children, h = 160 }: { children: React.ReactNode; h?: number }) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 px-6 text-center text-[13px] text-textFaint" style={{ minHeight: h }}>
      <Info size={16} className="text-zinc-600" />
      <div className="max-w-md">{children}</div>
    </div>
  );
}

// Loads its children only once scrolled near (lazy sections).
export function useInView<T extends HTMLElement>(margin = '300px') {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setSeen(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return { ref, seen };
}

// ---------------------------------------------------------------------------
// Dense table: sticky header, sortable columns, pager
// ---------------------------------------------------------------------------

export type Col<R> = { key: string; label: string; align?: 'left' | 'right'; sortable?: boolean; render: (r: R) => React.ReactNode; title?: string; className?: string };

export function DataTable<R>({
  cols,
  rows,
  rowKey,
  sort,
  dir,
  onSort,
  foot,
  rowClass,
  maxH = 560,
  caption
}: {
  cols: Col<R>[];
  rows: R[];
  rowKey: (r: R) => string;
  sort?: string;
  dir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  foot?: React.ReactNode;
  rowClass?: (r: R) => string;
  maxH?: number;
  caption: string;
}) {
  return (
    <div className="overflow-auto rounded-[14px] border border-white/[0.07] bg-[#0c0c0e]" style={{ maxHeight: maxH }}>
      <table className="w-full min-w-max border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-[#0c0c0e]">
          <tr className="border-b border-white/[0.07]">
            {cols.map((c, i) => {
              const active = sort === c.key;
              const s = c.sortable && onSort;
              return (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`whitespace-nowrap px-3 py-[13px] text-[11px] font-medium uppercase tracking-[0.33px] text-textFaint first:pl-4 last:pr-4 sm:px-5 sm:first:pl-5 sm:last:pr-5 ${c.align === 'right' ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 z-[2] bg-[#0c0c0e]' : ''}`}
                >
                  {s ? (
                    <button type="button" onClick={() => onSort!(c.key)} className={`inline-flex items-center gap-1 uppercase hover:text-text ${active ? 'text-text' : ''}`}>
                      {c.label}
                      {active && (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={`h-12 border-b border-white/[0.043] last:border-b-0 hover:bg-white/[0.02] ${rowClass?.(r) ?? ''}`}>
              {cols.map((c, i) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-3 font-mono text-[13px] tabular-nums text-zinc-200 first:pl-4 last:pr-4 sm:px-5 sm:first:pl-5 sm:last:pr-5 ${c.align === 'right' ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 bg-[#0c0c0e] font-sans' : ''} ${c.className ?? ''}`}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && <tfoot className="sticky bottom-0 bg-[#111114]">{foot}</tfoot>}
      </table>
    </div>
  );
}

export function Pager({ offset, limit, total, onPage, onLimit }: { offset: number; limit: number; total: number; onPage: (offset: number) => void; onLimit?: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;
  const btn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black text-textDim hover:text-text disabled:opacity-30 disabled:pointer-events-none';
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-textFaint">
      <span className="font-mono tabular-nums">
        {total === 0 ? 'No rows' : `Showing ${offset + 1}–${Math.min(total, offset + limit)} of ${total.toLocaleString('en-IN')}`}
      </span>
      <div className="flex items-center gap-2">
        {onLimit && (
          <select aria-label="Rows per page" value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="h-8 rounded-lg border border-white/10 bg-black px-2 font-mono text-xs text-text">
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
        <button type="button" aria-label="Previous page" className={btn} disabled={page <= 1} onClick={() => onPage(Math.max(0, offset - limit))}>
          <ChevronLeft size={15} />
        </button>
        <span className="font-mono tabular-nums text-text">
          {page} / {pages}
        </span>
        <button type="button" aria-label="Next page" className={btn} disabled={page >= pages} onClick={() => onPage(offset + limit)}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// Horizontal share bars (distribution cards).
export function ShareBars({ rows, format, color = '#fbbf24', emptyText }: { rows: { key: string; name: string; sub?: string | null; value: number; share: number | null; nested?: boolean; muted?: boolean }[]; format: (v: number) => string; color?: string; emptyText: string }) {
  if (!rows.length) return <Empty h={120}>{emptyText}</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className={r.nested ? 'pl-4' : ''}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className={`min-w-0 truncate ${r.muted ? 'text-textFaint' : 'text-zinc-200'}`}>
              {r.name}
              {r.sub && <span className="ml-1.5 text-[11px] text-textFaint">{r.sub}</span>}
            </span>
            <span className="flex-none font-mono tabular-nums text-text">
              {format(r.value)}
              {r.share != null && <span className="ml-2 inline-block w-12 text-right text-textFaint">{r.share.toFixed(1)}%</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: r.nested || r.muted ? 'rgba(161,161,170,0.45)' : color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
