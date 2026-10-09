import { guard, json } from '$lib/server/api';
import { invalidate } from '$lib/server/data';

export async function POST({ params, request, locals }) {
  return guard(async () => {
    const form = await request.formData();
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size) return json({ error: 'No photo' }, 400);
    const rec = await locals.pb.collection('places').update(params.id, { photo: file });
    invalidate();
    return json({ photo: rec.photo });
  });
}

export async function DELETE({ params, locals }) {
  return guard(async () => {
    await locals.pb.collection('places').update(params.id, { photo: null });
    invalidate();
    return json({ ok: true });
  });
}
