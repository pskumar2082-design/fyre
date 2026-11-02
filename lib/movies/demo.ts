import type { FigureDay, FigureTotal, Movie, ReportedFigure } from './types';

// LABELLED TEST DATA for the new movie pages, until the Sacnilk importer is
// reviewed and approved. Titles are fictional and start with "Sample:";
// every figure is made up. Refused on Vercel production (see store.ts).

const DAY = 86_400_000;
const ist = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

type Seed = Omit<Movie, 'lifecycleSince' | 'statusReason' | 'isTestData' | 'override' | 'certificate' | 'posterUrl'> & { daysAgo: number; base?: number };

const SEEDS: Seed[] = [
  { id: 'demo-1', slug: 'sample-godavari-express', title: 'Sample: Godavari Express', primaryLanguage: 'Telugu', languages: ['Telugu', 'Hindi'], releaseDate: null, lifecycle: 'now_showing', showOnFyre: true, featured: true, daysAgo: 8, base: 14.2 },
  { id: 'demo-2', slug: 'sample-kalki-road', title: 'Sample: Kalki Road', primaryLanguage: 'Telugu', languages: ['Telugu'], releaseDate: null, lifecycle: 'now_showing', showOnFyre: true, featured: false, daysAgo: 1, base: 9.6 },
  { id: 'demo-3', slug: 'sample-mumbai-monsoon', title: 'Sample: Mumbai Monsoon', primaryLanguage: 'Hindi', languages: ['Hindi'], releaseDate: null, lifecycle: 'now_showing', showOnFyre: true, featured: false, daysAgo: 5, base: 11.3 },
  { id: 'demo-4', slug: 'sample-ending-soon', title: 'Sample: Ending Soon', primaryLanguage: 'Telugu', languages: ['Telugu'], releaseDate: null, lifecycle: 'ending_check', showOnFyre: true, featured: false, daysAgo: 34, base: 3.1 },
  { id: 'demo-5', slug: 'sample-chennai-nights', title: 'Sample: Chennai Nights', primaryLanguage: 'Tamil', languages: ['Tamil', 'Telugu'], releaseDate: null, lifecycle: 'now_showing', showOnFyre: false, featured: false, daysAgo: 3, base: 6.4 },
  { id: 'demo-6', slug: 'sample-old-hit', title: 'Sample: Old Hit', primaryLanguage: 'Telugu', languages: ['Telugu'], releaseDate: null, lifecycle: 'run_ended', showOnFyre: true, featured: false, daysAgo: 52, base: 12 },
  { id: 'demo-7', slug: 'sample-sankranti-saga', title: 'Sample: Sankranti Saga', primaryLanguage: 'Telugu', languages: ['Telugu'], releaseDate: null, lifecycle: 'upcoming', showOnFyre: true, featured: false, daysAgo: -10 },
  { id: 'demo-8', slug: 'sample-diwali-dhamaka', title: 'Sample: Diwali Dhamaka', primaryLanguage: 'Telugu', languages: ['Telugu', 'Tamil'], releaseDate: null, lifecycle: 'upcoming', showOnFyre: true, featured: false, daysAgo: -3 }
];

export function demoMovies(now: Date): Movie[] {
  return SEEDS.map(({ daysAgo, base: _b, ...s }) => ({
    ...s,
    releaseDate: ist(new Date(now.getTime() - daysAgo * DAY)),
    posterUrl: null,
    certificate: 'U/A (sample)',
    lifecycleSince: new Date(now.getTime() - Math.max(0, daysAgo) * DAY).toISOString(),
    override: null,
    statusReason: 'Test data',
    isTestData: true
  }));
}

export function demoFigures(now: Date): { days: FigureDay[]; totals: FigureTotal[]; reported: ReportedFigure[] } {
  const days: FigureDay[] = [];
  const totals: FigureTotal[] = [];
  const fetchedAt = now.toISOString();
  for (const s of SEEDS) {
    if (!s.base || s.daysAgo < 0) continue;
    const shown = Math.min(s.daysAgo + 1, 14);
    let net = 0;
    let gross = 0;
    for (let i = 0; i < shown; i++) {
      const d = new Date(now.getTime() - (s.daysAgo - i) * DAY);
      const isToday = i === s.daysAgo;
      const decay = Math.pow(0.82, i) * (d.getUTCDay() === 6 || d.getUTCDay() === 0 ? 1.35 : 1);
      const n = Math.round(s.base * decay * 100) / 100;
      const g = Math.round(n * 1.18 * 100) / 100;
      net += n;
      gross += g;
      const status = isToday ? 'early_estimate' : 'estimate';
      const day = ist(d);
      const row = (metric: FigureDay['metric'], value: number) => days.push({ movieId: s.id, source: 'demo', day, dayNumber: i + 1, metric, value, status, sourceUpdatedAt: new Date(now.getTime() - 35 * 60_000).toISOString(), fetchedAt });
      row('india_net', n);
      row('india_gross', g);
      row('occupancy_pct', Math.round(Math.max(9, 62 * Math.pow(0.86, i)) * 10) / 10);
      row('shows', Math.round(5200 * Math.pow(0.9, i)));
    }
    const asOf = ist(new Date(now.getTime() - DAY));
    const t = (metric: FigureTotal['metric'], value: number) => totals.push({ movieId: s.id, source: 'demo', metric, value: Math.round(value * 100) / 100, status: 'estimate', asOf, sourceUpdatedAt: new Date(now.getTime() - 35 * 60_000).toISOString(), fetchedAt });
    t('india_net', net);
    t('india_gross', gross);
    // The source states its own worldwide figure; Fyre never adds India and overseas itself.
    t('overseas_gross', gross * 0.21);
    t('worldwide_gross', gross * 1.21);
  }
  const reported: ReportedFigure[] = [
    { id: 'demo-r1', movieId: 'demo-1', metric: 'worldwide_gross', value: 150, reportedBy: 'Producer (sample)', sourceUrl: 'https://example.com/sample-announcement', reportedOn: ist(new Date(now.getTime() - 2 * DAY)), enteredBy: 'sample' }
  ];
  return { days, totals, reported };
}
