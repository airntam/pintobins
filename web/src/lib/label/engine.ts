import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';

/**
 * The faces a label uses, in the Data voice of Aaron's Design System (Iosevka Aile
 * for words, Iosevka for codes). Text is converted to outlines, so labels never
 * depend on installed fonts.
 */
export type Face = 'display' | 'bold' | 'regular' | 'mono';

export interface TextEngine {
  /** Advance width of `text` at `size` (same unit as `size`). */
  width(text: string, size: number, face: Face): number;
  /** SVG path data for `text` with its baseline at (x, y). */
  path(text: string, x: number, y: number, size: number, face: Face): string;
}

const FILES: Record<Face, string> = {
  display: 'IosevkaAile-800.ttf', // the bin name
  bold: 'IosevkaAile-600.ttf', // item and child names
  regular: 'IosevkaAile-400.ttf', // path, details, "+ N more"
  mono: 'IosevkaMono-600.ttf' // codes
};

/** The Iosevka files are Latin subsets; any character they lack is drawn in Geist. */
const FALLBACK: Record<Face, string> = {
  display: 'Geist-Bold.ttf',
  bold: 'Geist-Bold.ttf',
  regular: 'Geist-Regular.ttf',
  mono: 'GeistMono-Bold.ttf'
};

const fonts = new Map<string, opentype.Font>();

function load(file: string): opentype.Font {
  let f = fonts.get(file);
  if (!f) {
    const dir = process.env.FONT_DIR || join(process.cwd(), 'static', 'fonts');
    const buf = readFileSync(join(dir, file));
    f = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    fonts.set(file, f);
  }
  return f;
}

/** Split text into runs that share a font: the face's own font where it has the glyph, else the fallback. */
function runs(text: string, face: Face): { text: string; font: opentype.Font }[] {
  const main = load(FILES[face]);
  const out: { text: string; font: opentype.Font }[] = [];
  for (const ch of text) {
    const has = /\s/.test(ch) || main.charToGlyphIndex(ch) > 0;
    const f = has ? main : load(FALLBACK[face]);
    const last = out.at(-1);
    if (last && last.font === f) last.text += ch;
    else out.push({ text: ch, font: f });
  }
  return out;
}

/** Engine backed by the bundled fonts (static/fonts). */
export const labelEngine: TextEngine = {
  width: (text, size, face) => runs(text, face).reduce((w, r) => w + r.font.getAdvanceWidth(r.text, size), 0),
  path: (text, x, y, size, face) => {
    let d = '';
    let cx = x;
    for (const r of runs(text, face)) {
      d += pathData(r.font.getPath(r.text, cx, y, size).commands);
      cx += r.font.getAdvanceWidth(r.text, size);
    }
    return d;
  }
};

const num = (v: number) => {
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toFixed(3);
};

/**
 * SVG path data from glyph commands. Not opentype.js's toPathData(): its rounding
 * turns coordinates with a tiny fractional part (e.g. 12.0000001) into "NaN",
 * and a browser stops drawing a path at the first bad number.
 */
function pathData(commands: opentype.PathCommand[]): string {
  let d = '';
  for (const c of commands) {
    if (c.type === 'M' || c.type === 'L') d += `${c.type}${num(c.x)} ${num(c.y)}`;
    else if (c.type === 'Q') d += `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
    else if (c.type === 'C') d += `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return d;
}
