// End-to-end smoke test against a running dev stack (npm run pb + npm run dev).
// It creates data in whatever PocketBase is running, so point it at a throwaway pb_data.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const WEB = process.env.WEB_URL || 'http://localhost:5173';
const PB = process.env.PB_URL || 'http://127.0.0.1:8090';

let cookie = '';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

async function web(path, init = {}) {
  const res = await fetch(WEB + path, {
    redirect: 'manual',
    ...init,
    headers: { origin: WEB, cookie, accept: 'text/html', ...(init.headers ?? {}) }
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  return res;
}
const form = (obj) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.append(k, v);
  return f;
};
const json = (method, path, body) =>
  web(path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });

async function pbAdmin() {
  const r = await fetch(`${PB}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  return (await r.json()).token;
}
const pbGet = async (token, path) => (await fetch(PB + path, { headers: { authorization: token } })).json();

export { web, form, json, ok, pbGet, pbAdmin, WEB, PB };
export const fails = () => failures;
export const login = async () => {
  const res = await web('/login', {
    method: 'POST',
    body: form({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  });
  ok(res.status === 303 && cookie.includes('pb_auth'), 'login sets the session cookie');
};

