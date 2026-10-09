import { redirect, type Handle } from '@sveltejs/kit';
import { COOKIE, newPb, setAuthCookie, SESSION_SECONDS, tokenTtl } from '$lib/server/pb';

const PUBLIC = ['/login', '/health'];

export const handle: Handle = async ({ event, resolve }) => {
  const pb = newPb();
  pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', COOKIE);
  let refreshed = false;

  if (pb.authStore.isValid) {
    // Sliding 30-day session: refresh once the token is a day old.
    if (tokenTtl(pb.authStore.token) < SESSION_SECONDS - 24 * 60 * 60) {
      try {
        await pb.collection('users').authRefresh();
        refreshed = true;
        setAuthCookie(event.cookies, pb);
      } catch {
        pb.authStore.clear();
      }
    }
  }

  event.locals.pb = pb;
  const model = pb.authStore.isValid ? pb.authStore.record : null;
  event.locals.user = model ? { id: model.id, email: String(model.email ?? '') } : null;

  const path = event.url.pathname;
  if (!event.locals.user && !PUBLIC.includes(path)) {
    if (path.startsWith('/api/') || path.startsWith('/img/')) {
      return new Response('Unauthorized', { status: 401 });
    }
    const next = path + event.url.search;
    redirect(303, `/login?next=${encodeURIComponent(next)}`);
  }

  const response = await resolve(event);
  return response;
};
