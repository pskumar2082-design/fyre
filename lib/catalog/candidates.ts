// Retention for TEMPORARY discovery candidates (BFILMY India bf_listing and
// USA us_movie_map rows that never became anything). Discovery records every
// title it sees; most advance-only / no-show / filtered titles never become
// Fyre movies, and without this they would accumulate forever.
//
// A candidate is pruned only when ALL hold:
//   - no Fyre movie (movie_id null) and match_status 'unmatched'
//   - never manually decided (match_method not 'manual'), no review timestamp
//   - its note marks it temporary: advance-only, no show record yet,
//     filtered (junk/ride/combo) or creation deferred
//   - no BFILMY activity (last_date) for more than CANDIDATE_DAYS (30)
// NEVER pruned: canonical movies, aliases, matched listings (manual or
// automatic), rejected listings (they stop rediscovery), admin decisions,
// review records. A pruned title that reappears is simply recorded again.
//
// Review items with no activity for more than REVIEW_STALE_DAYS (90) are
// only hidden from the default review queue -- their rows are kept.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NOTE } from './core';

export const CANDIDATE_DAYS = Number(process.env.CATALOG_CANDIDATE_DAYS ?? 30);
export const REVIEW_STALE_DAYS = 90;
const TEMPORARY = [NOTE.advanceOnly, NOTE.noShows, NOTE.filtered, NOTE.deferred];

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export type CandidateRow = { movie_id: string | null; match_status: string; match_method: string | null; reviewed_at: string | null; match_note: string | null; last_date: string | null };

// Pure: may this listing row be pruned on `today`?
export function prunableCandidate(r: CandidateRow, today: string, days = CANDIDATE_DAYS): boolean {
  if (r.movie_id != null) return false;
  if (r.match_status !== 'unmatched') return false; // matched / rejected / needs_review are kept
  if (r.match_method === 'manual' || r.reviewed_at) return false; // any admin decision is kept
  const note = String(r.match_note ?? '');
  if (!TEMPORARY.some((t) => note.startsWith(t))) return false;
  if (!r.last_date) return false;
  return r.last_date < addDays(today, -days);
}

// Pure: is a review item stale (hidden from the default queue, row kept)?
export function staleReview(r: { match_status: string; last_date: string | null }, today: string): boolean {
  return r.match_status === 'needs_review' && !!r.last_date && r.last_date < addDays(today, -REVIEW_STALE_DAYS);
}

export type CandidatePruneResult = { cutoff: string; india: number; usa: number; dryRun: boolean };

// Selects with the same conditions in SQL, then re-checks each row with
// prunableCandidate() before deleting it (deletes by primary key only).
export async function pruneCandidates(today: string, opts: { dryRun?: boolean } = {}): Promise<CandidatePruneResult> {
  const db = supabaseAdmin as any;
  const cutoff = addDays(today, -CANDIDATE_DAYS);
  const out: CandidatePruneResult = { cutoff, india: 0, usa: 0, dryRun: !!opts.dryRun };
  for (const [table, pk, field] of [
    ['bf_listing', 'key', 'india'],
    ['us_movie_map', 'source_movie_id', 'usa']
  ] as const) {
    const { data, error } = await db
      .from(table)
      .select(`${pk},movie_id,match_status,match_method,reviewed_at,match_note,last_date`)
      .is('movie_id', null)
      .eq('match_status', 'unmatched')
      .is('reviewed_at', null)
      .lt('last_date', cutoff)
      .limit(1000);
    if (error) throw new Error(`${table}: ${error.message}`);
    const ids = (data ?? []).filter((r: CandidateRow) => prunableCandidate(r, today)).map((r: any) => r[pk]);
    out[field] = ids.length;
    if (opts.dryRun || !ids.length) continue;
    for (let i = 0; i < ids.length; i += 200) {
      const { error: e } = await db.from(table).delete().in(pk, ids.slice(i, i + 200)).is('movie_id', null).eq('match_status', 'unmatched');
      if (e) throw new Error(`${table} prune: ${e.message}`);
    }
  }
  return out;
}
