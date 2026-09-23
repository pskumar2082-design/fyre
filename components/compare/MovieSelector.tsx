'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import type { TTListedMovie } from '@/lib/tracktollywood/types';
import { STATE_LABEL } from '@/lib/tracktollywood/stateStyle';
import { filterMovieCatalog } from '@/lib/compare/useMovieCatalog';
import { useDropdown } from './useDropdown';

// Searchable movie picker shared by /compare, the home page's compact
// comparison section, and the admin Social Poster tool's comparison
// mode -- one component so all three pick movies the same way. Shows a
// poster thumbnail, title, release date (TrackTollywood's own
// "Released 18 Sep 2026" / "Releasing 25 Sep 2026" text, which already
// carries the year) and genre to disambiguate two movies that share a
// title (a dub, a remake) -- see the component-level note below on why
// language isn't shown at this list-picker stage.

export type MovieSelectorProps = {
  movies: TTListedMovie[];
  loading: boolean;
  error?: string | null;
  selected: TTListedMovie | null;
  onSelect: (movie: TTListedMovie) => void;
  onClear?: () => void;
  // Slugs already chosen by OTHER selectors in this comparison -- shown
  // disabled in the list rather than removed, so a person can see why a
  // movie isn't pickable instead of it just silently vanishing.
  excludeSlugs?: string[];
  label: string;
  placeholder?: string;
  className?: string;
};

export default function MovieSelector({
  movies,
  loading,
  error,
  selected,
  onSelect,
  onClear,
  excludeSlugs = [],
  label,
  placeholder = 'Select a movie',
  className = ''
}: MovieSelectorProps) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterMovieCatalog(movies, query), [movies, query]);

  function pick(movie: TTListedMovie) {
    onSelect(movie);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <div className="text-xs text-textFaint mb-1.5">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center justify-between gap-2.5 text-sm bg-surface border border-border rounded-xl h-[54px] pl-2.5 pr-3.5 transition hover:border-gold/30"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {selected ? (
            <>
              <span className="w-9 h-9 flex-none rounded-lg overflow-hidden bg-surface2 border border-border relative">
                {selected.poster && <Image src={selected.poster} alt="" fill unoptimized className="object-cover object-top" />}
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-medium text-text truncate max-w-[180px]">{selected.title}</span>
                <span className="block text-[11px] text-textFaint truncate max-w-[180px]">
                  {STATE_LABEL[selected.state]}
                  {selected.releaseText ? ` · ${selected.releaseText}` : ''}
                </span>
              </span>
            </>
          ) : (
            <>
              <Search size={16} className="text-textFaint flex-none" />
              <span className="text-textFaint truncate">{placeholder}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5 flex-none">
          {selected && onClear && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onClear();
                }
              }}
              aria-label={`Clear ${label}`}
              className="w-6 h-6 flex items-center justify-center rounded-full text-textFaint hover:text-text hover:bg-white/[0.06]"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`text-textFaint transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 left-0 right-0 mt-1.5 bg-surface border border-border rounded-2xl shadow-card overflow-hidden"
        >
          <div className="p-2.5 border-b border-border">
            <div className="flex items-center gap-2 bg-bg rounded-lg h-10 px-3">
              <Search size={15} className="text-textFaint flex-none" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies…"
                className="bg-transparent outline-none text-sm text-text placeholder:text-textFaint w-full"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-4 text-xs text-textFaint">Loading movies…</div>
            ) : error ? (
              <div className="px-4 py-4 text-xs text-red">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-4 text-xs text-textFaint">No movies found{query ? ` for “${query}”` : ''}.</div>
            ) : (
              filtered.map((m) => {
                const disabled = excludeSlugs.includes(m.slug) && selected?.slug !== m.slug;
                const isActive = selected?.slug === m.slug;
                return (
                  <button
                    key={m.slug}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={disabled}
                    onClick={() => pick(m)}
                    className={`w-full flex items-center gap-2.5 text-left px-3 py-2 transition ${
                      disabled
                        ? 'opacity-35 cursor-not-allowed'
                        : isActive
                          ? 'bg-gold/[0.08]'
                          : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="w-9 h-12 flex-none rounded-md overflow-hidden bg-surface2 border border-border relative">
                      {m.poster && <Image src={m.poster} alt="" fill unoptimized className="object-cover object-top" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="block font-medium text-text truncate text-sm">{m.title}</span>
                        {isActive && <Check size={13} className="text-gold flex-none" />}
                      </span>
                      <span className="block text-[11px] text-textFaint truncate">
                        {[STATE_LABEL[m.state], m.releaseText, m.genre].filter(Boolean).join(' · ')}
                        {disabled ? ' · already selected' : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
