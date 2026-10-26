import type { Cookies } from '@sveltejs/kit';
import { baseUrl } from './pb';

// Recently opened places, newest first, kept in a cookie as "6.7.10".
const COOKIE = 'recent';
const MAX = 8;

export function readRecent(cookies: Cookies): number[] {
  return (cookies.get(COOKIE) ?? '')
    .split('.')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX);
}

export function pushRecent(cookies: Cookies, code: number) {
  const list = [code, ...readRecent(cookies).filter((c) => c !== code)].slice(0, MAX);
  cookies.set(COOKIE, list.join('.'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: baseUrl().startsWith('https://'),
    maxAge: 60 * 60 * 24 * 365
  });
}
