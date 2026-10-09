import { guard, json, pick } from '$lib/server/api';
import { invalidate } from '$lib/server/data';
import { joinDetails, splitDetails } from '$lib/search';

export async function PATCH({ params, request, locals }) {
  return guard(async () => {
    const body = await request.json();
    const data = pick(body, ['name', 'details', 'pinned', 'sort', 'place']);
    if (typeof data.details === 'string') data.details = joinDetails(splitDetails(data.details));
    await locals.pb.collection('items').update(params.id, data);
    invalidate();
    return json({ ok: true });
  });
}

export async function DELETE({ params, locals }) {
  return guard(async () => {
    await locals.pb.collection('items').delete(params.id);
    invalidate();
    return json({ ok: true });
  });
}
