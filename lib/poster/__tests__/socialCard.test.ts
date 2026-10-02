import { describe, expect, it } from 'vitest';
import { CARD_SIZES, imageGeometry, planCard, planHeight, type CardSpec, type SizeId } from '../socialCard';
import { fitText, measure, posterText, wrap } from '../text';
import type { TemplateId } from '../../social/xPost';

const LONG = 'THE PARADISE CONTINUES ITS EXTRAORDINARY RECORD-BREAKING THEATRICAL RUN ACROSS EVERY SINGLE TERRITORY THIS WEEKEND AND BEYOND WITH HOUSEFULL SHOWS EVERYWHERE';
const img = (w: number, h: number) => ({ src: 'data:image/png;base64,', width: w, height: h, fit: 'fill' as const, zoom: 1, posX: 50, posY: 50 });
const spec = (template: TemplateId, size: SizeId, over: Partial<CardSpec> = {}): CardSpec => ({
  template,
  size,
  accent: 'fyre',
  category: 'MOVIE UPDATE',
  headline: LONG,
  subhead: 'The film maintains its momentum as its theatrical run enters another week, with strong numbers across India and overseas markets.',
  body: 'Advance bookings for the weekend are already ahead of last week in most cities. '.repeat(4),
  movie: 'The Paradise',
  highlight: 'RECORD-BREAKING',
  fact: 'Highest second-weekend gross for the star',
  hashtags: '#TheParadise #BoxOffice #IndianCinema #Nani #Fyre #Telugu',
  footer: '@Fyre_media_',
  images: [img(1600, 900), img(900, 1600), img(1000, 1000), img(1200, 1500)],
  imageLayout: 'grid4',
  heroMode: 'framed',
  numbers: { mode: 'fyre', label: 'DAY 8 BOX OFFICE', value: '₹103.19 Cr', valueLabel: 'Tracked gross', metrics: [{ label: 'Tickets', value: '15,36,120' }, { label: 'Shows', value: '10,256' }, { label: 'Occupancy', value: '50.4%' }], note: 'Fyre tracked data · India · INR' },
  watermark: true,
  ...over
});

describe('social cards never overflow their canvas', () => {
  const templates: TemplateId[] = ['news', 'imageFirst', 'boxoffice', 'achievement', 'quote'];
  for (const size of Object.keys(CARD_SIZES) as SizeId[])
    for (const t of templates)
      for (const variant of ['full', 'no-images', 'minimal', 'full-bleed'] as const) {
        it(`${t} · ${size} · ${variant}`, () => {
          const over: Partial<CardSpec> =
            variant === 'no-images' ? { images: [] } : variant === 'minimal' ? { headline: 'Short', subhead: '', body: '', fact: '', hashtags: '', images: [], numbers: null } : variant === 'full-bleed' ? { heroMode: 'full', imageLayout: 'single' } : {};
          const p = planCard(spec(t, size, over));
          expect(planHeight(p)).toBeLessThanOrEqual(p.d.avail);
          expect(p.d.W).toBe(CARD_SIZES[size].w);
          expect(p.d.H).toBe(CARD_SIZES[size].h);
          for (const b of p.blocks) expect(b.h).toBeGreaterThanOrEqual(0);
          const imgs = p.blocks.filter((b) => b.t === 'images');
          if (variant === 'full' && t !== 'imageFirst') expect(imgs.every((b) => b.h >= 200)).toBe(true);
        });
      }
});

describe('exact output sizes', () => {
  it('match the platforms', () => {
    expect(CARD_SIZES.ig_portrait).toMatchObject({ w: 1080, h: 1350 });
    expect(CARD_SIZES.ig_square).toMatchObject({ w: 1080, h: 1080 });
    expect(CARD_SIZES.story).toMatchObject({ w: 1080, h: 1920 });
    expect(CARD_SIZES.x_45).toMatchObject({ w: 1080, h: 1350 });
  });
});

describe('text fitting', () => {
  it('wraps within the width and shrinks before cutting', () => {
    const f = fitText(LONG, { maxWidth: 952, maxLines: 4, maxSize: 84, minSize: 40, weight: 800, lineHeight: 1.06 });
    expect(f.lines.length).toBeLessThanOrEqual(4);
    for (const l of f.lines) expect(measure(l, f.size, 800)).toBeLessThanOrEqual(952);
    expect(f.size).toBeLessThan(84);
  });
  it('cuts with an ellipsis only at the minimum size', () => {
    const f = fitText(LONG.repeat(4), { maxWidth: 600, maxLines: 2, maxSize: 60, minSize: 40, weight: 800, lineHeight: 1.1 });
    expect(f.truncated).toBe(true);
    expect(f.lines).toHaveLength(2);
    expect(f.lines[1].endsWith('…')).toBe(true);
  });
  it('drops what the font cannot draw and reports it', () => {
    expect(posterText('Mass hit 🔥🔥 “Paradise” — ₹100 Cr తెలుగు')).toEqual({ text: 'Mass hit “Paradise” — ₹100 Cr', removed: ['త', 'ె', 'ల', 'ు', 'గ'] });
    expect(wrap('a\nb', 40, 400, 500)).toEqual(['a', 'b']);
  });
});

describe('image placement', () => {
  it('fill covers the box, fit shows all of it, position picks the crop', () => {
    expect(imageGeometry({ width: 2000, height: 1000, fit: 'fill', zoom: 1, posX: 50, posY: 50 }, 500, 500)).toEqual({ w: 1000, h: 500, left: -250, top: 0 });
    expect(imageGeometry({ width: 2000, height: 1000, fit: 'fit', zoom: 1, posX: 50, posY: 50 }, 500, 500)).toEqual({ w: 500, h: 250, left: 0, top: 125 });
    expect(imageGeometry({ width: 2000, height: 1000, fit: 'fill', zoom: 1, posX: 0, posY: 50 }, 500, 500).left).toBe(0);
    expect(imageGeometry({ width: 1000, height: 1000, fit: 'fill', zoom: 2, posX: 100, posY: 100 }, 500, 500)).toEqual({ w: 1000, h: 1000, left: -500, top: -500 });
  });
});
