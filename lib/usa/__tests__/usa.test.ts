import { describe, expect, it } from 'vitest';
import { aggregateMovie, clean, parseUsFile } from '../normalize';
import { usDayOne, usReleaseDay, usFinal } from '../days';
import { matchUsIds, usTitleKey } from '../match';

const row = (id: number, local: string, fmt: string, lang: string, movie: number, theater: string, city: string, state: string, chain: string, sold: number, seats: number, price: number) => [
  id, local, fmt, lang, movie === 1 ? 'The Paradise (2026)' : 'Other', movie, theater, city, state, chain, sold, seats, seats ? Math.round((sold / seats) * 10000) / 100 : 0, price, Math.round(sold * price * 100) / 100
];

const json = {
  shows: [
    row(11, '2026-09-23+18:00', 'Standard', 'Telugu', 1, 'Cinemark West Plano and XD', 'Plano', 'TX', 'Cinemark Theatres', 100, 200, 20),
    row(12, '2026-09-23+21:00', 'Premium Format', 'Telugu', 1, 'Cinemark West Plano and XD', 'Plano', 'TX', 'Cinemark Theatres', 150, 200, 25),
    row(13, '2026-09-24+00:10', 'Standard', 'Hindi', 1, 'AMC Dallas ', 'Dallas', 'TX', 'AMC', 10, 100, 15),
    row(14, '2026-09-23+19:00', 'Standard', 'Telugu', 1, 'Regal Edison', 'Edison', 'NJ', 'Regal', 0, 0, 0),
    row(21, '2026-09-23+19:00', 'Standard', 'Tamil', 2, 'Regal Edison', 'Edison', 'NJ', 'Regal', 5, 50, 12)
  ],
  summary: [
    ['The Paradise (2026)', 1, 3, 5900, 44.44, 260, 500],
    ['Other', 2, 1, 60, 10, 5, 50]
  ]
};

describe('USA normalize', () => {
  const file = parseUsFile(json);
  const a = aggregateMovie(file, [1])!;

  it('parses show-local date/time and keeps raw values', () => {
    expect(file.shows[2].dateLocal).toBe('2026-09-24');
    expect(file.shows[2].timeLocal).toBe('00:10');
    expect(file.shows[2].theater).toBe('AMC Dallas ');
  });

  it('headline is derived from show rows and reconciled with the summary', () => {
    expect(a.gross).toBe(5900);
    expect(a.tickets).toBe(260);
    expect(a.seats).toBe(500);
    expect(a.shows).toBe(4);
    expect(a.showsSource).toBe(3);
    expect((a.recon.shows as any).status).toBe('MISMATCH');
    expect((a.recon.gross as any).status).toBe('MATCH');
    expect(a.theatres).toBe(3);
    expect(a.cities).toBe(3);
    expect(a.states).toBe(2);
  });

  it('occupancy is tickets / seats, zero-seat shows excluded and flagged', () => {
    expect(a.occupancy).toBe(52);
    expect(a.occupancySource).toBe(44.44);
    expect(a.zeroSeatShows).toBe(1);
    expect(a.recon.occupancyCoverage).toBe('PARTIAL');
  });

  it('every dimension sums to the headline; whitespace normalized for grouping', () => {
    for (const d of Object.values(a.recon.dimensions as Record<string, string>)) expect(d).toBe('MATCH');
    const theaters = a.dims.theater.map((t) => t[0][0]);
    expect(theaters).toContain('AMC Dallas');
    expect(a.dims.format.map((t) => t[0][0]).sort()).toEqual(['Premium Format', 'Standard']);
    const tx = a.dims.state.find((t) => t[0][0] === 'TX')!;
    expect(tx.slice(1)).toEqual([3, 500, 260, 5900, 0, 2, 2]);
    expect(clean('  a  b ')).toBe('a b');
  });

  it('rejects an unexpected file shape', () => {
    expect(() => parseUsFile({ shows: [[1, 2]], summary: [] })).toThrow();
    expect(() => parseUsFile({})).toThrow();
  });
});

describe('USA release days', () => {
  it('Day 1 = first US box-office date on/after India Day 1; Day 0 = premieres', () => {
    const one = usDayOne(['2026-09-23', '2026-09-24', '2026-09-25'], '2026-09-24');
    expect(one).toBe('2026-09-24');
    expect(usReleaseDay('2026-09-23', one)).toBe(0);
    expect(usReleaseDay('2026-09-24', one)).toBe(1);
    expect(usReleaseDay('2026-09-30', one)).toBe(7);
    expect(usReleaseDay('2026-09-20', one)).toBeNull();
  });
  it('late US release: Day 1 is the first US date after India Day 1', () => {
    expect(usDayOne(['2026-10-02', '2026-10-03'], '2026-09-24')).toBe('2026-10-02');
  });
  it('advance only: India Day 1 is the expected Day 1', () => {
    expect(usDayOne([], '2026-10-10')).toBe('2026-10-10');
  });
  it('a date is final six hours after US Eastern midnight', () => {
    expect(usFinal('2026-09-29', new Date('2026-09-30T09:00:00Z'))).toBe(false);
    expect(usFinal('2026-09-29', new Date('2026-09-30T12:00:00Z'))).toBe(true);
  });
});

describe('USA matching', () => {
  const movies = [
    { movieId: 'the-paradise', slug: 'the-paradise', titles: ['The Paradise'], dayOne: '2026-09-24' },
    { movieId: 'bethlehem-kudumba-unit', slug: 'bethlehem-kudumba-unit', titles: ['Bethlehem Kudumba Unit'], dayOne: '2026-09-18' },
    { movieId: 'hi-2026', slug: 'hi-2026', titles: ['Hi (2026)', 'Hi (2026)'], dayOne: '2026-08-28' }
  ];
  it('title key drops the year and punctuation', () => {
    expect(usTitleKey('Hi! (2026)')).toBe('hi');
    expect(usTitleKey('The Paradise (2026)')).toBe('theparadise');
  });
  it('same title + date window -> matched; spelling variant -> review; unrelated -> unmatched', () => {
    const d = matchUsIds(
      [
        { sourceMovieId: 1, title: 'The Paradise (2026)', firstDate: '2026-09-23' },
        { sourceMovieId: 2, title: 'Bethlehem Kutumba Unit (2026)', firstDate: '2026-09-18' },
        { sourceMovieId: 3, title: 'America America 2 (2026)', firstDate: '2026-09-10' },
        { sourceMovieId: 4, title: 'Hi! (2026)', firstDate: '2026-08-28' }
      ],
      movies
    );
    expect(d.map((x) => x.status)).toEqual(['matched', 'needs_review', 'unmatched', 'matched']);
    expect(d[0].movieId).toBe('the-paradise');
  });
  it('outside the date window or a second id for a matched movie -> review', () => {
    const [far] = matchUsIds([{ sourceMovieId: 9, title: 'The Paradise', firstDate: '2025-01-01' }], movies);
    expect(far.status).toBe('needs_review');
    const [second] = matchUsIds([{ sourceMovieId: 8, title: 'The Paradise', firstDate: '2026-09-24' }], movies, new Map([['the-paradise', [1]]]));
    expect(second.status).toBe('needs_review');
  });
});
