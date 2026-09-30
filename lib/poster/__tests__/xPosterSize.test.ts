import { describe, expect, it } from 'vitest';
import { fitTerritoryToHeight, fitToHeight, territoryPosterHeight, X45_HEIGHT, xPosterHeight, type XPosterOptions } from '../xPoster';
import type { Comparison } from '../../analytics/types';

const rows = Array.from({ length: 40 }, (_, i) => ({ key: `state:${i}`, name: `S${i}`, sub: null, values: [null, null] }));
const movie = (slug: string) => ({ slug, title: slug, poster: null, dayOne: null, dates: [], available: true, reason: null, summary: null, lastUpdated: null });
const cmp = (n: number, withRows = true): Comparison =>
  ({
    selection: { basis: 'cumulative', day: 7 },
    context: 'X',
    selectionLabel: 'X',
    movies: Array.from({ length: n }, (_, i) => movie(`m${i}`)),
    dimension: withRows ? 'state' : null,
    dimensionLabel: 'State',
    breakdownAvailable: [true, true],
    rows: withRows ? rows : [],
    totalRows: 40,
    trend: { metric: 'gross', cumulative: true, points: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, values: [i, i] })) },
    dayOptions: [],
    advanceDayOptions: [],
    lastUpdated: null,
    generatedAt: ''
  }) as Comparison;

const opts = (summaryMetrics: XPosterOptions['summaryMetrics'], chart: boolean): XPosterOptions => ({ metric: 'gross', chart, summaryMetrics });

describe('X 4:5 posters fit 1080 x 1350', () => {
  const cases: [string, Comparison, XPosterOptions][] = [
    ['India single movie', cmp(1), opts(['gross', 'tickets', 'shows', 'occupancy'], true)],
    ['India comparison', cmp(2), opts(['gross', 'tickets', 'shows', 'occupancy'], true)],
    ['USA single movie', cmp(1), opts(['gross', 'tickets', 'shows', 'venues', 'occupancy', 'atp'], true)],
    ['USA comparison', cmp(2), opts(['gross', 'tickets', 'shows', 'venues', 'occupancy'], true)]
  ];
  for (const [name, c, o] of cases) {
    it(`${name}: content fits the canvas and keeps breakdown rows`, () => {
      const fit = fitToHeight(c, o, X45_HEIGHT);
      expect(fit.o.layout).toBe('x45');
      expect(xPosterHeight(fit.c, fit.o)).toBeLessThanOrEqual(X45_HEIGHT);
      expect(fit.c.rows.length).toBeGreaterThanOrEqual(3);
      expect(fit.c.movies).toHaveLength(c.movies.length);
    });
  }
  it('India + USA: content fits and both sides keep the same rows', () => {
    const fit = fitTerritoryToHeight(cmp(1), cmp(1), opts(['gross', 'tickets', 'shows', 'occupancy'], false), X45_HEIGHT);
    expect(territoryPosterHeight(fit.india, fit.usa, fit.o)).toBeLessThanOrEqual(X45_HEIGHT);
    expect(fit.india.rows.length).toBeGreaterThanOrEqual(3);
    expect(fit.india.rows.length).toBe(fit.usa.rows.length);
  });
  it('the natural size is unchanged', () => {
    expect(xPosterHeight({ ...cmp(2), rows: rows.slice(0, 5) }, opts(['gross', 'tickets', 'shows', 'occupancy'], false))).toBe(1478);
  });
});
