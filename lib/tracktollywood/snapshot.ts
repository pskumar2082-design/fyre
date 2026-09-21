import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getLiveMovies, getCompletedMovies, parseAmountToCr } from './scraper';

// Calendar day in IST (India Standard Time) as "YYYY-MM-DD" -- the
// timezone TrackTollywood's own day boundaries are reported in, and the
// one that actually matters for an Indian box-office figure.
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export type SnapshotResult = {
  date: string;
  upserted: number;
  errors: string[];
};

// Fetches every currently-tracked movie (live/advance/upcoming plus the
// completed archive) and upserts one row per movie for today's date.
// Idempotent by design (unique(snapshot_date, slug) + upsert): running
// this more than once on the same day just refreshes today's numbers
// rather than erroring or duplicating, the same "duplicate key is a
// benign skip" idiom the rest of this codebase already uses for
// snapshot-style writes.
export async function snapshotToday(): Promise<SnapshotResult> {
  const date = todayIST();
  const errors: string[] = [];

  let live: Awaited<ReturnType<typeof getLiveMovies>> = [];
  let completed: Awaited<ReturnType<typeof getCompletedMovies>> = [];
  try {
    live = await getLiveMovies();
  } catch (err: any) {
    errors.push(`getLiveMovies: ${err?.message ?? 'failed'}`);
  }
  try {
    completed = await getCompletedMovies();
  } catch (err: any) {
    errors.push(`getCompletedMovies: ${err?.message ?? 'failed'}`);
  }

  const all = [...live, ...completed];
  if (all.length === 0) {
    return { date, upserted: 0, errors };
  }

  const rows = all.map((m) => ({
    snapshot_date: date,
    slug: m.slug,
    title: m.title,
    state: m.state,
    day_label: m.dayLabel,
    gross_cr: m.grossCr,
    gross_label: m.gross,
    today_cr: parseAmountToCr(m.todayText),
    fetched_at: new Date().toISOString()
  }));

  const { error } = await supabaseAdmin.from('tt_daily_snapshot').upsert(rows, { onConflict: 'snapshot_date,slug' });
  if (error) errors.push(`upsert: ${error.message}`);

  return { date, upserted: rows.length, errors };
}
