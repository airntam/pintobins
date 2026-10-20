import { guard, json } from '$lib/server/api';
import { invalidate, labelModel, loadCtx } from '$lib/server/data';
import { labelLines } from '$lib/label/text';

/**
 * Mark labels as printed: store the label text as the snapshot and stamp the time.
 * With `skip: true` the snapshot is saved but `printed_at` is left alone, so the place
 * leaves the print queue without pretending a new label was printed. The response lists
 * the previous snapshots; posting them back as `restore` undoes a skip.
 */
export async function POST({ request, locals }) {
  return guard(async () => {
    const body = (await request.json()) as {
      codes?: number[];
      skip?: boolean;
      restore?: { code: number; label_snapshot: string[] | null }[];
    };
    invalidate();
    const ctx = await loadCtx(locals.pb);
    const now = new Date().toISOString().replace('T', ' ');
    const previous: { code: number; label_snapshot: string[] | null }[] = [];
    let done = 0;
    for (const r of body.restore ?? []) {
      const place = ctx.byCode.get(Number(r.code));
      if (!place) continue;
      await locals.pb.collection('places').update(place.id, { label_snapshot: Array.isArray(r.label_snapshot) ? r.label_snapshot : null });
      done++;
    }
    for (const code of body.codes ?? []) {
      const place = ctx.byCode.get(Number(code));
      if (!place) continue;
      previous.push({ code: place.code, label_snapshot: place.label_snapshot });
      const snapshot = labelLines(labelModel(ctx, place));
      await locals.pb.collection('places').update(place.id, body.skip ? { label_snapshot: snapshot } : { label_snapshot: snapshot, printed_at: now });
      done++;
    }
    invalidate();
    return json({ marked: done, previous });
  });
}
