import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import opentype from 'opentype.js';

/** The four faces a label uses. Text is converted to outlines, so labels never depend on installed fonts. */
export type Face = 'regular' | 'bold' | 'mono';

export interface TextEngine {
  /** Advance width of `text` at `size` (same unit as `size`). */
  width(text: string, size: number, face: Face): number;
  /** SVG path data for `text` with its baseline at (x, y). */
  path(text: string, x: number, y: number, size: number, face: Face): string;
}

const FILES: Record<Face, string> = {
  regular: 'Geist-Regular.ttf',
  bold: 'Geist-Bold.ttf',
  mono: 'GeistMono-Bold.ttf'
};

const fonts = new Map<Face, opentype.Font>();

function font(face: Face): opentype.Font {
  let f = fonts.get(face);
  if (!f) {
    const dir = process.env.FONT_DIR || join(process.cwd(), 'static', 'fonts');
    const buf = readFileSync(join(dir, FILES[face]));
    f = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    fonts.set(face, f);
  }
  return f;
}

/** Engine backed by the bundled Geist fonts (static/fonts). */
export const geistEngine: TextEngine = {
  width: (text, size, face) => font(face).getAdvanceWidth(text, size),
  path: (text, x, y, size, face) => font(face).getPath(text, x, y, size).toPathData(3)
};
