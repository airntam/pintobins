import { ClientResponseError } from 'pocketbase';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** Run an API handler, turning PocketBase errors into JSON error responses. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ClientResponseError) {
      const detail = Object.values((e.response?.data ?? {}) as Record<string, { message?: string }>)
        .map((d) => d?.message)
        .filter(Boolean)
        .join(' ');
      return json({ error: e.response?.message && e.response.message !== 'Failed to update record.' ? e.response.message : detail || e.message }, e.status || 400);
    }
    throw e;
  }
}

/** Pick only whitelisted keys that are present in the body. */
export function pick<T extends Record<string, unknown>>(body: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in body) out[k] = body[k];
  return out;
}
