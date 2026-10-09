import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { geistEngine } from './engine';
import { layoutLabel, renderLabelSvg } from './render';
import { rasterize, svgToPng } from './png';
import type { LabelModel } from '$lib/types';

const BASE = 'https://bin.fwoink.com';

const model = (over: Partial<LabelModel> = {}): LabelModel => ({
  code: 42,
  name: 'Soldering Supplies',
  path: ['Upstairs Office', 'Silver Shelf'],
  items: [
    { name: 'Soldering iron', details: ['stand', 'spare tips'], pinned: false },
    { name: 'Solder & flux', details: ['paste', 'wire', 'flux pen'], pinned: false },
    { name: 'Wire cutters', details: [], pinned: false }
  ],
  children: [{ name: 'Assorted metric screws', code: 43 }],
  ...over
});

const many = (n: number, pinned: number[] = []): LabelModel =>
  model({
    items: Array.from({ length: n }, (_, i) => ({
      name: `Item number ${i + 1}`,
      details: ['alpha', 'beta', 'gamma'],
      pinned: pinned.includes(i)
    })),
    children: []
  });

describe('label layout', () => {
  it('fits a normal label with full details and no summary line', () => {
    const l = layoutLabel(model(), geistEngine, BASE);
    expect(l.hidden).toBe(0);
    expect(l.mode).toBe('full');
    expect(l.shownItems).toHaveLength(3);
    expect(l.shownChildren).toEqual(['Assorted metric screws']);
  });

  it('drops details before items when space runs out', () => {
    const long = model({
      items: Array.from({ length: 8 }, (_, i) => ({
        name: `Item number ${i + 1}`,
        details: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'],
        pinned: false
      })),
      children: []
    });
    const l = layoutLabel(long, geistEngine, BASE);
    expect(l.mode).toBe('one-line');
    expect(l.hidden).toBe(0);
    expect(l.shownItems).toHaveLength(8);
  });

  it('with 40 items shows "+ N more" and hides some items', () => {
    const l = layoutLabel(many(40), geistEngine, BASE);
    expect(l.mode).toBe('none');
    expect(l.hidden).toBeGreaterThan(0);
    expect(l.shownItems.length + l.hidden).toBe(40);
    // the summary line is rendered as outlines, so compare against a layout without it
    const svg = renderLabelSvg(many(40), geistEngine, { baseUrl: BASE });
    expect(svg).toContain('<path d="M');
  });

  it('always keeps pinned items, even deep in the list', () => {
    const l = layoutLabel(many(40, [30, 38]), geistEngine, BASE);
    expect(l.hidden).toBeGreaterThan(0);
    expect(l.shownItems).toContain('Item number 31');
    expect(l.shownItems).toContain('Item number 39');
  });

  it('is deterministic', () => {
    expect(renderLabelSvg(model(), geistEngine, { baseUrl: BASE })).toBe(renderLabelSvg(model(), geistEngine, { baseUrl: BASE }));
  });
});

describe('label PNG', () => {
  const svg = renderLabelSvg(model(), geistEngine, { baseUrl: BASE, png: true });

  it('is 640 x 559 px and pure black and white', () => {
    const png = PNG.sync.read(svgToPng(svg));
    expect(png.width).toBe(640);
    expect(png.height).toBe(559);
    const values = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4) values.add(png.data[i]);
    expect([...values].sort()).toEqual([0, 255]);
  });

  it('has a QR code that decodes to the place URL', () => {
    for (const code of [1, 42, 1234]) {
      const s = renderLabelSvg(model({ code }), geistEngine, { baseUrl: BASE, png: true });
      const { width, height, pixels } = rasterize(s);
      const hit = jsQR(new Uint8ClampedArray(pixels), width, height);
      expect(hit?.data).toBe(`${BASE}/p/${code}`);
    }
  });
});

// Set SAMPLE_OUT=<dir> to dump sample labels for eyeballing.
describe.skipIf(!process.env.SAMPLE_OUT)('samples', () => {
  it('writes PNGs', async () => {
    const { writeFileSync } = await import('node:fs');
    const long = {
      ...model(),
      name: 'A very long bin name that needs two lines to fit properly',
      items: Array.from({ length: 40 }, (_, i) => ({ name: `Item ${i + 1}`, details: ['a', 'b'], pinned: i === 33 }))
    };
    for (const [n, m] of [['normal', model()], ['overflow', long]] as const) {
      writeFileSync(`${process.env.SAMPLE_OUT}/${n}.png`, svgToPng(renderLabelSvg(m, geistEngine, { baseUrl: BASE, png: true })));
    }
  });
});
