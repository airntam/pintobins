import QRCode from 'qrcode';
import { pad4, type LabelModel } from '$lib/types';
import { SEP } from './text';
import type { Face, TextEngine } from './engine';

/**
 * The one label renderer. Everything is laid out in millimetres and text is
 * converted to outlines, so the SVG looks the same in a browser <img>, in
 * print and when rasterised to PNG.
 */

export const LABEL_W = 70;
export const LABEL_H = 80;
export const DPI = 203;
/** The 203 dpi bitmap: 70 mm → 559 px, 80 mm → 640 px. */
export const PNG_W = 559;
export const PNG_H = 640;

const PAD = { l: 3.6, t: 3.4, r: 3.4, b: 3.2 };
const COL_GAP = 3;
const PX = LABEL_W / PNG_W; // one bitmap pixel, in mm

const SIZE = { name: 4.8, path: 2.3, item: 2.55, more: 2.2, code: 3.3 };
const LH = { name: 1.08, text: 1.22 };
const ITEM_GAP = 0.9;
const BASELINE = 0.97; // baseline offset from the top of a line box, in em

export type DetailMode = 'full' | 'one-line' | 'none';

interface Token {
  text: string;
  face: Face;
}
interface Placed {
  d: string;
}

export interface LabelLayout {
  mode: DetailMode;
  /** Items and child places that did not fit (and are summarised as "+ N more"). */
  hidden: number;
  shownItems: string[];
  shownChildren: string[];
  /** Combined outline path data for all text and marks. */
  text: string;
  /** Dashed divider above the child list, if any. */
  dashedY: number | null;
  ruleY: number;
  /** Width of the contents area (the full label width inside the padding). */
  contentW: number;
  qr: { x: number; y: number; module: number; n: number; d: string };
  url: string;
}

export function labelUrl(baseUrl: string, code: number) {
  return `${baseUrl.replace(/\/+$/, '')}/p/${code}`;
}

/** Round to the 203 dpi pixel grid horizontally. */
const snapX = (mm: number) => Math.round(mm / PX) * PX;
const snapY = (mm: number) => Math.round((mm * PNG_H) / LABEL_H) * (LABEL_H / PNG_H);
const f = (n: number) => +n.toFixed(3);

function tokenize(segs: Token[]): Token[] {
  const out: Token[] = [];
  for (const s of segs) for (const w of s.text.split(/\s+/)) if (w) out.push({ text: w, face: s.face });
  return out;
}

class Painter {
  d: string[] = [];
  constructor(private e: TextEngine) {}
  w = (t: string, size: number, face: Face) => this.e.width(t, size, face);
  text(t: string, x: number, baseline: number, size: number, face: Face) {
    if (t) this.d.push(this.e.path(t, x, baseline, size, face));
  }
}

/** Greedy word wrap of mixed-face tokens into lines of tokens. */
function wrap(p: Painter, tokens: Token[], size: number, maxW: number): Token[][] {
  const space = p.w(' ', size, 'regular');
  const lines: Token[][] = [[]];
  let x = 0;
  for (let tok of tokens) {
    let w = p.w(tok.text, size, tok.face);
    // a single word wider than the column is split by characters
    while (w > maxW) {
      let n = tok.text.length - 1;
      while (n > 1 && p.w(tok.text.slice(0, n), size, tok.face) > maxW) n--;
      const head = { text: tok.text.slice(0, n), face: tok.face };
      if (lines.at(-1)!.length) lines.push([]);
      lines.at(-1)!.push(head);
      lines.push([]);
      x = 0;
      tok = { text: tok.text.slice(n), face: tok.face };
      w = p.w(tok.text, size, tok.face);
    }
    const cur = lines.at(-1)!;
    const add = cur.length ? space + w : w;
    if (x + add > maxW && cur.length) {
      lines.push([tok]);
      x = w;
    } else {
      cur.push(tok);
      x += add;
    }
  }
  return lines.filter((l) => l.length);
}

/** Truncate the end of a token run so it fits on one line, adding "…". */
function oneLine(p: Painter, tokens: Token[], size: number, maxW: number): Token[] {
  const space = p.w(' ', size, 'regular');
  const width = (ts: Token[]) => ts.reduce((a, t, i) => a + p.w(t.text, size, t.face) + (i ? space : 0), 0);
  let ts = tokens.map((t) => ({ ...t }));
  if (width(ts) <= maxW) return ts;
  for (;;) {
    const last = ts.at(-1)!;
    if (ts.length > 1 && last.text.length <= 1) {
      ts.pop();
      continue;
    }
    last.text = last.text.replace(/…$/, '').slice(0, -1) + '…';
    if (width(ts) <= maxW || last.text.length <= 1) return ts;
  }
}

function paintLine(p: Painter, line: Token[], x: number, top: number, size: number) {
  const space = p.w(' ', size, 'regular');
  const baseline = top + BASELINE * size;
  let cx = x;
  for (const t of line) {
    p.text(t.text, cx, baseline, size, t.face);
    cx += p.w(t.text, size, t.face) + space;
  }
}

interface Entry {
  kind: 'item' | 'child';
  label: string; // for tests / reporting
  pinned: boolean;
  tokens: (mode: DetailMode) => Token[];
  code?: number;
  name: string;
}

export function layoutLabel(model: LabelModel, engine: TextEngine, baseUrl: string): LabelLayout {
  const p = new Painter(engine);
  const url = labelUrl(baseUrl, model.code);

  // ---- QR (top right, with the code under it) ----
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const modulePx = Math.max(3, Math.floor(160 / n)); // 20 mm ≈ 160 px; whole pixels keep modules crisp
  const module = modulePx * PX;
  const qrSize = n * module;
  const codeText = pad4(model.code);
  const codeW = p.w(codeText, SIZE.code, 'mono');
  const qrX = snapX(LABEL_W - PAD.r - qrSize);
  const qrY = snapY(PAD.t);
  const codeBaseline = qrY + qrSize + 1.8 + SIZE.code * 0.72;
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) rects.push(`M${f(qrX + c * module)} ${f(qrY + r * module)}h${f(module)}v${f(module)}h${f(-module)}z`);
    }
  }
  p.text(codeText, qrX + qrSize / 2 - codeW / 2, codeBaseline, SIZE.code, 'mono');

  // ---- header (name and path beside the QR), then contents across the full width ----
  const x0 = PAD.l;
  const headW = qrX - COL_GAP - x0;
  const contentW = LABEL_W - PAD.l - PAD.r;
  const bottom = LABEL_H - PAD.b;
  let y = PAD.t;

  const MAX_NAME_LINES = 3;
  const nameLines = wrap(p, tokenize([{ text: model.name, face: 'display' }]), SIZE.name, headW);
  let shownName = nameLines.slice(0, MAX_NAME_LINES);
  if (nameLines.length > MAX_NAME_LINES) {
    const last = nameLines.slice(MAX_NAME_LINES - 1).flat();
    shownName = [...nameLines.slice(0, MAX_NAME_LINES - 1), oneLine(p, last, SIZE.name, headW)];
  }
  for (const line of shownName) {
    paintLine(p, line, x0, y, SIZE.name);
    y += SIZE.name * LH.name;
  }
  y += 0.9;
  const pathText = model.path.join(SEP);
  if (pathText) {
    const t = oneLine(p, [{ text: pathText, face: 'regular' }], SIZE.path, headW);
    paintLine(p, t, x0, y, SIZE.path);
  }
  y += SIZE.path * LH.text + 1.3;
  y = Math.max(y, codeBaseline + 1.8); // the rule sits below both the header text and the QR block
  const ruleY = y;
  y += 0.4 + 1.9;
  const contentTop = y;

  const entries: Entry[] = [
    ...model.items.map<Entry>((it) => ({
      kind: 'item',
      name: it.name,
      pinned: it.pinned,
      label: it.name,
      tokens: (mode) => {
        const base: Token[] = [{ text: it.name, face: 'bold' }];
        if (mode === 'none' || !it.details.length) return tokenize(base);
        return tokenize([...base, { text: '—', face: 'regular' }, { text: it.details.join(', '), face: 'regular' }]);
      }
    })),
    ...model.children.map<Entry>((c) => ({
      kind: 'child',
      name: c.name,
      pinned: false,
      label: c.name,
      code: c.code,
      tokens: () => tokenize([{ text: c.name, face: 'bold' }])
    }))
  ];

  const moreText = (k: number) => `+ ${k} more · scan for full list`;
  const lhItem = SIZE.item * LH.text;
  const DASH_H = 3.0; // dashed rule plus spacing before the child list

  interface Built {
    height: number;
    paint: (top: number) => void;
  }

  /** Build the body for a mode and a set of dropped entries; measure before painting. */
  function build(mode: DetailMode, dropped: Set<number>): Built {
    const blocks: { height: number; draw: (top: number) => void; child: boolean }[] = [];
    entries.forEach((e, i) => {
      if (dropped.has(i)) return;
      if (e.kind === 'item') {
        let lines: Token[][];
        const toks = e.tokens(mode);
        if (mode === 'full') lines = wrap(p, toks, SIZE.item, contentW);
        else lines = [oneLine(p, toks, SIZE.item, contentW)];
        blocks.push({
          child: false,
          height: lines.length * lhItem + ITEM_GAP,
          draw: (top) => lines.forEach((l, k) => paintLine(p, l, x0, top + k * lhItem, SIZE.item))
        });
      } else {
        // ▸ Name #0043 on one line
        const codeStr = pad4(e.code!);
        const cs = SIZE.item * 0.88;
        const triW = 1.5;
        const cw = p.w(codeStr, cs, 'mono');
        const nameMax = contentW - triW - 0.9 - cw - 1.0;
        const nameToks = oneLine(p, tokenize([{ text: e.name, face: 'bold' }]), SIZE.item, nameMax);
        const nw = nameToks.reduce((a, t, k) => a + p.w(t.text, SIZE.item, t.face) + (k ? p.w(' ', SIZE.item, 'regular') : 0), 0);
        blocks.push({
          child: true,
          height: lhItem + 0.5,
          draw: (top) => {
            const base = top + BASELINE * SIZE.item;
            const yc = base - SIZE.item * 0.36;
            p.d.push(`M${f(x0)} ${f(yc - 0.95)}L${f(x0 + triW)} ${f(yc)}L${f(x0)} ${f(yc + 0.95)}z`);
            paintLine(p, nameToks, x0 + triW + 0.9, top, SIZE.item);
            p.text(codeStr, x0 + triW + 0.9 + nw + 1.0, base, cs, 'mono');
          }
        });
      }
    });
    const hasChildren = blocks.some((b) => b.child);
    const height = blocks.reduce((a, b) => a + b.height, 0) + (hasChildren ? DASH_H : 0);
    return {
      height,
      paint: (top) => {
        let cy = top;
        let dashed = false;
        for (const b of blocks) {
          if (b.child && !dashed) {
            dashed = true;
            dashY = cy + 0.9;
            cy += DASH_H;
          }
          b.draw(cy);
          cy += b.height;
        }
      }
    };
  }

  let dashY: number | null = null;
  const avail = bottom - contentTop;
  let mode: DetailMode = 'full';
  let dropped = new Set<number>();
  let built: Built | undefined;

  for (const m of ['full', 'one-line', 'none'] as DetailMode[]) {
    const b = build(m, new Set());
    mode = m;
    built = b;
    if (b.height <= avail) break;
  }
  if (built!.height > avail) {
    // names only, now drop entries from the end (never pinned items) until
    // everything plus the "+ N more" line fits
    dropped = new Set();
    const moreH = SIZE.more * LH.text;
    for (;;) {
      const b = build('none', dropped);
      const need = b.height + (dropped.size ? moreH : 0);
      built = b;
      if (need <= avail) break;
      let idx = -1;
      for (let i = entries.length - 1; i >= 0; i--) {
        if (!dropped.has(i) && !entries[i].pinned) {
          idx = i;
          break;
        }
      }
      if (idx === -1) break; // only pinned items left; they stay even if tight
      dropped.add(idx);
    }
  }

  built!.paint(contentTop);
  const bodyH = built!.height;
  if (dropped.size) {
    const t = oneLine(p, [{ text: moreText(dropped.size), face: 'regular' }], SIZE.more, contentW);
    paintLine(p, t, x0, contentTop + bodyH + 0.3, SIZE.more);
  }

  return {
    mode,
    hidden: dropped.size,
    shownItems: entries.filter((e, i) => e.kind === 'item' && !dropped.has(i)).map((e) => e.label),
    shownChildren: entries.filter((e, i) => e.kind === 'child' && !dropped.has(i)).map((e) => e.label),
    text: p.d.join(''),
    dashedY: dashY,
    ruleY,
    contentW,
    qr: { x: qrX, y: qrY, module, n, d: rects.join('') },
    url
  };
}

export interface RenderOptions {
  baseUrl: string;
  /** Rasterisation variant: pixel dimensions on the root so resvg yields exactly 640 × 559. */
  png?: boolean;
}

export function renderLabelSvg(model: LabelModel, engine: TextEngine, opts: RenderOptions): string {
  const L = layoutLabel(model, engine, opts.baseUrl);
  const size = opts.png
    ? `width="${PNG_W}" height="${PNG_H}" preserveAspectRatio="none"`
    : `width="${LABEL_W}mm" height="${LABEL_H}mm"`;
  const x0 = PAD.l;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${LABEL_W} ${LABEL_H}">`,
    `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`,
    `<g fill="#000" stroke="none">`,
    `<rect x="${f(x0)}" y="${f(L.ruleY)}" width="${f(L.contentW)}" height="0.4"/>`,
    `<path d="${L.text}"/>`,
    `<path d="${L.qr.d}" shape-rendering="crispEdges"/>`,
    `</g>`,
    L.dashedY !== null
      ? `<line x1="${f(x0)}" y1="${f(L.dashedY)}" x2="${f(x0 + L.contentW)}" y2="${f(L.dashedY)}" stroke="#000" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`
      : '',
    `</svg>`
  ].join('');
}
