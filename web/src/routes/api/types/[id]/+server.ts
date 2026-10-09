import { guard, json, pick } from '$lib/server/api';
import { invalidate } from '$lib/server/data';

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function PATCH({ params, request, locals }) {
  return guard(async () => {
    const body = await request.json();
    const data = pick(body, ['name', 'icon', 'color', 'labeled_default']);
    if (typeof data.color === 'string' && !HEX.test(data.color)) return json({ error: 'Colour must look like #A28BF5' }, 400);
    await locals.pb.collection('types').update(params.id, data);
    invalidate();
    return json({ ok: true });
  });
}

export async function DELETE({ params, locals }) {
  return guard(async () => {
    const used = await locals.pb.collection('places').getList(1, 1, { filter: `type = "${params.id.replace(/"/g, '')}"` });
    if (used.totalItems > 0) {
      return json({ error: `${used.totalItems} place${used.totalItems === 1 ? ' uses' : 's use'} this type. Change them first.` }, 400);
    }
    await locals.pb.collection('types').delete(params.id);
    invalidate();
    return json({ ok: true });
  });
}
