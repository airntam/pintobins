import { redirect } from '@sveltejs/kit';
import { COOKIE } from '$lib/server/pb';

export function POST({ cookies }) {
  cookies.delete(COOKIE, { path: '/' });
  redirect(303, '/login');
}
