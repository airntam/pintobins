import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import type { Item, LabelModel, Place, PlaceType } from '$lib/types';
import { diffLines, displayPath, labelLines } from '$lib/label/text';

export interface Ctx {
  types: PlaceType[];
  typeById: Map<string, PlaceType>;
  places: Place[];
  byId: Map<string, Place>;
  byCode: Map<number, Place>;
  childrenOf: Map<string, Place[]>;
  items: Item[];
  itemsByPlace: Map<string, Item[]>;
}

const toType = (r: RecordModel): PlaceType => ({
  id: r.id,
  name: r.name,
  icon: r.icon || 'box',
  color: r.color || '#8A8F98',
  labeled_default: !!r.labeled_default,
  sort: r.sort ?? 0
});

const toPlace = (r: RecordModel): Place => ({
  id: r.id,
  code: r.code,
  name: r.name,
  type: r.type,
  parent: r.parent || '',
  photo: r.photo || '',
  notes: r.notes || '',
  labeled: !!r.labeled,
  label_snapshot: Array.isArray(r.label_snapshot) ? r.label_snapshot : null,
  printed_at: r.printed_at || '',
  updated: r.updated
});

const toItem = (r: RecordModel): Item => ({
  id: r.id,
  place: r.place,
  name: r.name,
  details: r.details || '',
  photo: r.photo || '',
  pinned: !!r.pinned,
  sort: r.sort ?? 0,
  created: r.created
});

let cache: { at: number; ctx: Ctx } | null = null;
const TTL_MS = 15_000;

/** Drop the cached snapshot; call after any write. */
export const invalidate = () => {
  cache = null;
};

function build(types: PlaceType[], places: Place[], items: Item[]): Ctx {
  const byId = new Map(places.map((p) => [p.id, p]));
  const byCode = new Map(places.map((p) => [p.code, p]));
  const childrenOf = new Map<string, Place[]>();
  for (const p of places) {
    const key = p.parent || '';
    (childrenOf.get(key) ?? childrenOf.set(key, []).get(key)!).push(p);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  items.sort((a, b) => a.sort - b.sort || a.created.localeCompare(b.created));
  const itemsByPlace = new Map<string, Item[]>();
  for (const it of items) {
    (itemsByPlace.get(it.place) ?? itemsByPlace.set(it.place, []).get(it.place)!).push(it);
  }
  return {
    types,
    typeById: new Map(types.map((t) => [t.id, t])),
    places,
    byId,
    byCode,
    childrenOf,
    items,
    itemsByPlace
  };
}

/** Everything, in one snapshot. Personal-scale data, so this is cheap. */
export async function loadCtx(pb: PocketBase): Promise<Ctx> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ctx;
  const [types, places, items] = await Promise.all([
    pb.collection('types').getFullList({ sort: 'sort,name' }),
    pb.collection('places').getFullList({ batch: 500 }),
    pb.collection('items').getFullList({ batch: 500 })
  ]);
  const ctx = build(types.map(toType), places.map(toPlace), items.map(toItem));
  cache = { at: Date.now(), ctx };
  return ctx;
}

/** Ancestors, outermost first. */
export function ancestors(ctx: Ctx, place: Place): Place[] {
  const out: Place[] = [];
  let cur = place.parent ? ctx.byId.get(place.parent) : undefined;
  let guard = 0;
  while (cur && guard++ < 100) {
    out.unshift(cur);
    cur = cur.parent ? ctx.byId.get(cur.parent) : undefined;
  }
  return out;
}

/** True if `candidate` is `place` itself or inside it. */
export function isWithin(ctx: Ctx, candidate: Place, place: Place): boolean {
  let cur: Place | undefined = candidate;
  let guard = 0;
  while (cur && guard++ < 100) {
    if (cur.id === place.id) return true;
    cur = cur.parent ? ctx.byId.get(cur.parent) : undefined;
  }
  return false;
}

export const pathString = (ctx: Ctx, place: Place) =>
  [...ancestors(ctx, place), place].map((p) => p.name).join(' / ');

export function labelModel(ctx: Ctx, place: Place): LabelModel {
  return {
    code: place.code,
    name: place.name,
    type: ctx.typeById.get(place.type)?.name,
    path: displayPath(ancestors(ctx, place).map((p) => p.name)),
    items: (ctx.itemsByPlace.get(place.id) ?? []).map((i) => ({
      name: i.name,
      details: i.details
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      pinned: i.pinned
    })),
    children: (ctx.childrenOf.get(place.id) ?? []).map((c) => ({ name: c.name, code: c.code }))
  };
}

export interface LabelState {
  status: 'ok' | 'new' | 'changed';
  added: string[];
  removed: string[];
  lines: string[];
}

/** Compare the place's current label text with its last printed snapshot. */
export function labelState(ctx: Ctx, place: Place): LabelState {
  const lines = labelLines(labelModel(ctx, place));
  if (!place.printed_at || !place.label_snapshot) {
    return { status: 'new', added: lines, removed: [], lines };
  }
  const { added, removed } = diffLines(place.label_snapshot, lines);
  return { status: added.length + removed.length ? 'changed' : 'ok', added, removed, lines };
}

export interface QueueEntry extends LabelState {
  place: Place;
  path: string;
}

/** Labeled places whose label was never printed or has changed since. */
export function printQueue(ctx: Ctx): QueueEntry[] {
  const out: QueueEntry[] = [];
  for (const p of ctx.places) {
    if (!p.labeled) continue;
    const s = labelState(ctx, p);
    if (s.status === 'ok') continue;
    out.push({
      ...s,
      place: p,
      path: ancestors(ctx, p)
        .map((a) => a.name)
        .join(' / ')
    });
  }
  return out.sort((a, b) => a.place.code - b.place.code);
}

/** Resolve a `?codes=1,2,3` style param to places. */
export function placesByCodes(ctx: Ctx, codes: string | null): Place[] {
  const out: Place[] = [];
  for (const c of (codes ?? '').split(',')) {
    const n = parseInt(c.replace('#', ''), 10);
    const p = Number.isFinite(n) ? ctx.byCode.get(n) : undefined;
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Flat, depth-annotated tree for the sidebar and parent pickers. */
export function flatTree(ctx: Ctx): { place: Place; depth: number }[] {
  const out: { place: Place; depth: number }[] = [];
  const walk = (parent: string, depth: number) => {
    for (const p of ctx.childrenOf.get(parent) ?? []) {
      out.push({ place: p, depth });
      if (depth < 20) walk(p.id, depth + 1);
    }
  };
  walk('', 0);
  return out;
}
