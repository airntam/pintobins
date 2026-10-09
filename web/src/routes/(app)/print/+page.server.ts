import { labelLines } from '$lib/label/text';
import { labelModel, loadCtx, printQueue } from '$lib/server/data';

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export async function load({ locals, depends }) {
  depends('app:layout');
  const ctx = await loadCtx(locals.pb);
  return {
    queue: printQueue(ctx).map((e) => ({
      id: e.place.id,
      code: e.place.code,
      name: e.place.name,
      type: e.place.type,
      path: e.path,
      status: e.status as 'new' | 'changed',
      // For a brand new label there is nothing to compare against, so no change list.
      added: e.status === 'new' ? [] : e.added,
      removed: e.removed,
      v: hash(labelLines(labelModel(ctx, e.place)).join('\n'))
    }))
  };
}
