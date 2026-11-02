import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateLifecycle, inActiveListings, inUpcoming, isPubliclySelected } from '../lifecycle';
import { assertSingleSource, dayRows, formatValue, MixedSourcesError, pickSource, totalsFor } from '../figures';
import { demoFigures, demoMovies } from '../demo';
import { getMoviesStore, MoviesUnavailableError } from '../store';
import type { LifecycleSignals, Movie } from '../types';

const NOW = new Date('2026-11-20T08:00:00Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const movie = (p: Partial<Movie> = {}): Movie => ({
  id: 'm',
  slug: 'm',
  title: 'M',
  primaryLanguage: 'Telugu',
  languages: ['Telugu'],
  releaseDate: day(-40),
  posterUrl: null,
  certificate: null,
  lifecycle: 'now_showing',
  lifecycleSince: new Date(NOW.getTime() - 40 * 86_400_000).toISOString(),
  showOnFyre: false,
  featured: false,
  override: null,
  statusReason: '',
  isTestData: false,
  ...p
});
const sig = (p: Partial<LifecycleSignals> = {}): LifecycleSignals => ({ lastShowDate: null, lastFigureDate: null, sourcesHealthy: true, endingCheckSince: null, ...p });

describe('who is public', () => {
  it('Telugu automatically, others only when selected', () => {
    expect(isPubliclySelected(movie())).toBe(true);
    expect(isPubliclySelected(movie({ primaryLanguage: 'Hindi' }))).toBe(false);
    expect(isPubliclySelected(movie({ primaryLanguage: 'Hindi', showOnFyre: true }))).toBe(true);
  });
  it('ended and archived runs leave the active lists; ending check stays', () => {
    expect(inActiveListings(movie({ lifecycle: 'ending_check' }))).toBe(true);
    expect(inActiveListings(movie({ lifecycle: 'run_ended' }))).toBe(false);
    expect(inActiveListings(movie({ lifecycle: 'archived' }))).toBe(false);
    expect(inUpcoming(movie({ lifecycle: 'upcoming' }))).toBe(true);
  });
  it('admin overrides take effect at once', () => {
    expect(inActiveListings(movie({ override: 'ended' }))).toBe(false);
    expect(inActiveListings(movie({ lifecycle: 'run_ended', override: 'running' }))).toBe(true);
  });
});

describe('lifecycle rules', () => {
  it('missing data never ends a run', () => {
    expect(evaluateLifecycle(movie(), sig(), NOW)).toMatchObject({ next: 'now_showing', changed: false });
  });
  it('a failing source freezes every change', () => {
    expect(evaluateLifecycle(movie(), sig({ lastFigureDate: day(-20), sourcesHealthy: false }), NOW).changed).toBe(false);
  });
  it('28+ days and 7 quiet days -> ending check; activity resumes -> back', () => {
    expect(evaluateLifecycle(movie(), sig({ lastShowDate: day(-8) }), NOW)).toMatchObject({ next: 'ending_check', changed: true });
    expect(evaluateLifecycle(movie({ releaseDate: day(-20) }), sig({ lastShowDate: day(-8) }), NOW).changed).toBe(false);
    expect(evaluateLifecycle(movie({ lifecycle: 'ending_check' }), sig({ lastShowDate: day(-1) }), NOW).next).toBe('now_showing');
  });
  it('ending check -> run ended after 7 more quiet days; archived 30 days later', () => {
    const ec = movie({ lifecycle: 'ending_check', lifecycleSince: new Date(NOW.getTime() - 8 * 86_400_000).toISOString() });
    expect(evaluateLifecycle(ec, sig({ lastShowDate: day(-16) }), NOW).next).toBe('run_ended');
    const ended = movie({ lifecycle: 'run_ended', lifecycleSince: new Date(NOW.getTime() - 31 * 86_400_000).toISOString() });
    expect(evaluateLifecycle(ended, sig(), NOW).next).toBe('archived');
  });
  it('upcoming -> now showing only after release and first activity', () => {
    const up = movie({ lifecycle: 'upcoming', releaseDate: day(0) });
    expect(evaluateLifecycle(up, sig(), NOW).changed).toBe(false);
    expect(evaluateLifecycle(up, sig({ lastFigureDate: day(0) }), NOW).next).toBe('now_showing');
    expect(evaluateLifecycle(movie({ lifecycle: 'upcoming', releaseDate: day(3) }), sig({ lastFigureDate: day(0) }), NOW).changed).toBe(false);
  });
  it('overrides', () => {
    expect(evaluateLifecycle(movie({ override: 'ended' }), sig(), NOW).next).toBe('run_ended');
    expect(evaluateLifecycle(movie({ lifecycle: 'ending_check', override: 'running' }), sig(), NOW).next).toBe('now_showing');
  });
});

describe('figures: one source, labelled, never combined', () => {
  it('refuses to combine sources', () => {
    expect(() => assertSingleSource([{ source: 'sacnilk' }, { source: 'reported' }])).toThrow(MixedSourcesError);
    expect(assertSingleSource([{ source: 'sacnilk' }, { source: 'sacnilk' }])).toBe('sacnilk');
  });
  it('picks a single preferred source', () => {
    expect(pickSource(['reported', 'sacnilk'], ['sacnilk'])).toBe('sacnilk');
    expect(pickSource(['reported'], ['sacnilk'])).toBeNull();
  });
  it('missing values read "Not reported", never 0', () => {
    expect(formatValue('india_net', undefined)).toBe('Not reported');
    expect(formatValue('india_net', 12.345)).toBe('₹12.35 Cr');
    expect(formatValue('occupancy_pct', 41.27)).toBe('41.3%');
  });
  it('demo day rows and totals stay within one source and mark the running day as an early estimate', () => {
    const f = demoFigures(NOW);
    const rows = dayRows(f.days.filter((d) => d.movieId === 'demo-1'), 'demo');
    expect(rows[0].values.india_net?.status).toBe('early_estimate');
    expect(rows[1].values.india_net?.status).toBe('estimate');
    const totals = totalsFor(f.totals.filter((t) => t.movieId === 'demo-1'), 'demo');
    expect(totals.worldwide_gross?.value).toBeGreaterThan(totals.india_gross!.value);
  });
  it('every demo movie is test data with a Sample title', () => {
    expect(demoMovies(NOW).every((m) => m.isTestData && m.title.startsWith('Sample:'))).toBe(true);
  });
});

describe('test data never reaches production', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('refuses the demo store on Vercel production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('MOVIES_SOURCE', 'demo');
    expect(() => getMoviesStore()).toThrow(MoviesUnavailableError);
  });
});
