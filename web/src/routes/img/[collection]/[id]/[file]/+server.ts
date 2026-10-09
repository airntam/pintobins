import { error } from '@sveltejs/kit';
import { pbUrl } from '$lib/server/pb';

const ALLOWED = new Set(['places', 'items']);
const THUMBS = new Set(['96x96', '400x300']);

/** Authenticated proxy for PocketBase files; PocketBase itself is never exposed. */
export async function GET({ params, url, fetch }) {
  if (!ALLOWED.has(params.collection)) error(404);
  const thumb = url.searchParams.get('thumb');
  const qs = thumb && THUMBS.has(thumb) ? `?thumb=${thumb}` : '';
  const res = await fetch(
    `${pbUrl()}/api/files/${params.collection}/${encodeURIComponent(params.id)}/${encodeURIComponent(params.file)}${qs}`
  );
  if (!res.ok) error(res.status === 404 ? 404 : 502);
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'image/jpeg',
      'cache-control': 'private, max-age=31536000, immutable'
    }
  });
}
