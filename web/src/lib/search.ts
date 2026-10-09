/**
 * Normalise text for search: lowercase, "×" → "x", and drop spaces between a
 * number and "x" so "M8 × 10", "M8×10" and "m8x10" all become "m8x10".
 * Keep in sync with pocketbase/pb_hooks/lib.js.
 */
export function normalize(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/(\d)\s*x\s*(\d)/g, '$1x$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a comma-separated details string into trimmed chips. */
export function splitDetails(details: string | null | undefined): string[] {
  return String(details ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const joinDetails = (chips: string[]) => chips.map((c) => c.trim()).filter(Boolean).join(', ');

export interface QuickItem {
  name: string;
  details: string;
}

/**
 * Quick entry: one item per line, details after the first colon, separated by
 * commas ("Misc metric screws: M8×5, M8×10").
 */
export function parseQuickEntry(text: string): QuickItem[] {
  const out: QuickItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i === -1) {
      out.push({ name: line, details: '' });
    } else {
      const name = line.slice(0, i).trim();
      if (!name) continue;
      out.push({ name, details: joinDetails(line.slice(i + 1).split(',')) });
    }
  }
  return out;
}

/** Escape a value for use inside a PocketBase filter string literal. */
export const pbQuote = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
