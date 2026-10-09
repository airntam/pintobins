import { pad4, type LabelModel } from '$lib/types';

export const SEP = ' › '; // ›

/**
 * The path shown on a label. The outermost place (usually the Location, e.g.
 * "Home") is implied and left out once there is at least one more level.
 */
export function displayPath(ancestors: string[]): string[] {
  return ancestors.length >= 2 ? ancestors.slice(1) : ancestors;
}

export const itemLine = (i: { name: string; details: string[] }) =>
  i.details.length ? `${i.name} — ${i.details.join(', ')}` : i.name;

export const childLine = (c: { name: string; code: number }) => `▸ ${c.name} ${pad4(c.code)}`;

/**
 * Ordered label text: name, path, each item line, each child line.
 * Used for the print snapshot and the change list.
 */
export function labelLines(m: LabelModel): string[] {
  return [m.name, m.path.join(SEP), ...m.items.map(itemLine), ...m.children.map(childLine)];
}

export interface LineDiff {
  added: string[];
  removed: string[];
}

/** Multiset diff between two label texts (order changes are ignored). */
export function diffLines(prev: string[], next: string[]): LineDiff {
  const counts = new Map<string, number>();
  for (const l of prev) counts.set(l, (counts.get(l) ?? 0) + 1);
  const added: string[] = [];
  for (const l of next) {
    const n = counts.get(l) ?? 0;
    if (n > 0) counts.set(l, n - 1);
    else added.push(l);
  }
  const removed: string[] = [];
  for (const l of prev) {
    const n = counts.get(l) ?? 0;
    if (n > 0) {
      removed.push(l);
      counts.set(l, n - 1);
    }
  }
  return { added, removed };
}
