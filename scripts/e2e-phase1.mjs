import { web, form, json, ok, pbGet, pbAdmin, login } from './e2e-lib.mjs';

export async function run() {
  await login();
  const token = await pbAdmin();
  const types = Object.fromEntries((await pbGet(token, '/api/collections/types/records')).items.map((t) => [t.name, t.id]));
  ok(Object.keys(types).length === 4, 'four seed types exist');

  const create = async (name, type, parentId = '', items = '') => {
    const res = await web('/new', {
      method: 'POST',
      body: form({ name, type: types[type], parent: parentId, labeled: type === 'Bin' ? '1' : '0', items })
    });
    const loc = res.headers.get('location') ?? '';
    const code = Number(loc.match(/\/p\/(\d+)/)?.[1]);
    const rec = (await pbGet(token, `/api/collections/places/records?filter=code=${code}`)).items[0];
    return { code, id: rec?.id };
  };

  const home = await create('Home', 'Location');
  const office = await create('Upstairs Office', 'Room', home.id);
  const shelf = await create('Silver Shelf', 'Shelf', office.id);
  const solder = await create('Soldering Supplies', 'Bin', shelf.id, 'Soldering iron: stand, spare tips\nSolder & flux: paste, wire, flux pen\nWire cutters');
  const screws = await create('Assorted metric screws', 'Bin', solder.id, 'Misc metric screws: M8×5, M8×10, M8×14\nWashers: M8, M6\nNuts');

  const codes = [home, office, shelf, solder, screws].map((p) => p.code);
  ok(codes.every((c, i) => i === 0 || c === codes[i - 1] + 1), `codes increase by 1 (${codes.join(', ')})`);

  const items = (await pbGet(token, `/api/collections/items/records?filter=place="${screws.id}"`)).items;
  ok(items.length === 3, 'quick entry created 3 items');
  ok(items.find((i) => i.name === 'Misc metric screws')?.details === 'M8×5, M8×10, M8×14', 'details kept as comma list');

  for (const q of ['m8x10', 'M8 x 10', 'M8×10']) {
    const res = await web(`/search?q=${encodeURIComponent(q)}`);
    const html = await res.text();
    ok(html.includes('Misc metric screws') && html.includes('Assorted metric screws'), `search "${q}" finds M8×10 and its bin`);
  }

  const loop = await json('PATCH', `/api/places/${home.id}`, { parent: screws.id });
  ok(loop.status === 400, 'moving a place into its own child is refused');
  const self = await json('PATCH', `/api/places/${home.id}`, { parent: home.id });
  ok(self.status === 400, 'moving a place into itself is refused');

  const page = await (await web(`/p/${screws.code}`)).text();
  ok(page.includes('Assorted metric screws') && page.includes('#0005'), 'place page renders with code');
  ok((await web('/p/0005')).status === 307, '/p/0005 redirects to the canonical URL');
  const browse = await (await web('/')).text();
  ok(browse.includes('Home'), 'browse lists the top-level place');

  const anon = await fetch(WEB_URL() + '/p/1', { redirect: 'manual' });
  ok(anon.status === 303 && anon.headers.get('location').startsWith('/login'), 'anonymous requests go to /login');

  globalThis.__e2e = { home, office, shelf, solder, screws, types, token };
}

const WEB_URL = () => process.env.WEB_URL || 'http://localhost:5173';
