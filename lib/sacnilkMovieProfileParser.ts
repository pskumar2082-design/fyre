import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Parses a Sacnilk movie profile page (e.g.
// https://www.sacnilk.com/movie/Happy_Journey_2026) -- the richer per-movie
// page with a synopsis, a "Key Details" panel (Genre/Runtime/CBFC
// Rating/Languages), a "Release Information" panel (Theatrical Release/OTT
// Release), a "Total Collections Summary" card set (India Gross/Worldwide/
// Overseas/India Net plus India Share %/Total Worldwide/Overseas Share %/
// Box Office Verdict), and -- for movies Sacnilk tracks separately by
// language, like https://www.sacnilk.com/movie/Resident_Evil_2026 -- a Net
// Collection + Verdict card per language version.
//
// Same philosophy as sacnilkParser.ts: built from one snapshot of their
// markup (September 2026), reads only this public profile page, and is
// intentionally best-effort -- a selector that stops matching just makes
// that one field come back null/empty rather than throwing, so a sync run
// degrades quietly instead of breaking. Re-check the selectors here against
// a current profile page if syncs stop finding data.
// ---------------------------------------------------------------------------

export type MovieVersion = {
  language: string;
  netCollectionCr: number | null;
  netCollectionText: string | null;
  verdict: string | null;
};

export type ParsedMovieProfile = {
  description: string | null;
  genre: string | null;
  runtime: string | null;
  cbfcRating: string | null;
  languages: string | null; // e.g. "English, Hindi, Tamil, Telugu"
  theatricalReleaseDate: string | null; // ISO yyyy-mm-dd
  ottReleaseStatus: string | null; // e.g. "Not Available", or a platform/date string
  totals: {
    indiaGrossCr: number | null;
    worldwideCr: number | null;
    overseasCr: number | null;
    indiaNetCr: number | null;
    indiaSharePct: number | null;
    overseasSharePct: number | null;
    verdict: string | null;
  };
  versions: MovieVersion[];
};

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

function parseDate(text: string): string | null {
  const m = text.trim().match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
}

function parseCr(text: string): number | null {
  const m = text.replace(/,/g, '').match(/([\d.]+)\s*Cr/i);
  return m ? Number(m[1]) : null;
}

function parsePct(text: string): number | null {
  const m = text.match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// Strips a leading emoji/icon glyph a heading or label often starts with
// (e.g. "\ud83c\udfac Key Details", "\ud83d\udcfa OTT Release") -- cheap, no emoji-regex lib needed.
function stripLeadingIcon(text: string): string {
  return clean(text).replace(/^[^\w]+/, '').trim();
}

// Reads a "Key Details" / "Release Information" style panel: a <ul> of
// <li>s, each holding a <span class="font-medium ...">Label:</span> plus a
// value (either a plain sibling <span>, as with Genre/Runtime/CBFC
// Rating/Languages/Theatrical Release, or a badge <span> nested one level
// deeper inside a wrapper <div>, as with OTT Release) -- so this reads by
// label text rather than a fixed position, and works for both shapes.
function parseInfoList($: any, container: any): Record<string, string> {
  const out: Record<string, string> = {};
  container.find('li').each((_: number, li: any) => {
    const $li = $(li);
    const labelEl = $li.find('span.font-medium').first();
    if (labelEl.length === 0) return;
    const label = stripLeadingIcon(labelEl.text()).replace(/:$/, '').trim();
    if (!label) return;
    const valueEl = $li.find('span').last();
    if (valueEl.is(labelEl)) return; // no separate value span found
    out[label] = clean(valueEl.text());
  });
  return out;
}

// Reads one row of stat cards (the "Total Collections Summary" headline
// cards, its India Share/Total Worldwide/Overseas Share/Box Office Verdict
// breakdown cards below them, and each language version's Net
// Collection/Verdict cards) into { label: value }. Cards vary in whether
// the label or the value comes first in the markup, and the value is
// sometimes a plain div and sometimes a <span> nested inside an icon
// wrapper -- so this finds the label by its "text-sm" class and the value
// as the nearest "font-bold" element, falling back to the label's sibling
// when a card has no bold value (e.g. a version's plain-text Verdict).
function parseCardGrid($: any, grid: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!grid || grid.length === 0) return out;
  grid.children().each((_: number, card: any) => {
    const $card = $(card);
    const inner = $card.find('.text-center').first();
    const scope = inner.length ? inner : $card;
    const labelEl = scope
      .find('div, span')
      .filter((__: number, el: any) => ($(el).attr('class') || '').split(/\s+/).includes('text-sm'))
      .first();
    if (labelEl.length === 0) return;
    const label = clean(labelEl.text());
    if (!label) return;
    let valueEl = scope.find('.font-bold').first();
    if (valueEl.length === 0 || valueEl.is(labelEl)) {
      valueEl = labelEl.siblings('div, span').first();
    }
    out[label] = clean(valueEl.length ? valueEl.text() : '');
  });
  return out;
}

export function parseMovieProfile(html: string): ParsedMovieProfile {
  const $ = cheerio.load(html);

  // Synopsis paragraph -- starts with "<strong>Title</strong> ..." so the
  // title is stripped back out, leaving just the description text.
  const descP = $('p.text-gray-700.leading-relaxed.mb-4').first();
  let description: string | null = null;
  if (descP.length) {
    const clone = descP.clone();
    clone.find('strong').first().remove();
    description = clean(clone.text()) || null;
  }

  const keyDetailsHeader = $('h4').filter((_: number, el: any) => $(el).text().includes('Key Details')).first();
  const keyDetails = keyDetailsHeader.length ? parseInfoList($, keyDetailsHeader.parent()) : {};

  const releaseHeader = $('h4').filter((_: number, el: any) => $(el).text().includes('Release Information')).first();
  const releaseInfo = releaseHeader.length ? parseInfoList($, releaseHeader.parent()) : {};

  const summaryHeader = $('h2').filter((_: number, el: any) => $(el).text().includes('Total Collections Summary')).first();
  const summarySection = summaryHeader.length ? summaryHeader.parent() : null;
  const cardGrids = summarySection ? summarySection.find('.grid') : null;
  // The section has exactly two card grids: the 4 headline cards (India
  // Gross/Worldwide/Overseas/India Net), then the 4 breakdown cards
  // (India Share/Total Worldwide/Overseas Share/Box Office Verdict).
  const headlineCards = cardGrids && cardGrids.length > 0 ? parseCardGrid($, $(cardGrids[0])) : {};
  const breakdownCards = cardGrids && cardGrids.length > 1 ? parseCardGrid($, $(cardGrids[1])) : {};

  // Multi-version releases get their own "<Language> Version - Daily Net
  // Collection" section each, with a 2-card summary (Net Collection,
  // Verdict) at the top before that language's own day-by-day cards.
  const versions: MovieVersion[] = [];
  $('h2').each((_: number, el: any) => {
    const text = $(el).text();
    const m = text.match(/([A-Za-z]+)\s+Version\s*-\s*Daily Net Collection/i);
    if (!m) return;
    const language = m[1];
    const section = $(el).parent();
    const grid = section.find('.grid').first();
    const cards = parseCardGrid($, grid);
    const netText = cards['Net Collection'] ?? null;
    const verdictText = cards['Verdict'] ?? null;
    versions.push({
      language,
      netCollectionCr: netText ? parseCr(netText) : null,
      netCollectionText: netText || null,
      verdict: verdictText && verdictText !== 'N/A' ? verdictText : null
    });
  });

  const verdictText = breakdownCards['Box Office Verdict'];

  return {
    description,
    genre: keyDetails['Genre'] || null,
    runtime: keyDetails['Runtime'] || null,
    cbfcRating: keyDetails['CBFC Rating'] || null,
    languages: keyDetails['Languages'] || null,
    theatricalReleaseDate: releaseInfo['Theatrical Release'] ? parseDate(releaseInfo['Theatrical Release']) : null,
    ottReleaseStatus: releaseInfo['OTT Release'] || null,
    totals: {
      indiaGrossCr: headlineCards['India Gross'] ? parseCr(headlineCards['India Gross']) : null,
      worldwideCr: headlineCards['Worldwide'] ? parseCr(headlineCards['Worldwide']) : null,
      overseasCr: headlineCards['Overseas'] ? parseCr(headlineCards['Overseas']) : null,
      indiaNetCr: headlineCards['India Net'] ? parseCr(headlineCards['India Net']) : null,
      indiaSharePct: breakdownCards['India Share'] ? parsePct(breakdownCards['India Share']) : null,
      overseasSharePct: breakdownCards['Overseas Share'] ? parsePct(breakdownCards['Overseas Share']) : null,
      verdict: verdictText && verdictText !== 'N/A' ? verdictText : null
    },
    versions
  };
}
