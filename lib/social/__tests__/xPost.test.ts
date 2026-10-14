import { describe, expect, it } from 'vitest';
import {
  buildCaption,
  classifyPost,
  cleanPostText,
  detectMovie,
  extractNumbers,
  isAllowedMediaUrl,
  mediaVariant,
  normalizeSyndication,
  parseOembed,
  parseXPostUrl,
  reportedSelection,
  rewriteForFyre,
  sameAsReported,
  splitHashtag,
  syndicationToken,
  templateFor
} from '../xPost';

describe('X post URLs', () => {
  it('accepts individual posts on x.com and twitter.com', () => {
    expect(parseXPostUrl('https://x.com/TrackTwood/status/2105847628860887203')).toEqual({ id: '2105847628860887203', handle: 'TrackTwood', url: 'https://x.com/TrackTwood/status/2105847628860887203' });
    expect(parseXPostUrl('twitter.com/MythriOfficial/status/2105290078230835355?s=20')).toMatchObject({ id: '2105290078230835355', handle: 'MythriOfficial' });
    expect(parseXPostUrl('https://mobile.twitter.com/a_b/statuses/123/photo/1')).toMatchObject({ id: '123', handle: 'a_b' });
    expect(parseXPostUrl('https://x.com/i/web/status/99')).toMatchObject({ id: '99', handle: null });
  });
  it('refuses anything that is not one post', () => {
    for (const bad of [
      'https://x.com/TrackTwood',
      'https://x.com/search?q=paradise',
      'https://example.com/a/status/1',
      'https://x.com.evil.com/a/status/1',
      'https://evil.com/?u=https://x.com/a/status/1',
      'javascript:alert(1)',
      'https://user:pw@x.com/a/status/1',
      'https://x.com:8443/a/status/1',
      'https://x.com/a/status/abc',
      'file:///etc/passwd'
    ])
      expect(parseXPostUrl(bad)).toHaveProperty('error');
  });
  it('builds the embed token X expects (same formula as X’s embed widget)', () => {
    expect(syndicationToken('20')).toBe('6dq1a2xwd93');
    expect(syndicationToken('2105847628860887203')).toMatch(/^[0-9a-z]+$/);
  });
});

describe('media hosts', () => {
  it('allows only X media images', () => {
    expect(isAllowedMediaUrl('https://pbs.twimg.com/media/HTl5QAIaQAAXhpR.jpg')).toBe(true);
    expect(isAllowedMediaUrl('https://pbs.twimg.com/amplify_video_thumb/1/img/a.jpg')).toBe(true);
    expect(isAllowedMediaUrl('https://pbs.twimg.com/profile_images/1/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('http://pbs.twimg.com/media/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('https://pbs.twimg.com.evil.com/media/a.jpg')).toBe(false);
    expect(isAllowedMediaUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
  });
  it('requests a sized JPEG variant', () => {
    expect(mediaVariant('https://pbs.twimg.com/media/HTl5QAIaQAAXhpR.jpg', 'large')).toBe('https://pbs.twimg.com/media/HTl5QAIaQAAXhpR?format=jpg&name=large');
  });
});

const ref = { id: '2105847628860887203', handle: 'TrackTwood', url: '' };
const synd = {
  id_str: '2105847628860887203',
  created_at: '2026-10-02T02:29:34.000Z',
  lang: 'en',
  text: '#VijaySethupathi’s #Baththa recorded an All India tracked gross of ₹1.54Cr on its opening day. Though the film had a slow start, the positive sign is the steady growth.\n\nhttps://t.co/kwWm1ngS5b https://t.co/a4rGqLhdXy',
  user: { name: 'TrackTollywood', screen_name: 'TrackTwood' },
  entities: {
    hashtags: [{ text: 'VijaySethupathi' }, { text: 'Baththa' }],
    urls: [{ url: 'https://t.co/kwWm1ngS5b', expanded_url: 'https://tracktollywood.com/box-office-collection/baththa/' }],
    media: [{ url: 'https://t.co/a4rGqLhdXy' }]
  },
  mediaDetails: [
    { type: 'photo', media_url_https: 'https://pbs.twimg.com/media/HTl5QAIaQAAXhpR.jpg', original_info: { width: 962, height: 830 } },
    { type: 'photo', media_url_https: 'https://evil.example/x.jpg', original_info: { width: 1, height: 1 } }
  ]
};

describe('reading a post', () => {
  it('normalizes X embed data (text, author, date, hashtags, links, media)', () => {
    const p = normalizeSyndication(synd, ref)!;
    expect(p).toMatchObject({ authorName: 'TrackTollywood', handle: 'TrackTwood', postedAt: '2026-10-02T02:29:34.000Z', hashtags: ['VijaySethupathi', 'Baththa'], links: ['https://tracktollywood.com/box-office-collection/baththa/'] });
    expect(p.text).not.toContain('t.co');
    expect(p.media).toEqual([{ type: 'photo', url: 'https://pbs.twimg.com/media/HTl5QAIaQAAXhpR.jpg', width: 962, height: 830, alt: null }]);
  });
  it('falls back to oEmbed text', () => {
    const p = parseOembed(
      { author_name: 'jack', author_url: 'https://x.com/jack', html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr &amp; more</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>' },
      { id: '20', handle: 'jack', url: '' }
    )!;
    expect(p).toMatchObject({ text: 'just setting up my twttr & more', handle: 'jack', via: 'oembed', media: [] });
    expect(p.postedAt?.slice(0, 10)).toBe('2006-03-21');
  });
  it('cleans text for a poster: links, emoji and tag-only lines go; inline tags become words', () => {
    const t = cleanPostText({ text: '#Irumudi is being loved globally ❤️\n\nTrending #1 on Netflix ❤‍🔥\n\n#IRUMUDI / #IRUMUDIKATTU https://t.co/x', mentions: [] });
    expect(t).toBe('Irumudi is being loved globally\n\nTrending #1 on Netflix');
    expect(splitHashtag('RanabaaliOnOct16th')).toBe('Ranabaali On Oct 16th');
  });
});

describe('figures and conflicts', () => {
  it('finds collection figures', () => {
    expect(extractNumbers('gross of ₹1.54Cr on its opening day').map((n) => [n.raw, n.value])).toEqual([['₹1.54Cr', 15_400_000]]);
    expect(extractNumbers('grosses a HISTORIC 250 CRORES+ WORLDWIDE')[0].value).toBe(2_500_000_000);
    expect(extractNumbers('USA $1.2M so far')[0]).toMatchObject({ currency: 'USD', value: 1_200_000 });
    expect(extractNumbers('₹45.6 L day 2')[0].value).toBe(4_560_000);
  });
  it('reads which day a figure is about', () => {
    expect(reportedSelection('on its opening day')).toEqual({ kind: 'day', day: 1 });
    expect(reportedSelection('Day 8 box office')).toEqual({ kind: 'day', day: 8 });
    expect(reportedSelection('₹100 Cr in 4 days')).toEqual({ kind: 'cumulative', days: 4 });
    expect(reportedSelection('250 crores worldwide')).toEqual({ kind: 'cumulative', days: null });
  });
  it('compares at the precision the post used, never silently', () => {
    const [p] = extractNumbers('₹1.54Cr');
    expect(sameAsReported(p, 15_378_000, 'INR')).toBe(true);
    const [q] = extractNumbers('₹123 Cr');
    expect(sameAsReported(q, 1_031_900_000, 'INR')).toBe(false);
    expect(sameAsReported(q, 1_230_000_000, 'USD')).toBe(false);
  });
});

describe('content type and template', () => {
  it('suggests a type from the words in the post', () => {
    expect(classifyPost('#Baththa recorded an All India tracked gross of ₹1.54Cr on its opening day', 1)).toBe('boxoffice');
    expect(classifyPost('#Irumudi grosses a HISTORIC 250 CRORES+ WORLDWIDE', 1)).toBe('achievement');
    expect(classifyPost('Here is the First Look of #Peddi', 1)).toBe('firstLook');
    expect(classifyPost('#Ranabaali GRAND RELEASE WORLDWIDE ON 16.10.26', 1)).toBe('releaseDate');
    expect(classifyPost('#ThellaKaagitham: 2.25 Stars. The film tries to deliver...', 0)).toBe('review');
    expect(classifyPost('Welcoming the talented actor on board for #NBK111', 1)).toBe('casting');
    expect(classifyPost('Lovely evening with the team', 0)).toBe('general');
  });
  it('maps types to the five templates', () => {
    expect(templateFor('boxoffice', 0, 50)).toBe('boxoffice');
    expect(templateFor('achievement', 1, 50)).toBe('achievement');
    expect(templateFor('firstLook', 1, 50)).toBe('imageFirst');
    expect(templateFor('firstLook', 0, 50)).toBe('news');
    expect(templateFor('review', 0, 400)).toBe('quote');
    expect(templateFor('general', 0, 400)).toBe('quote');
    expect(templateFor('releaseDate', 1, 400)).toBe('news');
  });
  it('detects the Fyre movie from hashtags or the title', () => {
    const cat = [
      { slug: 'the-paradise', title: 'The Paradise' },
      { slug: 'hi-2026', title: 'Hi' }
    ];
    expect(detectMovie({ text: '#TheParadise day 8', hashtags: ['TheParadise'] }, cat)).toMatchObject({ slug: 'the-paradise', reason: 'hashtag' });
    expect(detectMovie({ text: 'The Paradise crosses 100 Cr', hashtags: [] }, cat)).toMatchObject({ slug: 'the-paradise' });
    expect(detectMovie({ text: 'Hi everyone', hashtags: [] }, cat)).toBeNull();
  });
});

describe('Rewrite for Fyre', () => {
  const post = { text: synd.text, mentions: [], hashtags: ['VijaySethupathi', 'Baththa'] };
  it('restructures the post into headline / subhead / hashtags / caption', () => {
    const c = rewriteForFyre(post, { movie: 'Baththa', type: 'boxoffice' });
    expect(c.headline).toBe('VIJAY SETHUPATHI’S BATHTHA RECORDED AN ALL INDIA TRACKED GROSS OF ₹1.54CR ON ITS OPENING DAY');
    expect(c.subhead).toMatch(/^Though the film had a slow start/);
    expect(c.hashtags).toBe('#Baththa #VijaySethupathi #BoxOffice #IndianCinema');
    expect(c.caption).toContain('🔥');
  });
  it('never invents a figure: every number in the output is in the post', () => {
    const c = rewriteForFyre(post, { movie: 'Baththa', type: 'boxoffice' });
    const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    const source = new Set(nums(post.text));
    for (const n of nums([c.headline, c.subhead, c.body, c.caption].join(' '))) expect(source.has(n)).toBe(true);
  });
  it('caption follows the edited fields', () => {
    expect(buildCaption({ headline: 'THE PARADISE CONTINUES ITS STRONG RUN', subhead: 'The film keeps its momentum.', hashtags: '#TheParadise #BoxOffice' })).toBe(
      'The Paradise Continues its Strong Run 🔥\n\nThe film keeps its momentum.\n\n#TheParadise #BoxOffice'
    );
  });
});
