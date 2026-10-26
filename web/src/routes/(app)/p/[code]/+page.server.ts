import { error, redirect } from '@sveltejs/kit';
import { ancestors, labelState, loadCtx, rollup } from '$lib/server/data';
import { pushRecent } from '$lib/server/recent';

/** Cheap stable hash; used to bust the cached label preview when the text changes. */
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export async function load({ params, locals, depends, cookies }) {
  depends('app:place');
  const code = parseInt(params.code.replace('#', ''), 10);
  if (!Number.isFinite(code)) error(404, 'Not found');
  const ctx = await loadCtx(locals.pb);
  const place = ctx.byCode.get(code);
  if (!place) error(404, 'No place with that code');
  // Canonical URL: /p/42, not /p/0042
  if (params.code !== String(code)) redirect(307, `/p/${code}`);

  pushRecent(cookies, code);
  const state = labelState(ctx, place);
  const kids = ctx.childrenOf.get(place.id) ?? [];
  const { label_snapshot: _s, ...slim } = place;

  return {
    place: slim,
    steps: ancestors(ctx, place).map((a) => ({ code: a.code, name: a.name, type: ctx.typeById.get(a.type) })),
    type: ctx.typeById.get(place.type),
    children: kids.map((c) => ({
      place: (({ label_snapshot, ...rest }) => rest)(c),
      meta: rollup(ctx, c)
    })),
    items: (ctx.itemsByPlace.get(place.id) ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      details: i.details,
      pinned: i.pinned,
      photo: i.photo,
      sort: i.sort
    })),
    label: {
      status: state.status,
      changes: state.added.length + state.removed.length,
      // A brand-new label lists every line as "added"; only a reprint has a diff worth showing.
      added: state.status === 'changed' ? state.added : [],
      removed: state.status === 'changed' ? state.removed : [],
      version: hash(state.lines.join('\n'))
    }
  };
}
