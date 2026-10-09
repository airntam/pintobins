import PocketBase from 'pocketbase';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as pub } from '$env/dynamic/public';

export const COOKIE = 'pb_auth';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export const pbUrl = () => env.PB_URL || 'http://127.0.0.1:8090';
export const baseUrl = () => (pub.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');

export const newPb = () => {
  const pb = new PocketBase(pbUrl());
  pb.autoCancellation(false);
  return pb;
};

/** Persist the PocketBase session in an httpOnly cookie (30 days). */
export function setAuthCookie(cookies: Cookies, pb: PocketBase) {
  const { token, record } = pb.authStore;
  const slim = record && {
    id: record.id,
    email: record.email,
    collectionId: record.collectionId,
    collectionName: record.collectionName
  };
  cookies.set(COOKIE, JSON.stringify({ token, record: slim }), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: baseUrl().startsWith('https://'),
    maxAge: SESSION_SECONDS
  });
}

/** Seconds until the JWT expires, or 0. */
export function tokenTtl(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}
