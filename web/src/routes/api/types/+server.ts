import { guard, json, pick } from '$lib/server/api';
import { invalidate, loadCtx } from '$lib/server/data';

export async function POST({ request, locals }) {
  return guard(async () => {
    const body = await request.json();
    const data = pick(body, ['name', 'icon', 'color', 'labeled_default']);
    const last = await locals.pb.collection('types').getList(1, 1, { sort: '-sort', fields: 'sort' });
    data.sort = (last.items[0]?.sort ?? -1) + 1;
    const rec = await locals.pb.collection('types').create(data);
    invalidate();
    return json({ id: rec.id }, 201);
  });
}

export async function GET({ locals }) {
  const ctx = await loadCtx(locals.pb);
  return json(ctx.types);
}
