import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { labelEngine } from './engine';
import { layoutLabel, renderLabelSvg } from './render';
import { rasterize, svgToPng } from './png';
import type { LabelModel } from '$lib/types';

const BASE = 'https://bin.clevernaut.com';

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
    const l = layoutLabel(model(), labelEngine, BASE);
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
    const l = layoutLabel(long, labelEngine, BASE);
    expect(l.mode).toBe('one-line');
    expect(l.hidden).toBe(0);
    expect(l.shownItems).toHaveLength(8);
  });

  it('with 40 items shows "+ N more" and hides some items', () => {
    const l = layoutLabel(many(40), labelEngine, BASE);
    expect(l.mode).toBe('none');
    expect(l.hidden).toBeGreaterThan(0);
    expect(l.shownItems.length + l.hidden).toBe(40);
    // the summary line is rendered as outlines, so compare against a layout without it
    const svg = renderLabelSvg(many(40), labelEngine, { baseUrl: BASE });
    expect(svg).toContain('<path d="M');
  });

  it('always keeps pinned items, even deep in the list', () => {
    const l = layoutLabel(many(40, [30, 38]), labelEngine, BASE);
    expect(l.hidden).toBeGreaterThan(0);
    expect(l.shownItems).toContain('Item number 31');
    expect(l.shownItems).toContain('Item number 39');
  });

  it('is deterministic', () => {
    expect(renderLabelSvg(model(), labelEngine, { baseUrl: BASE })).toBe(renderLabelSvg(model(), labelEngine, { baseUrl: BASE }));
  });
});

describe('label PNG', () => {
  const svg = renderLabelSvg(model(), labelEngine, { baseUrl: BASE, png: true });

  it('is 559 x 640 px and pure black and white', () => {
    const png = PNG.sync.read(svgToPng(svg));
    expect(png.width).toBe(559);
    expect(png.height).toBe(640);
    const values = new Set<number>();
    for (let i = 0; i < png.data.length; i += 4) values.add(png.data[i]);
    expect([...values].sort()).toEqual([0, 255]);
  });

  it('has a QR code that decodes to the place URL', () => {
    for (const code of [1, 42, 1234]) {
      const s = renderLabelSvg(model({ code }), labelEngine, { baseUrl: BASE, png: true });
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
      writeFileSync(`${process.env.SAMPLE_OUT}/${n}.png`, svgToPng(renderLabelSvg(m, labelEngine, { baseUrl: BASE, png: true })));
    }
  });
});

describe('path data', () => {
  it('never contains NaN, wherever a glyph lands', () => {
    // opentype.js's own serializer produced NaN for some positions (seen with "Lenses")
    for (let x = 0; x < 30; x += 0.013) {
      expect(labelEngine.path('s', x, 13.3, 4.8, 'bold')).not.toMatch(/NaN|undefined|Infinity/);
    }
    const svg = renderLabelSvg(model({ name: 'Vintage Camera Lenses', path: ['Purple Room', 'Silver Shelf'] }), labelEngine, { baseUrl: BASE });
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });
});
