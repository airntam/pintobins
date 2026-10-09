import { fail, redirect } from '@sveltejs/kit';
import { setAuthCookie } from '$lib/server/pb';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/');

export function load({ locals, url }) {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
}

export const actions = {
  default: async ({ request, locals, url, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) return fail(400, { email, error: 'Enter your email and password.' });
    try {
      await locals.pb.collection('users').authWithPassword(email, password);
    } catch {
      return fail(400, { email, error: 'Email or password is wrong.' });
    }
    setAuthCookie(cookies, locals.pb);
    redirect(303, safeNext(url.searchParams.get('next')));
  }
};
