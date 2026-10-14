// Smoke test for any running stack (needs only the web URL and the login):
//   WEB_URL=http://localhost:3000 node scripts/smoke.mjs
// Uses ADMIN_EMAIL / ADMIN_PASSWORD from ./.env or the environment. Creates one "Smoke test bin".
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { web, form, ok, fails, login } from './e2e-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const health = await web('/health');
ok(health.status === 200, 'web + PocketBase healthy');
await login();

const types = await (await web('/api/types')).json();
const bin = types.find((t) => t.name === 'Bin');
ok(types.length >= 4 && !!bin, 'seed types present');

const res = await web('/new', {
  method: 'POST',
  body: form({ name: 'Smoke test bin', type: bin.id, parent: '', labeled: '1', items: 'Test item: M8×10, small' })
});
const code = Number((res.headers.get('location') ?? '').match(/\/p\/(\d+)/)?.[1]);
ok(res.status === 303 && code > 0, `created a place (code ${code})`);

const png = Buffer.from(await (await web(`/api/label/${code}.png`)).arrayBuffer());
ok(png.readUInt32BE(16) === 559 && png.readUInt32BE(20) === 640, 'label PNG is 559 × 640');
const found = await (await web('/search?q=m8x10')).text();
ok(found.includes('Test item'), 'search finds "m8x10"');
console.log(fails() ? `\n${fails()} FAILED` : '\nsmoke passed');
process.exit(fails() ? 1 : 0);
