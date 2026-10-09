import { describe, expect, it } from 'vitest';
import { normalize, parseQuickEntry, splitDetails } from './search';
import { diffLines, displayPath, labelLines } from './label/text';

describe('search normalisation', () => {
  it('treats ×, x and spaces the same', () => {
    for (const s of ['M8 × 10', 'M8×10', 'm8x10', 'M8 x 10', 'M8  ×  10']) expect(normalize(s)).toBe('m8x10');
  });
  it('leaves ordinary text alone', () => {
    expect(normalize('  Flux   Pen ')).toBe('flux pen');
    expect(normalize('Max 10')).toBe('max 10');
  });
});

describe('quick entry', () => {
  it('parses one item per line with details after a colon', () => {
    expect(parseQuickEntry('Misc metric screws: M8×5, M8×10 ,\n\nWashers: M8, M6\nNuts')).toEqual([
      { name: 'Misc metric screws', details: 'M8×5, M8×10' },
      { name: 'Washers', details: 'M8, M6' },
      { name: 'Nuts', details: '' }
    ]);
  });
  it('splits details into chips', () => {
    expect(splitDetails('a, b,, c ')).toEqual(['a', 'b', 'c']);
  });
});

describe('label text', () => {
  const m = {
    code: 4,
    name: 'Soldering Supplies',
    path: displayPath(['Home', 'Upstairs Office', 'Silver Shelf']),
    items: [{ name: 'Wire cutters', details: [], pinned: false }, { name: 'Iron', details: ['stand'], pinned: true }],
    children: [{ name: 'Screws', code: 5 }]
  };
  it('lists name, path, items, then children', () => {
    expect(labelLines(m)).toEqual([
      'Soldering Supplies',
      'Upstairs Office › Silver Shelf',
      'Wire cutters',
      'Iron — stand',
      '▸ Screws #0005'
    ]);
  });
  it('diffs added and removed lines', () => {
    const prev = ['A', 'B', 'C'];
    expect(diffLines(prev, ['A', 'C', 'D'])).toEqual({ added: ['D'], removed: ['B'] });
    expect(diffLines(prev, ['C', 'B', 'A'])).toEqual({ added: [], removed: [] });
  });
});
