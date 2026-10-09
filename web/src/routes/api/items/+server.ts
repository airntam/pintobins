import { guard, json, pick } from '$lib/server/api';
import { invalidate } from '$lib/server/data';
import { joinDetails, splitDetails } from '$lib/search';

/** Create an item. `sort` defaults to after the place's last item. */
export async function POST({ request, locals }) {
  return guard(async () => {
    const body = await request.json();
    const data = pick(body, ['place', 'name', 'details', 'pinned', 'sort']);
    if (typeof data.details === 'string') data.details = joinDetails(splitDetails(data.details));
    if (data.sort === undefined) {
      const last = await locals.pb
        .collection('items')
        .getList(1, 1, { filter: `place = "${String(data.place).replace(/"/g, '')}"`, sort: '-sort', fields: 'sort' });
      data.sort = (last.items[0]?.sort ?? -1) + 1;
    }
    const rec = await locals.pb.collection('items').create(data);
    invalidate();
    return json(
      { id: rec.id, place: rec.place, name: rec.name, details: rec.details, pinned: !!rec.pinned, sort: rec.sort, photo: rec.photo || '' },
      201
    );
  });
}
