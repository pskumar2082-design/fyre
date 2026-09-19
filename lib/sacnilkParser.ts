import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Parses a Sacnilk "<Movie> Box Office Collection | Day Wise | Worldwide"
// article (e.g. https://www.sacnilk.com/news/Some_Movie_Box_Office_Collection_Day_Wise_Worldwide)
// into structured numbers. This reads the article's own rendered day-wise
// table and summary paragraph — public editorial content their robots.txt
// explicitly allows crawling under /news/ — not anything behind login or a
// booking flow.
//
// This is intentionally best-effort: it's built from one snapshot of their
// page structure (September 2026). If Sacnilk changes their markup this
// will start returning empty results rather than throwing, so a sync run
// degrades quietly instead of breaking the site. Re-check the selectors
// here against a current article if syncs stop finding data.
// ---------------------------------------------------------------------------

export type DailyRow = {
  dayNumber: number;
  dayDate: string | null; // ISO yyyy-mm-dd
  dayLabel: string | null; // e.g. "1st Friday"
  gross: number | null; // ₹ Cr
  net: number | null; // ₹ Cr
  shows: number | null;
  occPct: number | null;
};

export type ParsedArticle = {
  days: DailyRow[];
  totals: {
    worldwideGross: number | null; // ₹ Cr
    indiaGross: number | null; // ₹ Cr
    overseasGross: number | null; // ₹ Cr
    totalNet: number | null; // ₹ Cr
    totalShows: number | null;
  };
};

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

// Sacnilk only prints the year on Day 1 ("7 Aug 2026") — every later day in
// the same article just says "8 Aug", "9 Aug", with no year at all. So this
// returns the day/month plus year *if the text had one*, and the caller
// (parseSacnilkArticle, which walks days in order) carries the year forward
// across rows, bumping it when the month rolls backwards (Dec -> Jan).
function parseDayMonth(text: string): { day: string; month: string; year: string | null } | null {
  const m = text.trim().match(/(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  return { day: m[1].padStart(2, '0'), month: mon, year: m[3] ?? null };
}

function parseCr(text: string): number | null {
  // "₹0.12Cr" -> 0.12
  const m = text.replace(/,/g, '').match(/([\d.]+)\s*Cr/i);
  return m ? Number(m[1]) : null;
}

function parseInt2(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

function parsePct(text: string): number | null {
  const m = text.match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
}

export function parseSacnilkArticle(html: string): ParsedArticle {
  const $ = cheerio.load(html);
  const days: DailyRow[] = [];

  // Desktop day rows: grid grid-cols-5 gap-4 items-center — the header row
  // uses "hidden md:grid grid-cols-5 gap-4" (no items-center), so this
  // selector only matches actual day rows, not the column-header row. Rows
  // appear in the page in day-ascending order (Day 1, Day 2, ...), which
  // the year-carry-forward logic below depends on.
  let year: number | null = null;
  let prevMonth: number | null = null;

  $('.grid-cols-5.gap-4.items-center').each((_, el) => {
    const cols = $(el).children('div');
    if (cols.length < 5) return;

    const dayText = $(cols[0]).find('a').first().text().trim();
    const dayMatch = dayText.match(/Day\s+(\d+)/i);
    if (!dayMatch) return; // not a day row (e.g. an unrelated grid on the page) — skip rather than guess

    const dateText = $(cols[0]).find('.daydate').first().text().trim();
    const labelMatch = $(cols[0]).text().match(/\(([^)]+)\)/);

    const dmy = dateText ? parseDayMonth(dateText) : null;
    let dayDate: string | null = null;
    if (dmy) {
      if (dmy.year) {
        year = Number(dmy.year);
      } else if (year != null && prevMonth != null && Number(dmy.month) < prevMonth) {
        year += 1; // month went backwards mid-article (Dec -> Jan) = rolled into the next year
      }
      if (year != null) dayDate = `${year}-${dmy.month}-${dmy.day}`;
      prevMonth = Number(dmy.month);
    }

    days.push({
      dayNumber: Number(dayMatch[1]),
      dayDate,
      dayLabel: labelMatch ? labelMatch[1].trim() : null,
      gross: parseCr($(cols[1]).text()),
      net: parseCr($(cols[2]).text()),
      shows: parseInt2($(cols[3]).text()),
      occPct: parsePct($(cols[4]).text())
    });
  });

  // Summary paragraph: "... has achieved worldwide collections of <strong>₹X Cr</strong>
  // (India Gross: <strong>₹Y Cr</strong>, Overseas: <strong>₹Z Cr</strong>) in gross
  // collections and <strong>₹W Cr</strong> in net collections across N shows."
  const summaryP = $('.prose p.text-gray-700').first();
  const summaryText = summaryP.text();
  const strongValues = summaryP
    .find('strong')
    .map((_, el) => parseCr($(el).text()))
    .get();
  const showsMatch = summaryText.match(/across\s+([\d,]+)\s+shows/i);

  return {
    days: days.sort((a, b) => a.dayNumber - b.dayNumber),
    totals: {
      worldwideGross: strongValues[0] ?? null,
      indiaGross: strongValues[1] ?? null,
      overseasGross: strongValues[2] ?? null,
      totalNet: strongValues[3] ?? null,
      totalShows: showsMatch ? Number(showsMatch[1].replace(/,/g, '')) : null
    }
  };
}

// Formats a raw number the way the rest of the site already writes big
// counts (e.g. seed data uses "1.79 L" shows, "1.30 Cr" tickets), so
// synced values look consistent with anything entered by hand.
export function formatIndianShort(n: number): string {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} K`;
  return String(n);
}
