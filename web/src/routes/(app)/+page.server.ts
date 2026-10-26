import { loadCtx, printQueue, rollup } from '$lib/server/data';
import { readRecent } from '$lib/server/recent';
import type { Place } from '$lib/types';

const slim = ({ label_snapshot: _s, ...rest }: Place) => rest;

export async function load({ locals, cookies }) {
  const ctx = await loadCtx(locals.pb);
  const top = ctx.childrenOf.get('') ?? [];
  const kids = (p: Place) => ctx.childrenOf.get(p.id) ?? [];

  const recent = readRecent(cookies)
    .map((c) => ctx.byCode.get(c))
    .filter((p): p is Place => !!p)
    .slice(0, 6)
    .map((p) => ({
      place: slim(p),
      parent: p.parent ? (ctx.byId.get(p.parent)?.name ?? '') : '',
      rollup: rollup(ctx, p)
    }));

  return {
    recent,
    // Only reprints get the warning line; never-printed labels are just counted on the Print badge.
    outdated: printQueue(ctx)
      .filter((e) => e.status === 'changed')
      .map((e) => ({ code: e.place.code, name: e.place.name })),
    groups: top.map((p) => ({
      place: slim(p),
      rollup: rollup(ctx, p),
      children: kids(p).map((c) => ({
        place: slim(c),
        rollup: rollup(ctx, c),
        kids: kids(c).map((k) => ({ code: k.code, name: k.name, type: k.type }))
      }))
    }))
  };
}
