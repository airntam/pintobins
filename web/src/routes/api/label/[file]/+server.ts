import { error } from '@sveltejs/kit';
import { loadCtx } from '$lib/server/data';
import { labelPng, labelSvg } from '$lib/server/labels';

/** /api/label/42.svg and /api/label/0042.png */
export async function GET({ params, locals }) {
  const m = params.file.match(/^#?(\d+)\.(svg|png)$/);
  if (!m) error(404, 'Not found');
  const ctx = await loadCtx(locals.pb);
  const place = ctx.byCode.get(parseInt(m[1], 10));
  if (!place) error(404, 'No place with that code');

  if (m[2] === 'svg') {
    return new Response(labelSvg(ctx, place), {
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'private, max-age=0, must-revalidate' }
    });
  }
  return new Response(new Uint8Array(labelPng(ctx, place)), {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=0, must-revalidate' }
  });
}
