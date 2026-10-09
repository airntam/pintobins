import { fail } from '@sveltejs/kit';
import { CSV_HEADER, parseCsv } from '$lib/csv';
import { invalidate, loadCtx } from '$lib/server/data';
import { ICON_NAMES } from '$lib/icons';

export async function load({ locals, depends }) {
  depends('app:types');
  const ctx = await loadCtx(locals.pb);
  const used = new Map<string, number>();
  for (const p of ctx.places) used.set(p.type, (used.get(p.type) ?? 0) + 1);
  return {
    typeList: ctx.types.map((t) => ({ ...t, used: used.get(t.id) ?? 0 })),
    iconNames: ICON_NAMES,
    counts: { places: ctx.places.length, items: ctx.items.length }
  };
}

export const actions = {
  /** Import a CSV in the format written by /api/export.csv. Always creates new places (new codes). */
  import: async ({ request, locals }) => {
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || !file.size) return fail(400, { error: 'Choose a CSV file first.' });
    const rows = parseCsv(await file.text());
    const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
    if (!head.includes('kind') || !head.includes('name')) {
      return fail(400, { error: `That doesn't look like a Bins export. Expected columns: ${CSV_HEADER.join(', ')}.` });
    }
    const col = (r: string[], k: string) => (r[head.indexOf(k)] ?? '').trim();

    const ctx = await loadCtx(locals.pb);
    const typeByName = new Map(ctx.types.map((t) => [t.name.toLowerCase(), t.id]));
    const placeRows = rows.filter((r) => col(r, 'kind') === 'place');
    const itemRows = rows.filter((r) => col(r, 'kind') === 'item');

    try {
      const created = new Map<string, string>(); // file code -> new place id
      // parents first; loop until no more progress so file order doesn't matter
      let pending = placeRows;
      while (pending.length) {
        const next: string[][] = [];
        for (const r of pending) {
          const parentCode = col(r, 'parent_code');
          if (parentCode && !created.has(parentCode) && placeRows.some((x) => col(x, 'code') === parentCode)) {
            next.push(r);
            continue;
          }
          const tname = col(r, 'type') || 'Bin';
          let typeId = typeByName.get(tname.toLowerCase());
          if (!typeId) {
            const t = await locals.pb.collection('types').create({ name: tname, icon: 'box', color: '#8A8F98', labeled_default: false, sort: typeByName.size });
            typeId = t.id;
            typeByName.set(tname.toLowerCase(), typeId);
          }
          const parent = parentCode ? (created.get(parentCode) ?? ctx.byCode.get(parseInt(parentCode, 10))?.id ?? '') : '';
          const labeledRaw = col(r, 'labeled');
          const rec = await locals.pb.collection('places').create({
            name: col(r, 'name'),
            type: typeId,
            parent,
            notes: col(r, 'notes'),
            labeled: labeledRaw === '' ? ctx.types.find((t) => t.id === typeId)?.labeled_default ?? false : labeledRaw === '1' || labeledRaw.toLowerCase() === 'true'
          });
          created.set(col(r, 'code'), rec.id);
        }
        if (next.length === pending.length) return fail(400, { error: 'Some places point at parents that are not in the file.' });
        pending = next;
      }
      let items = 0;
      for (const r of itemRows) {
        const code = col(r, 'code');
        const placeId = created.get(code) ?? ctx.byCode.get(parseInt(code, 10))?.id;
        if (!placeId || !col(r, 'name')) continue;
        await locals.pb.collection('items').create({
          place: placeId,
          name: col(r, 'name'),
          details: col(r, 'details'),
          pinned: col(r, 'pinned') === '1',
          sort: items
        });
        items++;
      }
      invalidate();
      return { imported: { places: created.size, items } };
    } catch (e: any) {
      invalidate();
      return fail(400, { error: e?.response?.message ?? 'Import failed part-way. Check the file and try again.' });
    }
  }
};
