import { CSV_HEADER, toCsv } from '$lib/csv';
import { loadCtx } from '$lib/server/data';

/**
 * One file with two row kinds. For `place` rows `code` is the place's code; for
 * `item` rows it is the code of the place the item sits in.
 */
export async function GET({ locals }) {
  const ctx = await loadCtx(locals.pb);
  const rows: (string | number | boolean)[][] = [CSV_HEADER];
  const places = [...ctx.places].sort((a, b) => a.code - b.code);
  for (const p of places) {
    rows.push([
      'place',
      p.code,
      p.name,
      ctx.typeById.get(p.type)?.name ?? '',
      p.parent ? (ctx.byId.get(p.parent)?.code ?? '') : '',
      p.labeled ? 1 : 0,
      p.notes,
      '',
      ''
    ]);
  }
  for (const p of places) {
    for (const it of ctx.itemsByPlace.get(p.id) ?? []) {
      rows.push(['item', p.code, it.name, '', '', '', '', it.details, it.pinned ? 1 : 0]);
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="bins-${stamp}.csv"`
    }
  });
}
