// Storage retention (see supabase/migration_bfilmy_5.sql):
//   core day totals            permanent
//   breakdowns                 last BF_BREAKDOWN_DAYS days (default 90)
//   raw show rows              last BF_SHOW_DAYS days (default 7) + open advance dates
// Deletion is batched so each statement stays inside the API timeout, and
// only runs where the permanent aggregates for a date are complete.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const BREAKDOWN_DAYS = Number(process.env.BF_BREAKDOWN_DAYS ?? 90);
export const SHOW_DAYS = Number(process.env.BF_SHOW_DAYS ?? 7);

export type RetentionResult = {
  dryRun: boolean;
  breakdownRows: number;
  summaryDays: number;
  showRows: number;
  cutoff: string | null;
  complete: boolean;
};

export async function runRetention(opts: { deadline?: number; dryRun?: boolean; daily?: boolean } = {}): Promise<RetentionResult | { skipped: string }> {
  const deadline = opts.deadline ?? Date.now() + 10 * 60_000;
  if (opts.daily) {
    const { data } = await supabaseAdmin.from('bf_sync_state').select('value').eq('key', 'last_retention').maybeSingle();
    const last = (data?.value as any)?.day;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (last === today && (data?.value as any)?.complete) return { skipped: 'already ran today' };
  }
  if (opts.dryRun) {
    const { data, error } = await supabaseAdmin.rpc('bf_prune_breakdowns', { p_keep_days: BREAKDOWN_DAYS, p_dry_run: true });
    if (error) throw new Error(`bf_prune_breakdowns: ${error.message}`);
    const { data: shows, error: e2 } = await supabaseAdmin.rpc('bf_prune_shows', { p_keep_days: SHOW_DAYS, p_dry_run: true });
    if (e2) throw new Error(`bf_prune_shows: ${e2.message}`);
    return { dryRun: true, breakdownRows: (data as any).breakdown_rows, summaryDays: (data as any).summary_days, showRows: Number(shows) || 0, cutoff: (data as any).cutoff, complete: true };
  }
  let breakdownRows = 0;
  let summaryDays = 0;
  let cutoff: string | null = null;
  let complete = false;
  while (Date.now() < deadline) {
    const { data, error } = await supabaseAdmin.rpc('bf_prune_breakdowns', { p_keep_days: BREAKDOWN_DAYS, p_dry_run: false, p_batch: Number(process.env.BF_PRUNE_BATCH ?? 100) });
    if (error) throw new Error(`bf_prune_breakdowns: ${error.message}`);
    const d = data as any;
    cutoff = d.cutoff;
    breakdownRows += d.breakdown_rows;
    summaryDays += d.summary_days;
    if (d.breakdown_rows === 0 && d.summary_days === 0) {
      complete = true;
      break;
    }
  }
  let showRows = 0;
  if (Date.now() < deadline) {
    const { data, error } = await supabaseAdmin.rpc('bf_prune_shows', { p_keep_days: SHOW_DAYS, p_dry_run: false });
    if (error) throw new Error(`bf_prune_shows: ${error.message}`);
    showRows = Number(data) || 0;
  } else complete = false;
  const result = { dryRun: false, breakdownRows, summaryDays, showRows, cutoff, complete };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  await supabaseAdmin.from('bf_sync_state').upsert({ key: 'last_retention', value: { ...result, day: today }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return result;
}
