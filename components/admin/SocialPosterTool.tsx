import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Globe, Languages, LayoutGrid, Clock, MapPin, BarChart3, ListFilter } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TTMovieDetails, TTListedMovie } from '@/lib/tracktollywood/types';
import { listAvailableReports } from '@/lib/poster/build';
import { buildPosterFilename, buildComparisonPosterFilename } from '@/lib/poster/filename';
import type { ComparisonPosterFormat } from '@/lib/poster/types';
import type { ComparisonMovie, ComparedTable } from '@/lib/compare/types';
import { buildComparison, buildComparedTable } from '@/lib/compare/buildComparison';
import { modeKey, modeFromKey } from '@/lib/compare/mode';
import { pickDefaultCategory } from '@/lib/compare/category';
import { SLUG_PARAMS, MAX_COMPARE_MOVIES } from '@/lib/compare/urlParams';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import MovieSelector from '@/components/compare/MovieSelector';
import ComparisonTabs from '@/components/compare/ComparisonTabs';

// Turns any TrackTollywood-tracked movie's live data into a branded,
// downloadable poster image (app/api/social-poster/[slug]/route.tsx does
// the actual rendering via next/og) -- built for posting a box-office
// update on X without hand-designing a graphic every time.
//
// Deliberately thin: this component only fetches the movie's data once
// (via the existing /api/tracktollywood/[slug] endpoint -- the same JSON
// the movie detail page itself is built from) to populate the Report /
// Breakdown pickers, then points an <img> straight at the same route
// Download PNG fetches from. Preview and export can never drift apart
// because they're the same request.
//
// Comparison mode (added alongside, same tab -- no new admin tab per the
// task) works identically: it points its own preview <img> at
// app/api/social-poster/compare/route.tsx, built from the SAME
// lib/compare/buildComparison.ts view model and lib/compare/mode.ts
// ComparisonMode the live /compare page uses (see ComparisonTabs and the
// category/align controls below, copied from
// components/compare/ComparisonGroupView.tsx's own JSX so this reads as
// the same control rather than a re-invented one), so there is still
// exactly one comparison-calculation pipeline in the whole app.
type RowsMode = 'all' | '5' | '10' | 'custom';
type PosterMode = 'single' | 'comparison';
type CmpSlot = { listed: TTListedMovie; details: TTMovieDetails | null; loading: boolean; error: string | null };

function buildPosterUrl(slug: string, tableLabel: string, rows: RowsMode, customRows: string, watermark: boolean, cacheBust?: number): string {
  const params = new URLSearchParams();
  params.set('table', tableLabel);
  if (rows === 'all') params.set('rows', 'all');
  else if (rows === 'custom') params.set('rows', String(Math.max(1, Number(customRows) || 10)));
  else params.set('rows', rows);
  if (!watermark) params.set('watermark', '0');
  if (cacheBust) params.set('t', String(cacheBust));
  return `/api/social-poster/${encodeURIComponent(slug)}?${params.toString()}`;
}

// Same query-param contract app/api/social-poster/compare/route.tsx
// already parses (a/b/c/d slugs, mode, category, align, metrics, rows,
// format, watermark) -- this only ever builds a URL to that existing
// route, never duplicates its rendering.
function buildComparisonPosterUrl(
  slugs: string[],
  modeKeyStr: string,
  category: string | null,
  align: 'day' | 'date',
  metrics: string[],
  allMetrics: string[],
  rows: RowsMode,
  customRows: string,
  format: ComparisonPosterFormat,
  watermark: boolean,
  cacheBust?: number
): string {
  const params = new URLSearchParams();
  slugs.forEach((slug, i) => {
    if (SLUG_PARAMS[i]) params.set(SLUG_PARAMS[i], slug);
  });
  if (modeKeyStr !== 'overview') params.set('mode', modeKeyStr);
  if (category) params.set('category', category);
  if (align === 'date') params.set('align', 'date');
  // Only a REAL subset is worth telling the server about -- "everything
  // selected" should behave exactly like "no filter" (all published
  // columns), not accidentally lock out a column the report adds later.
  if (metrics.length > 0 && metrics.length < allMetrics.length) params.set('metrics', metrics.join(','));
  if (rows === 'all') params.set('rows', 'all');
  else if (rows === 'custom') params.set('rows', String(Math.max(1, Number(customRows) || 10)));
  else params.set('rows', rows);
  if (format !== 'auto') params.set('format', format);
  if (!watermark) params.set('watermark', '0');
  if (cacheBust) params.set('t', String(cacheBust));
  return `/api/social-poster/compare?${params.toString()}`;
}

// Same icon choices as components/compare/ComparisonGroupView.tsx's own
// category picker, so a category pill here reads as the same control.
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

export default function SocialPosterTool() {
  const [posterMode, setPosterMode] = useState<PosterMode>('single');

  // ---------------------------------------------------------------------
  // Single-movie mode -- unchanged from before Comparison mode existed.
  // ---------------------------------------------------------------------
  const [slugInput, setSlugInput] = useState('');
  const [loadedSlug, setLoadedSlug] = useState('');
  const [details, setDetails] = useState<TTMovieDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [heading, setHeading] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [rowsMode, setRowsMode] = useState<RowsMode>('all');
  const [customRows, setCustomRows] = useState('10');
  const [watermark, setWatermark] = useState(true);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const reports = details ? listAvailableReports(details) : [];
  const activeGroup = reports.find((r) => r.heading === heading);

  async function loadMovie(e: React.FormEvent) {
    e.preventDefault();
    const slug = slugInput.trim().toLowerCase();
    if (!slug) return;
    setLoading(true);
    setLoadError('');
    setDetails(null);
    setPreviewUrl(null);
    try {
      const res = await fetch(`/api/tracktollywood/${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? `Could not load "${slug}".`);
        return;
      }
      const d = json as TTMovieDetails;
      setDetails(d);
      setLoadedSlug(slug);

      const groups = listAvailableReports(d);
      if (groups.length === 0) {
        setLoadError(`${d.title} doesn't have any tracked breakdown tables yet -- nothing to post.`);
        return;
      }
      // Default to the most recent report group, and within it, prefer
      // State-wise (this feature's original use case) if the movie
      // publishes one, otherwise just the first available breakdown.
      const defaultGroup = groups[groups.length - 1];
      const defaultCategory = defaultGroup.categories.find((c) => c.category === 'State-wise') ?? defaultGroup.categories[0];
      setHeading(defaultGroup.heading);
      setTableLabel(defaultCategory.tableLabel);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Could not reach TrackTollywood right now.');
    } finally {
      setLoading(false);
    }
  }

  function selectHeading(h: string) {
    setHeading(h);
    setPreviewUrl(null);
    const group = reports.find((r) => r.heading === h);
    const firstCategory = group?.categories.find((c) => c.category === 'State-wise') ?? group?.categories[0];
    if (firstCategory) setTableLabel(firstCategory.tableLabel);
  }

  function refreshPreview() {
    if (!loadedSlug || !tableLabel) return;
    setImgError(false);
    setDownloadError('');
    setPreviewUrl(buildPosterUrl(loadedSlug, tableLabel, rowsMode, customRows, watermark, Date.now()));
  }

  async function downloadPng() {
    if (!previewUrl) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await fetch(previewUrl);
      if (!res.ok) {
        setDownloadError(await res.text());
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = buildPosterFilename(loadedSlug, tableLabel);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setDownloadError(err?.message ?? 'Image generation failed.');
    } finally {
      setDownloading(false);
    }
  }

  // ---------------------------------------------------------------------
  // Comparison mode -- 2 to MAX_COMPARE_MOVIES (4) movie slots loaded the
  // same way app/compare/ComparePageClient.tsx loads them (its own
  // per-slot request-id guard against a rapid re-pick landing out of
  // order), fed through the SAME buildComparison()/buildComparedTable()
  // adapter the live page and the home page teaser already share, so a
  // poster's numbers can never quietly disagree with the site.
  // ---------------------------------------------------------------------
  const catalog = useMovieCatalog();
  const [cmpSlots, setCmpSlots] = useState<CmpSlot[]>([]);
  const [cmpVisibleCount, setCmpVisibleCount] = useState(2);
  const cmpRequestIdsRef = useRef<number[]>([0, 0, 0, 0]);

  function invalidateAllCmpRequests() {
    cmpRequestIdsRef.current = cmpRequestIdsRef.current.map((n) => n + 1);
  }

  function selectCmpMovie(index: number, listed: TTListedMovie) {
    const myId = ++cmpRequestIdsRef.current[index];
    setCmpSlots((prev) => {
      const next = prev.slice();
      next[index] = { listed, details: null, loading: true, error: null };
      return next;
    });
    setCmpPreviewUrl(null);

    fetch(`/api/tracktollywood/${encodeURIComponent(listed.slug)}`)
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => null) }))
      .then(({ ok, json }) => {
        if (cmpRequestIdsRef.current[index] !== myId) return;
        setCmpSlots((prev) => {
          if (!prev[index] || prev[index].listed.slug !== listed.slug) return prev;
          const next = prev.slice();
          next[index] =
            ok && json
              ? { listed, details: json as TTMovieDetails, loading: false, error: null }
              : { listed, details: null, loading: false, error: json?.error ?? 'Could not load this movie right now.' };
          return next;
        });
      })
      .catch((err: any) => {
        if (cmpRequestIdsRef.current[index] !== myId) return;
        setCmpSlots((prev) => {
          if (!prev[index] || prev[index].listed.slug !== listed.slug) return prev;
          const next = prev.slice();
          next[index] = { listed, details: null, loading: false, error: err?.message ?? 'Could not load this movie right now.' };
          return next;
        });
      });
  }

  function clearCmpMovie(index: number) {
    invalidateAllCmpRequests();
    setCmpSlots((prev) => prev.filter((_, i) => i !== index));
    setCmpPreviewUrl(null);
  }

  function addCmpSlot() {
    setCmpVisibleCount((v) => Math.min(MAX_COMPARE_MOVIES, v + 1));
  }

  function removeCmpSlot() {
    setCmpVisibleCount((v) => {
      const nextCount = Math.max(2, v - 1);
      if (cmpSlots.length > nextCount) {
        invalidateAllCmpRequests();
        setCmpSlots((prev) => prev.slice(0, nextCount));
      }
      return nextCount;
    });
  }

  const activeCmpMovies: ComparisonMovie[] = useMemo(
    () =>
      cmpSlots
        .filter((s): s is CmpSlot & { details: TTMovieDetails } => s.details != null)
        .map((s) => ({ slug: s.listed.slug, details: s.details })),
    [cmpSlots]
  );
  const cmpVm = useMemo(() => buildComparison(activeCmpMovies), [activeCmpMovies]);

  const [cmpModeKeyRaw, setCmpModeKeyRaw] = useState('overview');
  const cmpMode = useMemo(() => modeFromKey(cmpModeKeyRaw, cmpVm.groups), [cmpModeKeyRaw, cmpVm.groups]);
  const [cmpAlign, setCmpAlign] = useState<'day' | 'date'>('day');

  const cmpHeading: string | null =
    cmpMode.kind === 'overview' ? null : cmpMode.kind === 'collections' ? 'Day-wise Collection' : cmpMode.kind === 'cumulative' ? 'Cumulative' : cmpMode.heading;
  const cmpGroup = cmpHeading ? (cmpVm.groups.find((g) => g.heading === cmpHeading) ?? null) : null;

  const [cmpCategory, setCmpCategory] = useState<string | null>(null);
  useEffect(() => {
    setCmpCategory(cmpGroup ? pickDefaultCategory(cmpGroup.categories) : null);
    setCmpPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmpGroup?.heading]);

  const activeCmpCategory = cmpGroup?.categories.find((c) => c.category === cmpCategory) ?? cmpGroup?.categories[0] ?? null;
  const cmpHasDateColumn = cmpHeading === 'Day-wise Collection' && !!activeCmpCategory?.tablesByMovie.some((t) => t?.headers.includes('Date'));
  const cmpMergedTable: ComparedTable = activeCmpCategory
    ? buildComparedTable(activeCmpCategory.tablesByMovie, cmpHasDateColumn && cmpAlign === 'date' ? { keyColumn: 'Date' } : undefined)
    : { nameColumn: '', columns: [], rows: [] };

  // Defaults to every published column whenever the active report/
  // category changes -- a person opts OUT of a column, rather than
  // having to opt every column back in from an empty state.
  const [cmpMetrics, setCmpMetrics] = useState<string[]>([]);
  useEffect(() => {
    setCmpMetrics(cmpMergedTable.columns);
    setCmpPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmpMergedTable.columns.join('|')]);

  function toggleCmpMetric(col: string) {
    setCmpMetrics((prev) => {
      if (prev.includes(col)) {
        if (prev.length <= 1) return prev; // a poster needs at least one column
        return prev.filter((c) => c !== col);
      }
      return cmpMergedTable.columns.filter((c) => c === col || prev.includes(c));
    });
    setCmpPreviewUrl(null);
  }

  const cmpReportLine =
    cmpMode.kind === 'overview'
      ? 'Overview'
      : cmpGroup
        ? cmpGroup.categories.length > 1 && activeCmpCategory
          ? `${cmpGroup.headingLabel} — ${activeCmpCategory.category}`
          : cmpGroup.headingLabel
        : '';

  const [cmpRowsMode, setCmpRowsMode] = useState<RowsMode>('all');
  const [cmpCustomRows, setCmpCustomRows] = useState('10');
  const [cmpFormat, setCmpFormat] = useState<ComparisonPosterFormat>('auto');

  const [cmpPreviewUrl, setCmpPreviewUrl] = useState<string | null>(null);
  const [cmpImgError, setCmpImgError] = useState(false);
  const [cmpDownloading, setCmpDownloading] = useState(false);
  const [cmpDownloadError, setCmpDownloadError] = useState('');

  function refreshCmpPreview() {
    if (activeCmpMovies.length < 2) return;
    setCmpImgError(false);
    setCmpDownloadError('');
    setCmpPreviewUrl(
      buildComparisonPosterUrl(
        activeCmpMovies.map((m) => m.slug),
        modeKey(cmpMode),
        activeCmpCategory?.category ?? null,
        cmpAlign,
        cmpMetrics,
        cmpMergedTable.columns,
        cmpRowsMode,
        cmpCustomRows,
        cmpFormat,
        watermark,
        Date.now()
      )
    );
  }

  async function downloadCmpPng() {
    if (!cmpPreviewUrl) return;
    setCmpDownloading(true);
    setCmpDownloadError('');
    try {
      const res = await fetch(cmpPreviewUrl);
      if (!res.ok) {
        setCmpDownloadError(await res.text());
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = buildComparisonPosterFilename(
        activeCmpMovies.map((m) => m.slug),
        cmpReportLine
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setCmpDownloadError(err?.message ?? 'Image generation failed.');
    } finally {
      setCmpDownloading(false);
    }
  }

  const cmpSelectedSlugs = cmpSlots.map((s) => s.listed.slug);
  const cmpSelectorIndices = Array.from({ length: Math.max(cmpVisibleCount, cmpSlots.length) }, (_, i) => i);

  return (
    <div className="max-w-2xl">
      <div className="flex gap-1.5 bg-bg rounded-lg p-1 mb-5 w-fit">
        {(['single', 'comparison'] as PosterMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPosterMode(m)}
            className={`text-xs font-semibold rounded-md px-4 py-2 transition ${
              posterMode === m ? 'bg-gold text-white' : 'text-textDim'
            }`}
          >
            {m === 'single' ? 'Single movie' : 'Comparison'}
          </button>
        ))}
      </div>

      {posterMode === 'single' && (
        <>
          <p className="text-sm text-textDim mb-4">
            Enter a movie's TrackTollywood slug (the last part of its URL, e.g. <code>the-paradise</code> from{' '}
            <code>/movie/the-paradise</code>) to build a shareable poster from its current live data.
          </p>

          <form onSubmit={loadMovie} className="flex gap-3 mb-4">
            <input
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              placeholder="the-paradise"
              className="bg-bg rounded-lg px-4 py-3 text-sm flex-1"
            />
            <button type="submit" disabled={loading} className="bg-gold text-white font-semibold rounded-lg px-6 py-2.5 text-sm disabled:opacity-50">
              {loading ? 'Loading…' : 'Load movie'}
            </button>
          </form>

          {loadError && <p className="text-red text-xs mb-4">{loadError}</p>}

          {details && reports.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 mb-6">
              <div className="font-medium text-text">{details.title}</div>

              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-textFaint block mb-1.5">Report</label>
                  <select
                    value={heading}
                    onChange={(e) => selectHeading(e.target.value)}
                    className="bg-bg rounded-lg px-4 py-3 text-sm w-full"
                  >
                    {reports.map((r) => (
                      <option key={r.heading} value={r.heading}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-textFaint block mb-1.5">Breakdown</label>
                  <select
                    value={tableLabel}
                    onChange={(e) => {
                      setTableLabel(e.target.value);
                      setPreviewUrl(null);
                    }}
                    className="bg-bg rounded-lg px-4 py-3 text-sm w-full"
                  >
                    {(activeGroup?.categories ?? []).map((c) => (
                      <option key={c.tableLabel} value={c.tableLabel}>
                        {c.category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="text-xs text-textFaint block mb-1.5">Rows</label>
                  <div className="flex gap-1.5 bg-bg rounded-lg p-1">
                    {(['all', '5', '10', 'custom'] as RowsMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setRowsMode(mode);
                          setPreviewUrl(null);
                        }}
                        className={`text-xs font-semibold rounded-md px-3 py-2 transition ${
                          rowsMode === mode ? 'bg-gold text-white' : 'text-textDim'
                        }`}
                      >
                        {mode === 'all' ? 'All' : mode === 'custom' ? 'Custom' : `Top ${mode}`}
                      </button>
                    ))}
                  </div>
                </div>
                {rowsMode === 'custom' && (
                  <input
                    type="number"
                    min={1}
                    value={customRows}
                    onChange={(e) => {
                      setCustomRows(e.target.value);
                      setPreviewUrl(null);
                    }}
                    className="bg-bg rounded-lg px-4 py-3 text-sm w-24"
                  />
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-xs text-textFaint">Watermark</label>
                  <button
                    type="button"
                    onClick={() => {
                      setWatermark((w) => !w);
                      setPreviewUrl(null);
                      setCmpPreviewUrl(null);
                    }}
                    className={`w-11 h-6 rounded-full transition relative flex-none ${watermark ? 'bg-gold' : 'bg-bg border border-border'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition ${watermark ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={refreshPreview} className="bg-navy text-white font-semibold rounded-lg px-5 py-2.5 text-sm">
                  Refresh preview
                </button>
                <button
                  type="button"
                  onClick={downloadPng}
                  disabled={!previewUrl || downloading}
                  className="bg-gold text-white font-semibold rounded-lg px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  {downloading ? 'Preparing…' : 'Download PNG'}
                </button>
              </div>
              {downloadError && <p className="text-red text-xs">{downloadError}</p>}
            </div>
          )}

          {previewUrl && (
            <div className="bg-bg rounded-2xl p-4 overflow-auto">
              {imgError ? (
                <p className="text-red text-xs">Couldn't generate that poster. Try different Report/Breakdown settings.</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Poster preview"
                  onError={() => setImgError(true)}
                  className="rounded-xl border border-border mx-auto"
                  style={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block' }}
                />
              )}
            </div>
          )}
        </>
      )}

      {posterMode === 'comparison' && (
        <>
          <p className="text-sm text-textDim mb-4">
            Pick 2 to {MAX_COMPARE_MOVIES} movies to build a shareable Movie vs Movie poster from their current live data -- the
            same comparison this poster is built from as the <code>/compare</code> page itself.
          </p>

          <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cmpSelectorIndices.map((i) => {
                const slot = cmpSlots[i];
                return (
                  <div key={i}>
                    <MovieSelector
                      movies={catalog.movies}
                      loading={catalog.loading}
                      error={catalog.error}
                      selected={slot?.listed ?? null}
                      onSelect={(m) => selectCmpMovie(i, m)}
                      onClear={slot ? () => clearCmpMovie(i) : undefined}
                      excludeSlugs={cmpSelectedSlugs.filter((s) => s !== slot?.listed.slug)}
                      label={`Movie ${String.fromCharCode(65 + i)}`}
                    />
                    {slot?.loading && <div className="text-[11px] text-textFaint mt-1.5">Loading {slot.listed.title}…</div>}
                    {slot?.error && <div className="text-[11px] text-red mt-1.5">{slot.error}</div>}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-3.5">
              {cmpVisibleCount < MAX_COMPARE_MOVIES && (
                <button
                  type="button"
                  onClick={addCmpSlot}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-goldBright transition"
                >
                  <Plus size={14} /> Add movie
                </button>
              )}
              {cmpVisibleCount > 2 && cmpSlots.length < cmpVisibleCount && (
                <button
                  type="button"
                  onClick={removeCmpSlot}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-textFaint hover:text-text transition"
                >
                  <X size={14} /> Remove empty slot
                </button>
              )}
            </div>
          </div>

          {activeCmpMovies.length < 2 ? (
            <p className="text-xs text-textFaint mb-4">Pick at least 2 movies above to configure a comparison poster.</p>
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs text-textFaint block mb-1.5">Comparison type</label>
                <ComparisonTabs groups={cmpVm.groups} mode={cmpMode} onChange={(m) => setCmpModeKeyRaw(modeKey(m))} />
              </div>

              {cmpGroup && cmpGroup.categories.length > 1 && (
                <div>
                  <label className="text-xs text-textFaint block mb-1.5">Breakdown</label>
                  <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
                    {cmpGroup.categories.map((c) => {
                      const Icon = categoryIcon(c.category);
                      const active = c.category === activeCmpCategory?.category;
                      return (
                        <button
                          key={c.category}
                          type="button"
                          onClick={() => {
                            setCmpCategory(c.category);
                            setCmpPreviewUrl(null);
                          }}
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
                </div>
              )}

              {cmpHasDateColumn && (
                <div>
                  <label className="text-xs text-textFaint block mb-1.5">Time alignment</label>
                  <div className="flex items-center gap-1 bg-surface2 border border-border rounded-full p-1 w-fit">
                    <button
                      type="button"
                      onClick={() => {
                        setCmpAlign('day');
                        setCmpPreviewUrl(null);
                      }}
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 transition ${
                        cmpAlign === 'day' ? 'bg-gold text-white' : 'text-textDim hover:text-text'
                      }`}
                    >
                      Day 1 vs Day 1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCmpAlign('date');
                        setCmpPreviewUrl(null);
                      }}
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 transition ${
                        cmpAlign === 'date' ? 'bg-gold text-white' : 'text-textDim hover:text-text'
                      }`}
                    >
                      Calendar date
                    </button>
                  </div>
                </div>
              )}

              {cmpMode.kind !== 'overview' && cmpMergedTable.columns.length > 0 && (
                <div>
                  <label className="text-xs text-textFaint block mb-1.5">Metrics</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {cmpMergedTable.columns.map((col) => {
                      const active = cmpMetrics.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => toggleCmpMetric(col)}
                          className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
                            active ? 'bg-gold/[0.08] border-gold/30 text-gold' : 'bg-surface border-border text-textFaint hover:border-gold/30'
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {cmpMode.kind !== 'overview' && (
                <div className="flex gap-3 flex-wrap items-end">
                  <div>
                    <label className="text-xs text-textFaint block mb-1.5">Rows</label>
                    <div className="flex gap-1.5 bg-bg rounded-lg p-1">
                      {(['all', '5', '10', 'custom'] as RowsMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setCmpRowsMode(mode);
                            setCmpPreviewUrl(null);
                          }}
                          className={`text-xs font-semibold rounded-md px-3 py-2 transition ${
                            cmpRowsMode === mode ? 'bg-gold text-white' : 'text-textDim'
                          }`}
                        >
                          {mode === 'all' ? 'All' : mode === 'custom' ? 'Custom' : `Top ${mode}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {cmpRowsMode === 'custom' && (
                    <input
                      type="number"
                      min={1}
                      value={cmpCustomRows}
                      onChange={(e) => {
                        setCmpCustomRows(e.target.value);
                        setCmpPreviewUrl(null);
                      }}
                      className="bg-bg rounded-lg px-4 py-3 text-sm w-24"
                    />
                  )}
                </div>
              )}

              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <label className="text-xs text-textFaint block mb-1.5">Poster format</label>
                  <div className="flex gap-1.5 bg-bg rounded-lg p-1">
                    {(['auto', '1080x1350', '1080x1080'] as ComparisonPosterFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          setCmpFormat(fmt);
                          setCmpPreviewUrl(null);
                        }}
                        className={`text-xs font-semibold rounded-md px-3 py-2 transition ${
                          cmpFormat === fmt ? 'bg-gold text-white' : 'text-textDim'
                        }`}
                      >
                        {fmt === 'auto' ? 'Auto height' : fmt.replace('x', '×')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-xs text-textFaint">Watermark</label>
                  <button
                    type="button"
                    onClick={() => {
                      setWatermark((w) => !w);
                      setPreviewUrl(null);
                      setCmpPreviewUrl(null);
                    }}
                    className={`w-11 h-6 rounded-full transition relative flex-none ${watermark ? 'bg-gold' : 'bg-bg border border-border'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition ${watermark ? 'left-[22px]' : 'left-0.5'}`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={refreshCmpPreview} className="bg-navy text-white font-semibold rounded-lg px-5 py-2.5 text-sm">
                  Refresh preview
                </button>
                <button
                  type="button"
                  onClick={downloadCmpPng}
                  disabled={!cmpPreviewUrl || cmpDownloading}
                  className="bg-gold text-white font-semibold rounded-lg px-5 py-2.5 text-sm disabled:opacity-50"
                >
                  {cmpDownloading ? 'Preparing…' : 'Download PNG'}
                </button>
              </div>
              {cmpDownloadError && <p className="text-red text-xs">{cmpDownloadError}</p>}
            </div>
          )}

          {cmpPreviewUrl && (
            <div className="bg-bg rounded-2xl p-4 overflow-auto">
              {cmpImgError ? (
                <p className="text-red text-xs">Couldn't generate that poster. Try different comparison settings.</p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cmpPreviewUrl}
                  alt="Comparison poster preview"
                  onError={() => setCmpImgError(true)}
                  className="rounded-xl border border-border mx-auto"
                  style={{ width: '100%', maxWidth: 420, height: 'auto', display: 'block' }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
