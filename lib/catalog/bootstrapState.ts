// State of the one-time 90-day catalog bootstrap (bf_sync_state
// 'catalog_bootstrap'). Kept apart from bootstrap.ts so the regular history
// importers can check it without importing the bootstrap itself.
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const BOOTSTRAP_KEY = 'catalog_bootstrap';

export type BootstrapState = {
  phase: 'india' | 'usa' | 'finish' | 'done';
  floor: string; // first date of the window (today - 89 when started)
  end: string; // last date it imports (the day before it started; the regular sync covers today on)
  next: string; // next date to process in the current phase
  feeds: ('boxoffice' | 'advance')[];
  createdSlugs: string[];
  joined?: Record<string, string>; // India slug -> first date the bootstrap imported it
  createdUsa: string[]; // Fyre movie ids created from USA listings
  usaImport: string[]; // movies the USA phase imports
  fetched: { india: number; usa: number };
  titles?: { india: number; usa: number }; // titles encountered (per file, summed)
  // Stopped safely at the CATALOG_BOOTSTRAP_MAX cap: nothing after `at` is
  // processed until it is resumed with a higher cap; undecided listings are
  // kept as candidates (never discarded).
  paused?: { reason: string; at: string } | null;
  auto?: boolean; // the scheduled cron may continue it
  startedAt: string;
  finishedAt?: string;
};

export async function getBootstrap(): Promise<BootstrapState | null> {
  const { data } = await supabaseAdmin.from('bf_sync_state').select('value').eq('key', BOOTSTRAP_KEY).maybeSingle();
  return ((data as any)?.value as BootstrapState) ?? null;
}

export async function saveBootstrap(s: BootstrapState) {
  const { error } = await supabaseAdmin.from('bf_sync_state').upsert({ key: BOOTSTRAP_KEY, value: s, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(`bf_sync_state: ${error.message}`);
}

// History importers wait while the bootstrap is importing the same dates.
export async function bootstrapRunning(): Promise<boolean> {
  try {
    const s = await getBootstrap();
    return !!s && s.phase !== 'done';
  } catch {
    return false;
  }
}
