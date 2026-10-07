import { describe, expect, it } from 'vitest';
import { createBlocker, duplicateReport, metadataStatus, newFyreId, proposeSlug, splitTitleYear, type CatalogEntry } from '../core';
import { matchUsIds, NO_MATCH_NOTE } from '@/lib/usa/match';
import { buildAliasMap, groupKey } from '@/lib/bfilmy/normalize';
import { territoryTabs } from '@/lib/analytics/territoryTabs';

const catalog: CatalogEntry[] = [
  { movieId: 'the-paradise', slug: 'the-paradise', titles: ['The Paradise'], dayOne: '2026-09-24' },
  { movieId: 'fyre-1a2b3c4d', slug: 'happy-journey', titles: ['Happy Journey', 'Happy Journey (2026)'], dayOne: '2026-09-17', origin: 'bfilmy_usa' },
  { movieId: 'bku', slug: 'bethlehem-kutumba-unit', titles: ['Bethlehem Kutumba Unit'], dayOne: '2026-08-01' }
];

describe('canonical ids and slugs', () => {
  it('reads a trailing year only', () => {
    expect(splitTitleYear("Don't Trouble The Trouble (2026)")).toEqual({ title: "Don't Trouble The Trouble", year: 2026 });
    expect(splitTitleYear('Anbil Avan')).toEqual({ title: 'Anbil Avan', year: null });
    expect(splitTitleYear('Ponniyin Selvan (Part 2)')).toEqual({ title: 'Ponniyin Selvan (Part 2)', year: null });
  });
  it('makes fyre- ids', () => {
    expect(newFyreId(() => '3f9a2b1c-0000-4000-8000-000000000000')).toBe('fyre-3f9a2b1c');
    expect(newFyreId()).toMatch(/^fyre-[0-9a-f]{8}$/);
  });
  it('picks a free slug: plain, then with year, then numbered', () => {
    expect(proposeSlug("Don't Trouble The Trouble", 2026, new Set())).toBe('dont-trouble-the-trouble');
    expect(proposeSlug('Aaram', 2026, new Set(['aaram']))).toBe('aaram-2026');
    expect(proposeSlug('Aaram', 2026, new Set(['aaram', 'aaram-2026']))).toBe('aaram-2026-2');
    expect(proposeSlug('Aaram', null, new Set(['aaram']))).toBe('aaram-2');
  });
});

describe('duplicate protection', () => {
  it('blocks the same title (year, case, punctuation ignored)', () => {
    const rep = duplicateReport('HAPPY JOURNEY', catalog);
    expect(rep.exact.map((e) => e.movieId)).toEqual(['fyre-1a2b3c4d']);
    expect(createBlocker(rep, true)).toMatch(/Already a Fyre movie/);
  });
  it('asks for confirmation on a spelling variant', () => {
    const rep = duplicateReport('Bethlehem Kudumba Unit', catalog);
    expect(rep.exact).toEqual([]);
    expect(rep.similar.map((e) => e.movieId)).toEqual(['bku']);
    expect(createBlocker(rep, false)).toMatch(/Similar to/);
    expect(createBlocker(rep, true)).toBeNull();
  });
  it('allows a genuinely new movie', () => {
    expect(createBlocker(duplicateReport("Don't Trouble The Trouble", catalog), false)).toBeNull();
  });
});

describe('metadata status', () => {
  it('is incomplete until poster and release date are known, never blocking', () => {
    expect(metadataStatus({})).toEqual({ status: 'incomplete', missing: ['poster', 'releaseDate'] });
    expect(metadataStatus({ poster: 'x', releaseDate: '2026-10-02' })).toEqual({ status: 'complete', missing: [] });
  });
});

describe('listing matching', () => {
  const movies = catalog.map((c) => ({ movieId: c.movieId, slug: c.slug, titles: c.titles, dayOne: c.dayOne }));
  it('unmatched listings read neutrally', () => {
    const [d] = matchUsIds([{ sourceMovieId: 247500, title: "Don't Trouble The Trouble (2026)", firstDate: '2026-10-01' }], movies);
    expect(d.status).toBe('unmatched');
    expect(d.note).toBe(NO_MATCH_NOTE);
    expect(d.note).not.toMatch(/MovieMint/);
  });
  it('a USA-first movie attracts its India listing automatically (same title, in window)', () => {
    const [d] = matchUsIds<string>([{ sourceMovieId: 'happyjourney', title: 'Happy Journey', firstDate: '2026-09-18' }], movies, new Map(), 'India');
    expect(d).toMatchObject({ status: 'matched', movieId: 'fyre-1a2b3c4d', method: 'title+date' });
    expect(d.note).toMatch(/first India date/);
  });
  it('a second India title for a movie that already has India data waits for the admin', () => {
    const [d] = matchUsIds<string>([{ sourceMovieId: 'theparadise', title: 'The Paradise', firstDate: '2026-09-24' }], movies, new Map([['the-paradise', ['(India data)']]]), 'India');
    expect(d.status).toBe('needs_review');
    expect(d.note).toMatch(/India listing/);
  });
  it('a spelling variant is only ever a suggestion', () => {
    const [d] = matchUsIds<string>([{ sourceMovieId: 'bethlehemkudumbaunit', title: 'Bethlehem Kudumba Unit', firstDate: '2026-08-01' }], movies, new Map(), 'India');
    expect(d.status).toBe('needs_review');
    expect(d.candidates[0].movieId).toBe('bku');
  });
});

describe('confirmed India aliases', () => {
  it('group a variant into the canonical title before figures are added', () => {
    const map = buildAliasMap({}, { 'Bethlehem Kutumba Unit': ['Bethlehem Kudumba Unit'] });
    expect(groupKey('Bethlehem Kudumba Unit', map)).toBe(groupKey('Bethlehem Kutumba Unit', map));
    expect(groupKey('Bethlehem Kudumba Unit (Telugu)', map)).toBe('bethlehemkutumbaunit');
  });
});

describe('territory tabs', () => {
  const m = {} as any;
  it('shows only territories with data', () => {
    expect(territoryTabs(m, m)).toEqual({ tabs: ['overview', 'india', 'usa'], initial: 'overview' });
    expect(territoryTabs(m, null)).toEqual({ tabs: ['overview', 'india'], initial: 'india' });
    expect(territoryTabs(null, m)).toEqual({ tabs: ['overview', 'usa'], initial: 'usa' });
  });
});

// ---------------------------------------------------------------------------
// BFILMY-first discovery (no MovieMint anywhere in these decisions)
// ---------------------------------------------------------------------------
import { discoveryAction, titleProblem, enoughSourceData, DISCOVERY, NOTE, relatedTitle, findRelated } from '../core';
import { listSourceMovies } from '@/lib/usa/normalize';
import { languagesConflict } from '@/lib/usa/match';
import { summaryPlan } from '@/lib/moviemint/backfill';

describe('discovery decisions', () => {
  const box = (shows: number) => ({ kind: 'boxoffice' as const, shows, sold: shows * 50, places: shows ? 1 : 0, seats: shows * 100 });
  const india = (title: string, firstDate: string, languages?: string[]) => ({ sourceMovieId: title.toLowerCase(), title, firstDate, languages });

  it('attaches a listing to its existing movie (same title, Day-1 window, one listing)', () => {
    const [d] = matchUsIds<string>([india('The Paradise', '2026-09-23', ['Telugu'])], catalog, new Map(), 'India');
    expect(discoveryAction(d, 'The Paradise', box(500))).toEqual({ action: 'attach', movieId: 'the-paradise' });
  });

  it('creates a movie only when nothing in the catalog is near it and the listing has a real show (one is enough)', () => {
    const [d] = matchUsIds<string>([india('Vvaan', '2026-10-01', ['Hindi'])], catalog, new Map(), 'India');
    expect(d.status).toBe('unmatched');
    expect(d.note).toBe(NO_MATCH_NOTE);
    expect(discoveryAction(d, 'Vvaan', box(DISCOVERY.minShows))).toEqual({ action: 'create' });
    expect(discoveryAction(d, 'Vvaan', box(DISCOVERY.minShows - 1)).action).toBe('wait');
  });

  it('never auto-creates a second movie with the same normalized title: out-of-window, two candidates, or split listings go to review', () => {
    const [far] = matchUsIds<string>([india('The Paradise', '2027-03-01')], catalog, new Map(), 'India');
    expect(discoveryAction(far, 'The Paradise', box(500)).action).toBe('review');
    const two = [...catalog, { movieId: 'fyre-99999999', slug: 'the-paradise-2027', titles: ['The Paradise'], dayOne: '2027-02-01' }];
    const [both] = matchUsIds<string>([india('The Paradise', '2026-09-24')], two, new Map(), 'India');
    expect(both.status).toBe('needs_review');
    expect(discoveryAction(both, 'The Paradise', box(500)).action).toBe('review');
    const [split] = matchUsIds<string>([india('The Paradise', '2026-09-24')], catalog, new Map([['the-paradise', ['the paradise telugu']]]), 'India');
    expect(discoveryAction(split, 'The Paradise', box(500)).action).toBe('review');
  });

  it('a spelling variant is review, never a new movie', () => {
    const [d] = matchUsIds<string>([india('Happy Jouney', '2026-09-18')], catalog, new Map(), 'India');
    expect(d.status).toBe('needs_review');
    expect(discoveryAction(d, 'Happy Jouney', box(500)).action).toBe('review');
  });

  it('same title but no shared language is review', () => {
    const withLang = catalog.map((m) => (m.movieId === 'the-paradise' ? { ...m, languages: ['Telugu'] } : m));
    const [d] = matchUsIds<string>([india('The Paradise', '2026-09-24', ['Malayalam'])], withLang, new Map(), 'India');
    expect(d.status).toBe('needs_review');
    expect(languagesConflict(['Telugu', 'Hindi'], ['hindi'])).toBe(false);
    expect(languagesConflict(['Telugu'], ['Malayalam'])).toBe(true);
    expect(languagesConflict([], ['Malayalam'])).toBe(false);
    expect(languagesConflict(['Unknown'], ['Malayalam'])).toBe(false);
  });

  it('another undecided listing with the same title waits for the admin', () => {
    const [d] = matchUsIds<string>([india('Hanuman Ansh', '2026-10-01')], catalog, new Map(), 'India');
    expect(discoveryAction(d, 'Hanuman Ansh', box(500), { sameTitleElsewhere: true }).action).toBe('review');
  });

  it('junk titles are never created', () => {
    for (const t of ['Test Show', 'Untitled', 'TBA', 'Private Screening', '12', '—', 'x'.repeat(130), 'Adventure of Jetcat 7D - Combo']) expect(titleProblem(t)).not.toBeNull();
    for (const t of ['Vvaan', 'Hanuman Ansh', 'The Paradise', 'Hi!', 'OG', 'Kantara: Chapter 1', 'Avatar 3D', 'Jayanti 2', 'Sardar Sarvai Papanna - The Rebel King of Deccan']) expect(titleProblem(t)).toBeNull();
    const [d] = matchUsIds<string>([india('Untitled', '2026-10-01')], catalog, new Map(), 'India');
    expect(discoveryAction(d, 'Untitled', box(500)).action).toBe('wait');
  });

  it('advance presence alone never creates a movie: it stays a candidate until shows appear', () => {
    expect(DISCOVERY.minShows).toBe(1);
    const [d] = matchUsIds<string>([india('Vvaan', '2026-10-01')], catalog, new Map(), 'India');
    // even a huge advance listing waits
    expect(discoveryAction(d, 'Vvaan', { kind: 'advance', shows: 5000, sold: 1e6, places: 400, seats: 1e6 })).toEqual({ action: 'wait', note: NOTE.advanceOnly });
    expect(enoughSourceData({ kind: 'advance', shows: 5000, sold: 1e6, places: 400, seats: 1e6 })).toBe(false);
    // ... and is created normally once it appears in a box-office file
    expect(discoveryAction(d, 'Vvaan', { kind: 'boxoffice', shows: 1, sold: 0, places: 1, seats: 120 })).toEqual({ action: 'create' });
  });

  it('one legitimate show at a real venue is enough; a show-less or placeless row is not', () => {
    expect(enoughSourceData({ kind: 'boxoffice', shows: 1, sold: 0, places: 1, seats: 0 })).toBe(true);
    expect(enoughSourceData({ kind: 'boxoffice', shows: 1, sold: 0, places: 0, seats: 150 })).toBe(true);
    expect(enoughSourceData({ kind: 'boxoffice', shows: 0, sold: 0, places: 0, seats: 0 })).toBe(false);
    expect(enoughSourceData({ kind: 'boxoffice', shows: 3, sold: 10, places: 0, seats: 0 })).toBe(false);
  });

  it('junk / ride / combo listings stay filtered and ambiguous duplicates still go to review, whatever the evidence', () => {
    const [j] = matchUsIds<string>([india('Adventure of Jetcat 7D - Combo', '2026-10-01')], catalog, new Map(), 'India');
    expect(discoveryAction(j, 'Adventure of Jetcat 7D - Combo', box(50)).action).toBe('wait');
    expect((discoveryAction(j, 'Adventure of Jetcat 7D - Combo', box(50)) as any).note.startsWith(NOTE.filtered)).toBe(true);
    const [d] = matchUsIds<string>([india('Doraemon: Castle of the Undersea Devil', '2026-10-01')], catalog, new Map(), 'India');
    expect(discoveryAction(d, 'Doraemon: Castle of the Undersea Devil', box(1), { related: 'Doraemon the Movie: New Nobita and the Castle of the Undersea Devil' }).action).toBe('review');
    expect(discoveryAction(d, 'Doraemon: Castle of the Undersea Devil', box(1), { sameTitleElsewhere: true }).action).toBe('review');
  });

  it('repeated rows for the same USA show do not inflate the evidence', () => {
    const show = { showId: 77, local: '2026-10-01 19:00', dateLocal: '2026-10-01', timeLocal: '19:00', format: '2D', language: 'Telugu', title: 'New Film', sourceMovieId: 9, theater: 'AMC Plano', city: 'Plano', state: 'TX', chain: 'AMC', sold: 10, seats: 100, occupancySource: null, price: 15, gross: 150 };
    const [m] = listSourceMovies({ summary: [], shows: [show, { ...show }, { ...show }] } as any);
    expect(m).toMatchObject({ shows: 1, places: 1, sold: 10, seats: 100 });
    const [n] = listSourceMovies({ summary: [], shows: [show, { ...show, showId: 78, local: '2026-10-01 22:00' }] } as any);
    expect(n).toMatchObject({ shows: 2, places: 1 });
  });
});

describe('related titles never become two movies', () => {
  it('flags the same film under another name', () => {
    expect(relatedTitle('Doraemon: Castle of the Undersea Devil', 'Doraemon the Movie: New Nobita and the Castle of the Undersea Devil')).toBe(true);
    expect(relatedTitle('Jayanti', 'Jayanti 2')).toBe(true);
    expect(relatedTitle('Happy Journey', 'Happy Jouney')).toBe(true);
    expect(relatedTitle('The Paradise', 'The Paradise (2026)')).toBe(true);
    expect(relatedTitle('Kantara Chapter 1', 'Kantara: Chapter 1 (Hindi)')).toBe(true);
  });
  it('leaves different films alone', () => {
    expect(relatedTitle('Bail', 'Bhed')).toBe(false);
    expect(relatedTitle('Sigma', 'Spark')).toBe(false);
    expect(relatedTitle('The Third Murder', 'The Paradise')).toBe(false);
    expect(relatedTitle('Prem Keetanu', 'Prem XL')).toBe(false);
    expect(relatedTitle('Toss', 'Tatvam')).toBe(false);
  });
  it('a related title sends an otherwise creatable listing to review', () => {
    const [d] = matchUsIds<string>([{ sourceMovieId: 'doraemoncastle', title: 'Doraemon: Castle of the Undersea Devil', firstDate: '2026-10-02' }], catalog, new Map(), 'India');
    const related = findRelated('Doraemon: Castle of the Undersea Devil', ['Sigma', 'Doraemon the Movie: New Nobita and the Castle of the Undersea Devil']);
    expect(related).toBe('Doraemon the Movie: New Nobita and the Castle of the Undersea Devil');
    expect(discoveryAction(d, 'Doraemon: Castle of the Undersea Devil', { kind: 'boxoffice', shows: 900, sold: 1e5, places: 120, seats: 2e5 }, { related }).action).toBe('review');
    expect(discoveryAction(d, 'Doraemon: Castle of the Undersea Devil', { kind: 'boxoffice', shows: 900, sold: 1e5, places: 120, seats: 2e5 }, { related: null }).action).toBe('create');
  });
});

describe('batched history import', () => {
  it('fetches each date file once for every movie that needs it', () => {
    const plan = summaryPlan(
      [
        { id: 'a', next: '2026-09-20', until: '2026-09-22' },
        { id: 'b', next: '2026-09-21', until: null },
        { id: 'c', next: null, until: null }
      ],
      '2026-09-23'
    );
    expect([...plan.keys()]).toEqual(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']);
    expect(plan.get('2026-09-20')).toEqual(['a']);
    expect(plan.get('2026-09-21')).toEqual(['a', 'b']);
    expect(plan.get('2026-09-23')).toEqual(['b']);
  });
});
