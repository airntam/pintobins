import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('round-trips awkward values', () => {
    const rows = [
      ['place', 1, 'Say "hi", world', '', 'multi\nline', 1],
      ['item', 2, 'M8×10, plain', '', '', 0]
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows.map((r) => r.map(String)));
  });
  it('handles CRLF, a BOM and blank lines', () => {
    expect(parseCsv('﻿a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
