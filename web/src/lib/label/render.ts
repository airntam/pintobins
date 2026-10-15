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

/** The frame: a chamfered outline inset from the label edge. */
const FRAME = { inset: 1.6, chamfer: 3.2 };
/** Content margins inside the frame. */
const PAD = { l: 4.4, t: 4.2, r: 4.4, b: 4.2 };
const COL_GAP = 2.6;
const STROKE = 0.3; // frame, boxes, brackets
const QR_PAD = 1.6; // quiet zone between the QR and its box
const PX = LABEL_W / PNG_W; // one bitmap pixel, in mm

const SIZE = { name: 4.8, path: 2.0, item: 2.55, more: 2.2, caption: 2.0, bigCode: 13 };
const CAP = 0.735; // cap height of the Iosevka faces, in em
const LH = { name: 1.08, text: 1.22 };
const ITEM_GAP = 0.7;
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
  /** Outline path data (frame, QR box, name brackets, info strip), stroked. */
  lines: string;
  /** Hazard stripe band: its box and the stripe polygons (clipped to the box). */
  stripes: { x: number; y: number; w: number; h: number; d: string };
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

  const x0 = PAD.l;
  const x1 = LABEL_W - PAD.r;
  const contentW = x1 - x0;
  const bottom = LABEL_H - PAD.b;
  const lines: string[] = [];

  /** Letter-spaced text, drawn glyph by glyph. */
  const trackedW = (t: string, size: number, face: Face, track: number) =>
    [...t].reduce((a, ch) => a + p.w(ch, size, face), 0) + track * Math.max(0, [...t].length - 1);
  const tracked = (t: string, x: number, baseline: number, size: number, face: Face, track: number) => {
    let cx = x;
    for (const ch of t) {
      p.text(ch, cx, baseline, size, face);
      cx += p.w(ch, size, face) + track;
    }
  };
  const fitTracked = (t: string, size: number, face: Face, track: number, maxW: number) => {
    if (trackedW(t, size, face, track) <= maxW) return t;
    let s = t;
    while (s.length > 1 && trackedW(s + '…', size, face, track) > maxW) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  };

  // ---- frame: chamfered outline ----
  {
    const i = FRAME.inset;
    const c = FRAME.chamfer;
    const W = LABEL_W - i;
    const H = LABEL_H - i;
    lines.push(`M${f(i + c)} ${f(i)}H${f(W - c)}L${f(W)} ${f(i + c)}V${f(H - c)}L${f(W - c)} ${f(H)}H${f(i + c)}L${f(i)} ${f(H - c)}V${f(i + c)}Z`);
  }

  // ---- QR (top right, in a rounded box) ----
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const modulePx = Math.max(3, Math.floor(136 / n)); // about 15-17 mm; whole pixels keep modules crisp
  const module = modulePx * PX;
  const qrSize = n * module;
  const boxW = qrSize + 2 * QR_PAD;
  const boxX = x1 - boxW;
  const boxY = PAD.t;
  const qrX = snapX(boxX + QR_PAD);
  const qrY = snapY(boxY + QR_PAD);
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) rects.push(`M${f(qrX + c * module)} ${f(qrY + r * module)}h${f(module)}v${f(module)}h${f(-module)}z`);
    }
  }
  {
    const r = 1.2;
    const X = boxX;
    const Y = boxY;
    const W = boxW;
    lines.push(
      `M${f(X + r)} ${f(Y)}H${f(X + W - r)}Q${f(X + W)} ${f(Y)} ${f(X + W)} ${f(Y + r)}V${f(Y + W - r)}Q${f(X + W)} ${f(Y + W)} ${f(X + W - r)} ${f(Y + W)}` +
        `H${f(X + r)}Q${f(X)} ${f(Y + W)} ${f(X)} ${f(Y + W - r)}V${f(Y + r)}Q${f(X)} ${f(Y)} ${f(X + r)} ${f(Y)}Z`
    );
  }

  // ---- left of the QR: caption and item count, the code, then the info strip ----
  const headW = boxX - COL_GAP - x0;
  const boxBottom = boxY + boxW;
  const capBase = PAD.t + SIZE.caption * CAP;
  {
    const k = model.items.length;
    const count = `${k} ITEM${k === 1 ? '' : 'S'}`;
    const cw = trackedW(count, SIZE.caption, 'regular', 0.3);
    tracked(count, x0 + headW - cw, capBase, SIZE.caption, 'regular', 0.3);
    const caption = `${(model.type ?? '').toUpperCase()} NO.`.trim();
    tracked(fitTracked(caption, SIZE.caption, 'regular', 0.45, headW - cw - 2), x0, capBase, SIZE.caption, 'regular', 0.45);
  }
  const stripH = 4.0;
  const stripTop = boxBottom - stripH;
  const digits = pad4(model.code).slice(1);
  const codeTop = capBase + 1.6;
  const bigSize = Math.min(SIZE.bigCode, headW / p.w(digits, 1, 'mono'), (stripTop - 1.2 - codeTop) / CAP);
  const codeBase = codeTop + bigSize * CAP;
  p.text(digits, x0 - bigSize * 0.03, codeBase, bigSize, 'mono');

  // info strip: the path, boxed
  lines.push(`M${f(x0)} ${f(stripTop)}H${f(x0 + headW)}V${f(boxBottom)}H${f(x0)}Z`);
  {
    const pathText = model.path.join(SEP).toUpperCase();
    if (pathText) {
      const base = stripTop + stripH / 2 + (SIZE.path * CAP) / 2;
      const t = fitTracked(pathText, SIZE.path, 'regular', 0.2, headW - 2.6);
      tracked(t, x0 + 1.3, base, SIZE.path, 'regular', 0.2);
    }
  }

  // ---- hazard stripes ----
  let y = boxBottom + 1.8;
  const stripes = { x: x0, y, w: contentW, h: 1.8, d: '' };
  {
    const sw = 1.0; // stripe width; the gap is the same
    const parts: string[] = [];
    for (let sx = x0 - stripes.h; sx < x1; sx += sw * 2) {
      parts.push(`M${f(sx)} ${f(y + stripes.h)}L${f(sx + stripes.h)} ${f(y)}h${f(sw)}L${f(sx + sw)} ${f(y + stripes.h)}z`);
    }
    stripes.d = parts.join('');
  }
  y += stripes.h + 1.8;

  // ---- name, between brackets ----
  const BR = { arm: 1.4, gap: 2.0 };
  const nameW = contentW - 2 * BR.gap;
  const MAX_NAME_LINES = 2;
  const nameLines = wrap(p, tokenize([{ text: model.name, face: 'display' }]), SIZE.name, nameW);
  let shownName = nameLines.slice(0, MAX_NAME_LINES);
  if (nameLines.length > MAX_NAME_LINES) {
    const last = nameLines.slice(MAX_NAME_LINES - 1).flat();
    shownName = [...nameLines.slice(0, MAX_NAME_LINES - 1), oneLine(p, last, SIZE.name, nameW)];
  }
  const brTop = y;
  y += 0.8;
  for (const line of shownName) {
    paintLine(p, line, x0 + BR.gap, y, SIZE.name);
    y += SIZE.name * LH.name;
  }
  const brBot = y + 0.2;
  lines.push(`M${f(x0 + BR.arm)} ${f(brTop)}H${f(x0)}V${f(brBot)}H${f(x0 + BR.arm)}`);
  lines.push(`M${f(x1 - BR.arm)} ${f(brTop)}H${f(x1)}V${f(brBot)}H${f(x1 - BR.arm)}`);
  y = brBot + 2.0;
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
        // a small square bullet; wrapped lines hang under the text, aligned with child names
        const indent = 2.4;
        const textW = contentW - indent;
        if (mode === 'full') lines = wrap(p, toks, SIZE.item, textW);
        else lines = [oneLine(p, toks, SIZE.item, textW)];
        blocks.push({
          child: false,
          height: lines.length * lhItem + ITEM_GAP,
          draw: (top) => {
            const yc = top + BASELINE * SIZE.item - SIZE.item * 0.36;
            const sq = 1.0;
            p.d.push(`M${f(x0 + 0.2)} ${f(yc - sq / 2)}h${f(sq)}v${f(sq)}h${f(-sq)}z`);
            lines.forEach((l, k) => paintLine(p, l, x0 + indent, top + k * lhItem, SIZE.item));
          }
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
    lines: lines.join(''),
    stripes,
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
  const S = L.stripes;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${LABEL_W} ${LABEL_H}">`,
    `<defs><clipPath id="hz"><rect x="${f(S.x)}" y="${f(S.y)}" width="${f(S.w)}" height="${f(S.h)}"/></clipPath></defs>`,
    `<rect width="${LABEL_W}" height="${LABEL_H}" fill="#fff"/>`,
    `<g fill="#000" stroke="none">`,
    `<path d="${L.text}"/>`,
    `<path d="${L.qr.d}" shape-rendering="crispEdges"/>`,
    `<path d="${S.d}" clip-path="url(#hz)"/>`,
    `</g>`,
    `<path d="${L.lines}" fill="none" stroke="#000" stroke-width="${STROKE}"/>`,
    L.dashedY !== null
      ? `<line x1="${f(x0)}" y1="${f(L.dashedY)}" x2="${f(x0 + L.contentW)}" y2="${f(L.dashedY)}" stroke="#000" stroke-width="0.3" stroke-dasharray="1.2 0.8"/>`
      : '',
    `</svg>`
  ].join('');
}
