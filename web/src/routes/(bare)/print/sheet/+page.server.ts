import { error } from '@sveltejs/kit';
import { loadCtx, placesByCodes } from '$lib/server/data';
import { labelLines } from '$lib/label/text';
import { labelModel } from '$lib/server/data';

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export async function load({ url, locals }) {
  const ctx = await loadCtx(locals.pb);
  const places = placesByCodes(ctx, url.searchParams.get('codes'));
  if (!places.length) error(404, 'No labels to print');
  const next = url.searchParams.get('next');
  return {
    labels: places.map((p) => ({
      code: p.code,
      name: p.name,
      v: hash(labelLines(labelModel(ctx, p)).join('\n'))
    })),
    next: next && next.startsWith('/') && !next.startsWith('//') ? next : null
  };
}
