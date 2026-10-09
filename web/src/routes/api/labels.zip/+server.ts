import { error } from '@sveltejs/kit';
import JSZip from 'jszip';
import { loadCtx, placesByCodes } from '$lib/server/data';
import { labelPng, labelSvg } from '$lib/server/labels';
import { pad4 } from '$lib/types';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'label';

/** PNG (203 dpi) and SVG for each requested label, zipped. */
export async function GET({ url, locals }) {
  const ctx = await loadCtx(locals.pb);
  const places = placesByCodes(ctx, url.searchParams.get('codes'));
  if (!places.length) error(404, 'No labels selected');
  const zip = new JSZip();
  for (const p of places) {
    const base = `${pad4(p.code).slice(1)}-${slug(p.name)}`;
    zip.file(`png/${base}.png`, labelPng(ctx, p));
    zip.file(`svg/${base}.svg`, labelSvg(ctx, p));
  }
  const body = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return new Response(body.slice().buffer as ArrayBuffer, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="labels.zip"'
    }
  });
}
