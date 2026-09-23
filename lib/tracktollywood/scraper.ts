import axios from 'axios';
import * as cheerio from 'cheerio';
import type { TTListedMovie, TTMovieDetails, TTMovieMetaItem, TTMovieState, TTStat, TTTable, TTTableRow } from './types';
import { cachedFetch } from './cache';

const ORIGIN = 'https://tracktollywood.com';
const HUB_PATH = '/box-office-collection/';

// A real browser UA -- TrackTollywood's own WordPress/Cloudflare stack
// didn't challenge a bare `curl` during investigation (confirmed live
// 2026-09-21, and robots.txt only disallows /wp-admin/), but a
// plausible UA is still cheap politeness and avoids being lumped in
// with generic bot traffic by any WAF rule that keys off it.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function fetchHtml(path: string): Promise<string> {
  const res = await axios.get<string>(`${ORIGIN}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    timeout: 15000,
    responseType: 'text',
    // Only 200 counts as success -- a 404 on a movie slug is a real,
    // expected "not tracked" outcome the caller needs to see, not an
    // exception to catch.
    validateStatus: (status) => status === 200
  });
  return res.data;
}

function slugFromUrl(url: string): string {
  const path = url.replace(ORIGIN, '');
  const parts = path.split('/').filter(Boolean); // ["box-office-collection", "daayra"]
  return parts[parts.length - 1] ?? '';
}

function stateFromBadgeClass(className: string | undefined): TTMovieState {
  const c = className ?? '';
  if (c.includes('--live')) return 'live';
  if (c.includes('--advance')) return 'advance';
  if (c.includes('--upcoming')) return 'upcoming';
  if (c.includes('--final')) return 'final';
  return 'unknown';
}

// "₹5.41Cr" / "₹5.41 Cr" / "₹84.53Cr" -> 5.41 / 84.53. Returns null for
// values in Lakhs ("₹42.40L") or anything unparsable -- callers that
// want a cross-magnitude number can normalize further; this only
// promises "the number MovieMint-style Cr figures already are in".
function parseGrossCr(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, '').match(/([\d.]+)\s*Cr/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

// Same idea as parseGrossCr, but also handles Lakh figures (dividing by
// 100 to normalize to crores) since a single day's collection --
// TTListedMovie.todayText -- is routinely in Lakhs for a smaller or
// later-in-its-run movie, unlike the lifetime gross figure. Exported for
// lib/tracktollywood/snapshot.ts, which needs a same-unit number to sum
// across movies for the daily snapshot.
export function parseAmountToCr(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '');
  const crMatch = cleaned.match(/([\d.]+)\s*Cr/i);
  if (crMatch) {
    const n = Number(crMatch[1]);
    return Number.isFinite(n) ? n : null;
  }
  const lMatch = cleaned.match(/([\d.]+)\s*L/i);
  if (lMatch) {
    const n = Number(lMatch[1]);
    return Number.isFinite(n) ? n / 100 : null;
  }
  return null;
}

function cleanText($el: cheerio.Cheerio<any>): string {
  return $el.text().replace(/\s+/g, ' ').trim();
}

// "Releasing 25 Sep 2026" / "Released 18 Sep 2026" -> a real Date, or null
// if the text doesn't match -- kept defensive since this is free text off
// the page (releaseText) rather than a machine-readable field. Exported
// since both app/upcoming/page.tsx and app/page.tsx need a countdown from
// the same text.
export function parseReleaseDate(releaseText: string | null): Date | null {
  if (!releaseText) return null;
  const m = releaseText.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// releaseTextFromMeta() -- the "Released On"/"Releasing On" meta-item
// lookup this file used to also export -- now lives in ./meta.ts
// instead, specifically so a 'use client' file that only needs that one
// pure helper never has to import this file (and drag axios + cheerio
// into the browser bundle just to reach it). Import it from
// '@/lib/tracktollywood/meta' directly.

// ---------------------------------------------------------------------------
// Hub listing (/box-office-collection/)
// ---------------------------------------------------------------------------

export function parseLiveMovies(html: string): TTListedMovie[] {
  const $ = cheerio.load(html);
  const movies: TTListedMovie[] = [];

  $('a.tt-hub-card').each((_, el) => {
    const $card = $(el);
    const href = $card.attr('href');
    if (!href) return;

    const title = cleanText($card.find('.tt-hub-card-title').first());
    if (!title) return; // no title -- not a real movie card, skip rather than emit junk

    const badgeClass = $card.find('.tt-hub-card-badge').first().attr('class');
    const grossText = cleanText($card.find('.tt-hub-card-gross').first()) || null;
    const posterSrc =
      $card.find('img.tt-hub-card-poster-fg').first().attr('data-lazy-src') ||
      $card.find('img.tt-hub-card-poster-fg').first().attr('src') ||
      null;

    movies.push({
      slug: slugFromUrl(href),
      title,
      url: href,
      state: stateFromBadgeClass(badgeClass),
      dayLabel: cleanText($card.find('.tt-hub-card-daybadge').first()) || null,
      releaseText: cleanText($card.find('.tt-hub-card-release').first()) || null,
      genre: cleanText($card.find('.tt-hub-card-genre').first()) || null,
      poster: posterSrc && posterSrc.startsWith('data:') ? null : posterSrc,
      grossLabel: cleanText($card.find('.tt-hub-card-grosslab').first()) || null,
      gross: grossText,
      grossCr: parseGrossCr(grossText),
      todayText: cleanText($card.find('.tt-hub-card-today').first()) || null,
      updatedText: cleanText($card.find('.tt-hub-card-footer').first()) || null
    });
  });

  return movies;
}

// Every hub listing paginates the same way (plain WordPress /page/N/
// links, not JS/AJAX -- confirmed live 2026-09-21 on both the default
// hub, 24 live/advance/upcoming movies across 2 pages, and the
// completed archive, 67 movies across 6 pages, each via a real
// `.tt-hub-pagination a.next` link). This follows that link until it
// disappears so callers get the whole set, not just page 1.
const MAX_HUB_PAGES = 20; // safety cap, not a real expected page count

function findNextPageUrl(html: string): string | null {
  const $ = cheerio.load(html);
  const href = $('.tt-hub-pagination a.next.page-numbers').first().attr('href');
  return href ?? null;
}

async function fetchAllHubPages(startPath: string): Promise<TTListedMovie[]> {
  const movies: TTListedMovie[] = [];
  const seenSlugs = new Set<string>();
  let path: string | null = startPath;
  let pagesFetched = 0;

  while (path && pagesFetched < MAX_HUB_PAGES) {
    const html = await fetchHtml(path);
    for (const m of parseLiveMovies(html)) {
      // The hub can legitimately repeat a movie across a "featured"
      // strip and the paginated grid -- de-dupe by slug so callers
      // never see the same movie twice.
      if (seenSlugs.has(m.slug)) continue;
      seenSlugs.add(m.slug);
      movies.push(m);
    }
    pagesFetched++;
    const nextUrl = findNextPageUrl(html);
    path = nextUrl ? nextUrl.replace(ORIGIN, '') : null;
  }

  return movies;
}

// Currently live/advance/upcoming movies (the default hub view).
export async function getLiveMovies(): Promise<TTListedMovie[]> {
  return cachedFetch('tt:live', 300, async () => fetchAllHubPages(HUB_PATH));
}

// The historical archive of movies whose theatrical run has wrapped up
// (badge state 'final'). A separate, much larger listing --
// .../box-office-collection/completed/ -- not a filter on the hub above.
// Cached longer than the live list (30 min) since a completed movie's
// figures don't change run to run the way a live one's do.
export async function getCompletedMovies(): Promise<TTListedMovie[]> {
  return cachedFetch('tt:completed', 1800, async () => fetchAllHubPages(`${HUB_PATH}completed/`));
}

// ---------------------------------------------------------------------------
// Movie detail page (/box-office-collection/<slug>/)
// ---------------------------------------------------------------------------

function parseStats($: cheerio.CheerioAPI): TTStat[] {
  const stats: TTStat[] = [];
  $('.tt-mv-stat').each((_, el) => {
    const $stat = $(el);
    const value = cleanText($stat.find('.tt-mv-stat-value').first());
    const label = cleanText($stat.find('.tt-mv-stat-label').first());
    if (!label && !value) return;
    // "Best Day · Day 3" -> label "Best Day", note "Day 3". Most labels
    // have no "· " suffix and just get note: null.
    const [baseLabel, note] = label.split(' · ');
    stats.push({ label: baseLabel || label, value, note: note ?? null });
  });
  return stats;
}

// The "Released/Releasing On · Cast · Director · Genre · Languages ·
// Production" footer every movie page carries, plus its own "Last
// updated" line. Generic label/value pairs (not fixed fields) so a
// field TrackTollywood adds or renames later still comes through.
function parseMovieMeta($: cheerio.CheerioAPI): { meta: TTMovieMetaItem[]; metaUpdatedText: string | null } {
  const meta: TTMovieMetaItem[] = [];
  $('.tt-mv-meta > div').each((_, el) => {
    const $item = $(el);
    if ($item.hasClass('tt-mv-updated')) return; // handled separately below
    const label = cleanText($item.find('.tt-mv-meta-label').first());
    const value = cleanText($item.find('.tt-mv-meta-value').first());
    if (label && value) meta.push({ label, value, wide: $item.hasClass('tt-mv-meta-item--wide') });
  });
  const metaUpdatedText = cleanText($('.tt-mv-updated').first()) || null;
  return { meta, metaUpdatedText };
}

// Every breakdown table on a movie page (day-wise, top cities,
// state-wise, language-wise, format-wise, time slots, per-advance-date,
// cumulative) is rendered the same way: a `.tt-ac-table-wrap
// [data-snapshot="<label>"]` wrapping one `table.tt-ac-table` with a
// real <thead> and <tbody>. One generic parser covers all of them, so
// this keeps working if TrackTollywood adds another breakdown kind or
// another day without any code change here.
function parseTables($: cheerio.CheerioAPI): TTTable[] {
  const tables: TTTable[] = [];

  $('.tt-ac-table-wrap[data-snapshot]').each((_, wrapEl) => {
    const $wrap = $(wrapEl);
    const label = $wrap.attr('data-snapshot')?.trim();
    if (!label) return;

    const $table = $wrap.find('table.tt-ac-table').first();
    if ($table.length === 0) return;

    const headers = $table
      .find('thead th')
      .map((_, th) => cleanText($(th)))
      .get();
    if (headers.length === 0) return;

    const rows: TTTableRow[] = [];
    $table.find('tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const row: TTTableRow = {};
      // Walk cells with a colspan-aware header pointer -- the sheet's
      // own "TOTAL" row uses colspan to merge its first few columns
      // (e.g. Day+Date+Weekday) into one "TOTAL" cell, so naive
      // index-by-position alignment would shift every column after it.
      let headerIdx = 0;
      $tr.find('th, td').each((_, cell) => {
        const $cell = $(cell);
        const span = parseInt($cell.attr('colspan') ?? '1', 10) || 1;
        const key = headers[headerIdx] ?? `col${headerIdx}`;
        row[key] = cleanText($cell);
        headerIdx += span;
      });
      if ($tr.hasClass('tt-ac-totals')) row.__isTotal = true;
      rows.push(row);
    });

    tables.push({ label, headers, rows });
  });

  return tables;
}

export function parseMovieDetails(html: string, slug: string): TTMovieDetails {
  const $ = cheerio.load(html);

  const title = cleanText($('.tt-mv-title').first()) || slug;
  const badgeEl = $('.tt-mv-badge').first();
  const badgeText = cleanText(badgeEl) || null;
  const state = stateFromBadgeClass(badgeEl.attr('class'));

  const posterSrc =
    $('img.tt-mv-poster-fg').first().attr('src') || $('img.tt-mv-poster-fg').first().attr('data-lazy-src') || null;

  const { meta, metaUpdatedText } = parseMovieMeta($);

  return {
    slug,
    title,
    url: `${ORIGIN}${HUB_PATH}${slug}/`,
    state,
    poster: posterSrc && posterSrc.startsWith('data:') ? null : posterSrc,
    badgeText,
    headlineGross: cleanText($('.tt-mv-big').first()) || null,
    headlineLabel: cleanText($('.tt-mv-headline-label').first()) || null,
    stats: parseStats($),
    meta,
    metaUpdatedText,
    tables: parseTables($),
    fetchedAt: new Date().toISOString()
  };
}

// Returns null for a slug TrackTollywood doesn't have (a real 404, not
// an error) -- the caller (the API route) turns that into a 404
// response rather than a 500.
export async function getMovieDetails(slug: string): Promise<TTMovieDetails | null> {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug || !/^[a-z0-9-]+$/.test(safeSlug)) return null;

  return cachedFetch(`tt:movie:${safeSlug}`, 300, async () => {
    try {
      const html = await fetchHtml(`${HUB_PATH}${safeSlug}/`);
      return parseMovieDetails(html, safeSlug);
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  });
}
