import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type DailyTotal = { date: string; totalCr: number; movieCount: number };

// Reads back the accumulated tt_daily_snapshot rows and sums gross-so-far
// (gross_cr) per calendar day, across every tracked movie that day --
// this is the "Earning Summary" trend line. It starts out short (just
// however many days the cron has run since the migration went in) and
// fills in day by day; there's no backdating it with fabricated history.
// Read-only, server-only (service-role client, never imported from a
// client component) -- safe to call directly from a Server Component.
export async function getDailyTotals(days = 180): Promise<DailyTotal[]> {
  const { data, error } = await supabaseAdmin
    .from('tt_daily_snapshot')
    .select('snapshot_date, gross_cr')
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];

  const byDate = new Map<string, { totalCr: number; movieCount: number }>();
  for (const row of data as { snapshot_date: string; gross_cr: number | null }[]) {
    const entry = byDate.get(row.snapshot_date) ?? { totalCr: 0, movieCount: 0 };
    if (row.gross_cr != null) entry.totalCr += row.gross_cr;
    entry.movieCount += 1;
    byDate.set(row.snapshot_date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, v]) => ({ date, totalCr: v.totalCr, movieCount: v.movieCount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}
