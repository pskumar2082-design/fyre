// Retention of temporary discovery candidates: only never-decided,
// temporary, inactive listings go; every decision and mapping stays.
import { describe, expect, it } from 'vitest';
import { CANDIDATE_DAYS, prunableCandidate, staleReview, type CandidateRow } from '../candidates';
import { NOTE } from '../core';

const TODAY = '2026-10-07';
const ago = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
const base: CandidateRow = { movie_id: null, match_status: 'unmatched', match_method: 'none', reviewed_at: null, match_note: NOTE.advanceOnly, last_date: ago(31) };

describe('candidate retention', () => {
  it('is 30 days of no BFILMY activity', () => {
    expect(CANDIDATE_DAYS).toBe(30);
    expect(prunableCandidate(base, TODAY)).toBe(true);
    expect(prunableCandidate({ ...base, last_date: ago(30) }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, last_date: ago(5) }, TODAY)).toBe(false); // still active: kept for matching
    expect(prunableCandidate({ ...base, last_date: null }, TODAY)).toBe(false);
  });

  it('prunes every temporary kind: advance-only, no show record, filtered, deferred', () => {
    for (const note of [NOTE.advanceOnly, NOTE.noShows, `${NOTE.filtered}: not a movie title`, NOTE.deferred]) expect(prunableCandidate({ ...base, match_note: note }, TODAY)).toBe(true);
  });

  it('never prunes a listing that belongs to a Fyre movie (auto or manual)', () => {
    expect(prunableCandidate({ ...base, movie_id: 'fyre-1a2b3c4d', match_status: 'matched', match_method: 'discovered' }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, movie_id: 'the-paradise', match_status: 'matched', match_method: 'manual' }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, movie_id: 'x' }, TODAY)).toBe(false);
  });

  it('never prunes rejected listings (they stop rediscovery) or review records', () => {
    expect(prunableCandidate({ ...base, match_status: 'rejected', match_method: 'manual', match_note: 'Rejected by admin', last_date: ago(400) }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, match_status: 'needs_review', match_note: `${NOTE.related} "X"`, last_date: ago(400) }, TODAY)).toBe(false);
  });

  it('never prunes anything an admin decided or reviewed', () => {
    expect(prunableCandidate({ ...base, match_method: 'manual' }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, reviewed_at: '2026-08-01T10:00:00Z' }, TODAY)).toBe(false);
  });

  it('keeps unmatched listings that are not temporary (e.g. a plain no-match waiting for auto-create)', () => {
    expect(prunableCandidate({ ...base, match_note: 'No existing Fyre movie match' }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, match_note: 'Creating a Fyre movie' }, TODAY)).toBe(false);
    expect(prunableCandidate({ ...base, match_note: null }, TODAY)).toBe(false);
  });
});

describe('stale review items', () => {
  it('are hidden from the default queue after 90 days of no activity, never deleted', () => {
    expect(staleReview({ match_status: 'needs_review', last_date: ago(91) }, TODAY)).toBe(true);
    expect(staleReview({ match_status: 'needs_review', last_date: ago(90) }, TODAY)).toBe(false);
    expect(staleReview({ match_status: 'unmatched', last_date: ago(200) }, TODAY)).toBe(false);
    // ... and a stale review item is still never prunable
    expect(prunableCandidate({ ...base, match_status: 'needs_review', last_date: ago(200) }, TODAY)).toBe(false);
  });
});
