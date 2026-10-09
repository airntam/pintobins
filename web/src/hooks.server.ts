import { redirect, type Handle } from '@sveltejs/kit';
import { COOKIE, newPb, setAuthCookie } from '$lib/server/pb';

const PUBLIC = ['/login', '/health'];

// A token can look fine (not expired) yet be rejected by PocketBase, e.g. after a
// password change or a database reset; PocketBase then answers lists with empty
// results instead of errors. So check it against PocketBase, at most once a minute.
const VERIFY_EVERY_MS = 60_000;
const verifiedAt = new Map<string, number>();

export const handle: Handle = async ({ event, resolve }) => {
  const pb = newPb();
  pb.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '', COOKIE);

  if (pb.authStore.isValid) {
    const token = pb.authStore.token;
    if (Date.now() - (verifiedAt.get(token) ?? 0) > VERIFY_EVERY_MS) {
      try {
        // also slides the 30-day session forward
        await pb.collection('users').authRefresh();
        setAuthCookie(event.cookies, pb);
        if (verifiedAt.size > 50) verifiedAt.clear();
        verifiedAt.set(pb.authStore.token, Date.now());
      } catch (e: any) {
        // only an explicit rejection means "logged out"; if PocketBase is merely down, keep the session
        if (e?.status === 400 || e?.status === 401 || e?.status === 403 || e?.status === 404) {
          pb.authStore.clear();
          event.cookies.delete(COOKIE, { path: '/' });
        } else {
          verifiedAt.set(token, Date.now());
        }
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

  return resolve(event);
};
