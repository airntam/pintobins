import { guard, json, pick } from '$lib/server/api';
import { invalidate } from '$lib/server/data';

const FIELDS = ['name', 'notes', 'labeled', 'parent', 'type'];

export async function PATCH({ params, request, locals }) {
  return guard(async () => {
    const body = await request.json();
    const rec = await locals.pb.collection('places').update(params.id, pick(body, FIELDS));
    invalidate();
    return json({ id: rec.id, code: rec.code });
  });
}

export async function DELETE({ params, locals }) {
  return guard(async () => {
    await locals.pb.collection('places').delete(params.id);
    invalidate();
    return json({ ok: true });
  });
}
