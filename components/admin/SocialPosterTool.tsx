import { useState } from 'react';
import type { TTMovieDetails } from '@/lib/tracktollywood/types';
import { listAvailableReports } from '@/lib/poster/build';
import { buildPosterFilename } from '@/lib/poster/filename';

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
type RowsMode = 'all' | '5' | '10' | 'custom';

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

export default function SocialPosterTool() {
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

  return (
    <div className="max-w-2xl">
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
    </div>
  );
}
