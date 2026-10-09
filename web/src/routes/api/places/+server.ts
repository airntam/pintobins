import { json } from '$lib/server/api';
import { ancestors, loadCtx } from '$lib/server/data';

/** Flat list of every place with its full path; feeds the parent picker. */
export async function GET({ locals }) {
  const ctx = await loadCtx(locals.pb);
  return json(
    ctx.places
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type,
        parent: p.parent,
        path: ancestors(ctx, p)
          .map((a) => a.name)
          .join(' / ')
      }))
      .sort((a, b) => (a.path + '/' + a.name).localeCompare(b.path + '/' + b.name))
  );
}
