// Output sizes for Fyre social cards (shared by the renderer and the admin
// editor). The card renders at exactly these pixel dimensions.
export type SizeId = 'ig_portrait' | 'ig_square' | 'story' | 'x_45';
export const CARD_SIZES: Record<SizeId, { w: number; h: number; label: string }> = {
  ig_portrait: { w: 1080, h: 1350, label: 'Instagram Portrait · 1080 × 1350' },
  ig_square: { w: 1080, h: 1080, label: 'Instagram Square · 1080 × 1080' },
  story: { w: 1080, h: 1920, label: 'Story · 1080 × 1920' },
  x_45: { w: 1080, h: 1350, label: 'X 4:5 · 1080 × 1350' }
};
export const DEFAULT_SIZE: SizeId = 'ig_portrait';

