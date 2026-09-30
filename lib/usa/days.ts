// USA release-day numbering (DERIVED). Approved rule:
//   Day 1 = first full US release date = the first USA box-office report
//           date on or after the movie's India Day 1 (or the first USA
//           box-office date when India's is unknown). Before any USA box
//           office exists (advance only), India's Day 1 is the expected one.
//   Day 0 = premieres = the report date just before Day 1.
//   Earlier dates: no day number ("Pre-release").
// The report date (source file / US business date) is never replaced.
import { dayNumber } from '@/lib/bfilmy/adapter';

export function usDayOne(boxofficeDates: string[], indiaDayOne: string | null): string | null {
  const sorted = [...boxofficeDates].sort();
  if (indiaDayOne) return sorted.find((d) => d >= indiaDayOne) ?? indiaDayOne;
  return sorted[0] ?? null;
}

export function usReleaseDay(reportDate: string, dayOne: string | null): number | null {
  if (!dayOne) return null;
  const n = dayNumber(reportDate, dayOne);
  return n >= 0 ? n : null;
}

export function usDayLabel(day: number | null, date: string, dayOne: string | null, fmt: (d: string) => string): string {
  if (day === 0) return 'Day 0 (Premieres)';
  if (day != null) return `Day ${day}`;
  return dayOne && date < dayOne ? 'Pre-release' : fmt(date);
}

// "Today" for the USA feed: the US Eastern calendar date.
export function usToday(now: Date = new Date(), offsetDays = 0): string {
  return new Date(now.getTime() + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// A report date is final once late-night West Coast shows are over: six
// hours past US Eastern midnight after it.
export function usFinal(reportDate: string, now: Date = new Date()): boolean {
  return reportDate < usToday(new Date(now.getTime() - 6 * 3600_000));
}
