import { loadCtx } from '$lib/server/data';

export async function load({ locals }) {
  const ctx = await loadCtx(locals.pb);
  const top = ctx.childrenOf.get('') ?? [];
  return {
    places: top.map((p) => ({
      place: p,
      meta: String((ctx.childrenOf.get(p.id)?.length ?? 0) + (ctx.itemsByPlace.get(p.id)?.length ?? 0) || '')
    }))
  };
}
