// Text on Fyre social cards: what the poster font can draw, and exact line
// breaking. Lines are measured with the font's own advance widths
// (lib/poster/fonts/metrics.json, generated from the bundled Noto Sans
// Latin files) and rendered one line per row, so what we measure is what
// Satori draws -- text never overflows its box; it shrinks, then is cut
// with "…" as a last resort.
import metrics from './fonts/metrics.json';

export type Weight = 400 | 700 | 800;
const TABLE: Record<Weight, Record<string, number>> = {
  400: (metrics as any).advance.Regular,
  700: (metrics as any).advance.Bold,
  800: (metrics as any).advance.ExtraBold
};
const FALLBACK = 600; // unknown glyphs are removed by posterText; this is just a guard

export function supported(ch: string): boolean {
  return TABLE[700][String(ch.codePointAt(0))] != null;
}

// Emoji, flags, skin tones, joiners and variation selectors never reach a
// poster; typographic substitutions keep the meaning.
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}‍︎️⃣\u{E0020}-\u{E007F}]/gu;

// Text the poster can draw. `removed` lists characters that had to go
// (other scripts, symbols) so the editor can warn the admin.
export function posterText(raw: string): { text: string; removed: string[] } {
  const removed = new Set<string>();
  let t = String(raw ?? '')
    .replace(EMOJI, '')
    .replace(/×/g, 'x')
    .replace(/•/g, '·')
    .replace(/\r/g, '');
  let out = '';
  for (const ch of t) {
    if (ch === '\n' || supported(ch)) out += ch;
    else if (/\s/.test(ch)) out += ' ';
    else removed.add(ch);
  }
  t = out
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: t, removed: [...removed] };
}

export function measure(text: string, size: number, weight: Weight, letterSpacing = 0): number {
  const table = TABLE[weight];
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += (table[String(ch.codePointAt(0))] ?? FALLBACK) / 1000;
    n++;
  }
  return w * size + letterSpacing * n;
}

// Greedy word wrap; a single word wider than the line is broken by
// characters. Explicit newlines are kept.
export function wrap(text: string, size: number, weight: Weight, maxWidth: number, letterSpacing = 0): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ').filter(Boolean);
    let cur = '';
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (measure(next, size, weight, letterSpacing) <= maxWidth) {
        cur = next;
        continue;
      }
      if (cur) lines.push(cur);
      if (measure(word, size, weight, letterSpacing) <= maxWidth) cur = word;
      else {
        let piece = '';
        for (const ch of word) {
          if (measure(piece + ch, size, weight, letterSpacing) > maxWidth && piece) {
            lines.push(piece);
            piece = ch;
          } else piece += ch;
        }
        cur = piece;
      }
    }
    if (cur || words.length === 0) lines.push(cur);
  }
  // Drop a leading/trailing empty line from stray newlines.
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

export type FitOptions = {
  maxWidth: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  weight: Weight;
  lineHeight: number; // multiple of size
  letterSpacing?: number;
};

export type Fitted = { lines: string[]; size: number; lineHeightPx: number; height: number; truncated: boolean };

// Largest size (step 2px) at which the text fits in maxLines; at minSize the
// last line is cut with "…".
export function fitText(text: string, o: FitOptions): Fitted {
  const t = text.trim();
  if (!t) return { lines: [], size: o.minSize, lineHeightPx: 0, height: 0, truncated: false };
  for (let size = o.maxSize; size >= o.minSize; size -= 2) {
    const lines = wrap(t, size, o.weight, o.maxWidth, o.letterSpacing);
    if (lines.length <= o.maxLines) {
      const lh = Math.round(size * o.lineHeight);
      return { lines, size, lineHeightPx: lh, height: lh * lines.length, truncated: false };
    }
  }
  const size = o.minSize;
  const all = wrap(t, size, o.weight, o.maxWidth, o.letterSpacing);
  const lines = all.slice(0, o.maxLines);
  let last = lines[lines.length - 1] ?? '';
  while (last && measure(`${last}…`, size, o.weight, o.letterSpacing) > o.maxWidth) last = last.slice(0, -1).trimEnd();
  lines[lines.length - 1] = `${last.replace(/[\s,.;:–—-]+$/, '')}…`;
  const lh = Math.round(size * o.lineHeight);
  return { lines, size, lineHeightPx: lh, height: lh * lines.length, truncated: true };
}

// Character ranges of `phrase` (case-insensitive, first occurrence) inside
// each line, for highlighting part of a headline.
export function highlightSegments(lines: string[], phrase: string): { text: string; hot: boolean }[][] {
  const p = phrase.trim().toLowerCase();
  // Lines joined by a space, so a phrase that wraps onto the next line
  // still matches.
  const joined = lines.join(' ');
  const at = p ? joined.toLowerCase().indexOf(p) : -1;
  let offset = 0;
  return lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    if (at < 0) return [{ text: line, hot: false }];
    const a = Math.max(at, start) - start;
    const b = Math.min(at + p.length, start + line.length) - start;
    if (b <= 0 || a >= line.length || b <= a) return [{ text: line, hot: false }];
    return [
      { text: line.slice(0, a), hot: false },
      { text: line.slice(a, b), hot: true },
      { text: line.slice(b), hot: false }
    ].filter((s) => s.text);
  });
}
