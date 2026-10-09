import { ancestors, loadCtx } from '$lib/server/data';
import { normalize, pbQuote, splitDetails } from '$lib/search';

/** Other spellings the normaliser treats as equal, shown as "also matches". */
function variants(raw: string, nq: string): string[] {
  if (!/\dx\d/.test(nq)) return [];
  const out = [nq.replace(/(\d)x(\d)/g, '$1×$2'), nq.replace(/(\d)x(\d)/g, '$1 x $2')];
  return [...new Set(out)].filter((v) => v.toLowerCase() !== raw.trim().toLowerCase()).map((v) => v.replace(/^m/, 'M'));
}

export async function load({ url, locals }) {
  const q = (url.searchParams.get('q') ?? '').trim();
  const nq = normalize(q);
  if (!nq) return { q, items: [], places: [], also: [] as string[] };

  const ctx = await loadCtx(locals.pb);
  const filter = `search_text ~ ${pbQuote(nq)}`;
  const [itemRes, placeRes] = await Promise.all([
    locals.pb.collection('items').getList(1, 60, { filter, sort: 'name' }),
    locals.pb.collection('places').getList(1, 60, { filter, sort: 'name' })
  ]);

  const pathOf = (placeId: string) => {
    const p = ctx.byId.get(placeId);
    return p ? [...ancestors(ctx, p), p].map((a) => ({ code: a.code, name: a.name, type: ctx.typeById.get(a.type) })) : [];
  };

  const items = itemRes.items
    .filter((r) => ctx.byId.has(r.place))
    .map((r) => ({
      id: r.id,
      name: r.name as string,
      chips: splitDetails(r.details),
      code: ctx.byId.get(r.place)!.code,
      path: pathOf(r.place)
    }));

  const places = placeRes.items
    .map((r) => ctx.byId.get(r.id))
    .filter((p) => !!p)
    .map((p) => ({
      place: { id: p.id, code: p.code, name: p.name, type: p.type, photo: p.photo },
      note: !normalize(p.name).includes(nq) && normalize(p.notes).includes(nq) ? 'Notes mention ' + q : ''
    }));

  return { q, items, places, also: variants(q, nq) };
}
