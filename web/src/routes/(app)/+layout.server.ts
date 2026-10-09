import { flatTree, loadCtx, printQueue } from '$lib/server/data';

export async function load({ locals, depends }) {
  depends('app:layout');
  const ctx = await loadCtx(locals.pb);
  return {
    user: locals.user,
    types: ctx.types,
    tree: flatTree(ctx).map(({ place, depth }) => ({
      id: place.id,
      code: place.code,
      name: place.name,
      type: place.type,
      parent: place.parent,
      depth
    })),
    queueCount: printQueue(ctx).length
  };
}
