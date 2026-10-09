import { fail, redirect } from '@sveltejs/kit';
import { ancestors, invalidate, loadCtx } from '$lib/server/data';
import { parseQuickEntry } from '$lib/search';

export async function load({ locals, url }) {
  const ctx = await loadCtx(locals.pb);
  const parentCode = parseInt(url.searchParams.get('parent') ?? '', 10);
  const parent = Number.isFinite(parentCode) ? ctx.byCode.get(parentCode) : undefined;
  const typeName = url.searchParams.get('type');
  const type = ctx.types.find((t) => t.id === typeName) ?? ctx.types.find((t) => t.name === 'Bin') ?? ctx.types[0];
  return {
    parent: parent && {
      id: parent.id,
      name: parent.name,
      path: [...ancestors(ctx, parent), parent].map((p) => p.name).join(' / ')
    },
    nextCode: Math.max(0, ...ctx.places.map((p) => p.code)) + 1,
    defaultType: type?.id ?? ''
  };
}

export const actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const type = String(form.get('type') ?? '');
    const parent = String(form.get('parent') ?? '');
    const labeled = form.get('labeled') === '1';
    const itemsText = String(form.get('items') ?? '');
    const print = form.get('print') === 'on';
    const another = form.get('another') === 'on';
    const photo = form.get('photo');
    const values = { name, type, parent, itemsText };

    if (!name) return fail(400, { error: 'Give the place a name.', ...values });
    if (!type) return fail(400, { error: 'Pick a type.', ...values });

    const body: Record<string, unknown> = { name, type, parent, labeled };
    if (photo instanceof File && photo.size) body.photo = photo;

    let code: number;
    try {
      const rec = await locals.pb.collection('places').create(body);
      code = rec.code;
      for (const [i, it] of parseQuickEntry(itemsText).entries()) {
        await locals.pb.collection('items').create({ place: rec.id, name: it.name, details: it.details, sort: i });
      }
    } catch (e: any) {
      return fail(400, { error: e?.response?.message ?? 'Could not create the place.', ...values });
    }
    invalidate();

    const ctx = await loadCtx(locals.pb);
    const parentPlace = ctx.byId.get(parent);
    const again = `/new${parentPlace ? `?parent=${parentPlace.code}` : ''}`;
    if (print && labeled) {
      redirect(303, `/print/sheet?codes=${code}${another ? `&next=${encodeURIComponent(again)}` : ''}`);
    }
    redirect(303, another ? again : `/p/${code}`);
  }
};
