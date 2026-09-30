import { describe, expect, it } from 'vitest';
import { parseTrackedPage } from '../catalog';
import { matchMovie, stripYear, type BfCandidate } from '../match';
import type { MovieMintMovie } from '../catalog';

const flight = (objs: object[]) => {
  const payload = `8:["$","div",null,{"movies":${JSON.stringify(objs)}}]`;
  return `<html><script>self.__next_f.push([1,${JSON.stringify(payload)}])</script></html>`;
};

describe('parseTrackedPage', () => {
  it('reads identity fields and ignores MovieMint numbers', () => {
    const html = flight([
      { boxOfficeId: 'the-paradise', title: 'The Paradise', poster: 'https://image.tmdb.org/p.jpg', releaseDate: '2026-09-24', language: 'Telugu', badge: '$undefined', href: '/movie/the-paradise?date=20260930', gross: 1, sourceDate: '20260930' },
      { boxOfficeId: 'epic', title: 'Epic', releaseDate: '', language: 'Unknown', badge: 'Re-Release', sourceDate: '20260929' },
      { boxOfficeId: 'the-paradise', title: 'dup' }
    ]);
    const list = parseTrackedPage(html);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: 'the-paradise',
      title: 'The Paradise',
      language: 'Telugu',
      releaseDate: '2026-09-24',
      poster: 'https://image.tmdb.org/p.jpg',
      badge: null,
      sourceUrl: 'https://moviemintbo.com/movie/the-paradise',
      lastTrackedDate: '2026-09-30'
    });
    expect(list[1]).toMatchObject({ language: null, releaseDate: null, badge: 'Re-Release' });
    expect(JSON.stringify(list)).not.toContain('gross');
  });
});

const mm = (over: Partial<MovieMintMovie>): MovieMintMovie => ({
  id: 'x',
  title: 'The Paradise',
  language: 'Telugu',
  releaseDate: '2026-09-24',
  poster: null,
  badge: null,
  sourceUrl: '',
  lastTrackedDate: null,
  ...over
});
const bf = (over: Partial<BfCandidate>): BfCandidate => ({
  slug: 'the-paradise',
  title: 'The Paradise',
  languages: ['Telugu', 'Hindi'],
  formats: ['2D'],
  releaseDate: '2026-09-24',
  firstDate: '2026-09-23',
  lastDate: '2026-09-30',
  carriedOver: false,
  ...over
});
const none = new Map<string, string>();

describe('matchMovie', () => {
  it('auto-matches an exact title with matching release date and language', () => {
    const r = matchMovie(mm({}), [bf({}), bf({ slug: 'other', title: 'Other' })], none);
    expect(r).toMatchObject({ status: 'matched', confidence: 'high', slug: 'the-paradise' });
  });

  it('treats a year suffix and & as the same title', () => {
    expect(stripYear('Hi (2026)')).toBe('Hi');
    const r = matchMovie(mm({ title: 'Minions & Monsters', language: 'English', releaseDate: '2026-07-01' }), [bf({ slug: 'minions-and-monsters', title: 'Minions and Monsters', languages: ['English'], releaseDate: '2026-07-02', firstDate: '2026-07-02' })], none);
    expect(r).toMatchObject({ status: 'matched', slug: 'minions-and-monsters' });
  });

  it('sends a match to review when MovieMint has no language or date', () => {
    const r = matchMovie(mm({ language: null }), [bf({})], none);
    expect(r).toMatchObject({ status: 'needs_review', confidence: 'medium', slug: 'the-paradise' });
    const r2 = matchMovie(mm({ language: null, releaseDate: null }), [bf({})], none);
    expect(r2).toMatchObject({ status: 'needs_review', confidence: 'low', slug: 'the-paradise' });
  });

  it('never guesses between two fitting movies', () => {
    const r = matchMovie(mm({}), [bf({}), bf({ slug: 'the-paradise-2' })], none);
    expect(r).toMatchObject({ status: 'needs_review', confidence: 'ambiguous', slug: null });
  });

  it('rejects a language that BFILMY does not have and far-apart dates', () => {
    expect(matchMovie(mm({ language: 'Hindi', title: 'Drishyam 3' }), [bf({ slug: 'drishyam-3', title: 'Drishyam 3', languages: ['Malayalam'] })], none).status).toBe('needs_review');
    expect(matchMovie(mm({ releaseDate: '2026-12-01' }), [bf({})], none).confidence).toBe('low');
  });

  it('sends a re-release that shares history with an earlier run to review', () => {
    const r = matchMovie(mm({ title: 'Devara - Part 1', badge: 'Re-Release', releaseDate: '2026-09-27' }), [bf({ slug: 'devara-part-1', title: 'Devara - Part 1', carriedOver: true, releaseDate: null, firstDate: '2025-01-01', seenOn: ['2026-09-27'] })], none);
    expect(r.status).toBe('needs_review');
    expect(r.note).toMatch(/re-release/);
  });

  it('reports no match when no title fits', () => {
    expect(matchMovie(mm({ title: 'Nothing Like It' }), [bf({})], none).status).toBe('unmatched');
  });
});
