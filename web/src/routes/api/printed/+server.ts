import { guard, json } from '$lib/server/api';
import { invalidate, labelModel, loadCtx } from '$lib/server/data';
import { labelLines } from '$lib/label/text';

/** Mark labels as printed: store the label text as the snapshot and stamp the time. */
export async function POST({ request, locals }) {
  return guard(async () => {
    const { codes } = (await request.json()) as { codes: number[] };
    invalidate();
    const ctx = await loadCtx(locals.pb);
    const now = new Date().toISOString().replace('T', ' ');
    let done = 0;
    for (const code of codes ?? []) {
      const place = ctx.byCode.get(Number(code));
      if (!place) continue;
      await locals.pb.collection('places').update(place.id, {
        label_snapshot: labelLines(labelModel(ctx, place)),
        printed_at: now
      });
      done++;
    }
    invalidate();
    return json({ marked: done });
  });
}
