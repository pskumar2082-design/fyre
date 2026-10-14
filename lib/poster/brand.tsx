// The Fyre poster brand: one set of tokens and building blocks shared by
// every Fyre graphic -- box-office posters (xPoster.tsx) and social cards
// (socialCard.tsx) -- so they read as one publication.
//   background  near-black charcoal (NAVY), translucent white surfaces
//   lines       thin white/accent hairlines
//   type        Noto Sans; white text, accent emphasis
//   brand       fyre logo, "FYRE" wordmark, faint tiled watermark, footer

export const NAVY = '#14161C';
export const CARD = 'rgba(255,255,255,0.04)';
export const BORDER = 'rgba(255,255,255,0.10)';
export const WHITE = '#FFFFFF';
export const DIM = 'rgba(255,255,255,0.62)';
export const FAINT = 'rgba(255,255,255,0.40)';
export const ACCENT = '#2F6FED';
export const ACCENT_TINT = 'rgba(47,111,237,0.16)';
export const ACCENT_TEXT = '#8FB4FF';

// Accent palettes for social cards. 'fyre' is the house accent the
// box-office posters use; 'gold' is the optional premium gold.
export type AccentId = 'fyre' | 'gold';
export type Accent = { line: string; tint: string; text: string; strong: string };
export const ACCENTS: Record<AccentId, Accent> = {
  fyre: { line: ACCENT, tint: ACCENT_TINT, text: ACCENT_TEXT, strong: '#5B93FF' },
  gold: { line: '#C9A24A', tint: 'rgba(201,162,74,0.16)', text: '#E9C979', strong: '#F1D18A' }
};

export const SOCIAL_HANDLE = '@Fyre_media_';
export const SITE = 'fyre.co.in';

// Tiled, faint fyre logo behind the poster content.
export function PosterWatermark({ logoSrc, width, height, opacity = 0.05 }: { logoSrc: string; width: number; height: number; opacity?: number }) {
  const tileW = 220;
  const tileH = 92;
  const cols = Math.ceil(width / tileW) + 1;
  const rows = Math.ceil(height / tileH) + 1;
  const tiles = Array.from({ length: cols * rows });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height, display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}>
      {tiles.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // stagger alternate rows so the tiled grid doesn't read as
        // obviously repeating columns
        const offsetX = row % 2 === 0 ? 0 : tileW / 2;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              position: 'absolute',
              left: col * tileW + offsetX - tileW / 2,
              top: row * tileH - tileH / 2,
              width: tileW,
              height: tileH,
              alignItems: 'center',
              justifyContent: 'center',
              opacity,
              transform: 'rotate(-14deg)'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={132} height={54} style={{ objectFit: 'contain' }} />
          </div>
        );
      })}
    </div>
  );
}
