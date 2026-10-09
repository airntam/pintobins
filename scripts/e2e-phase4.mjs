import { web, form, ok, pbGet, pbAdmin, login } from './e2e-lib.mjs';

// 8x8 red PNG
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGP4z8Dwn4GBgYEBAB4GAv9s0XMEAAAAAElFTkSuQmCC';
const png = () => new File([Buffer.from(PNG_B64, 'base64')], 'photo.png', { type: 'image/png' });

export async function run() {
  await login();
  const token = await pbAdmin();
  const types = (await pbGet(token, '/api/collections/types/records')).items;
  const bin = types.find((t) => t.name === 'Bin');

  // create a place with a photo through the create form
  const res = await web('/new', {
    method: 'POST',
    body: (() => {
      const f = form({ name: 'Photo test bin', type: bin.id, parent: '', labeled: '1', items: 'Camera: lens, strap' });
      f.append('photo', png());
      return f;
    })()
  });
  const code = Number((res.headers.get('location') ?? '').match(/\/p\/(\d+)/)?.[1]);
  const place = (await pbGet(token, `/api/collections/places/records?filter=code=${code}`)).items[0];
  ok(!!place?.photo, 'create form stores the photo');

  const thumb = await web(`/img/places/${place.id}/${place.photo}?thumb=96x96`);
  ok(thumb.status === 200 && thumb.headers.get('content-type')?.startsWith('image/'), 'thumbnail served through the authenticated proxy');
  const anon = await fetch((process.env.WEB_URL || 'http://localhost:5173') + `/img/places/${place.id}/${place.photo}`, { redirect: 'manual' });
  ok(anon.status === 401, 'photos need a session');

  // replace + remove on the place
  const up = await web(`/api/places/${place.id}/photo`, { method: 'POST', headers: { accept: 'application/json' }, body: (() => { const f = new FormData(); f.append('photo', png()); return f; })() });
  ok(up.status === 200, 'place photo upload endpoint');
  const del = await web(`/api/places/${place.id}/photo`, { method: 'DELETE', headers: { accept: 'application/json' } });
  ok(del.status === 200 && !(await pbGet(token, `/api/collections/places/records/${place.id}`)).photo, 'place photo removed');

  // item photo
  const item = (await pbGet(token, `/api/collections/items/records?filter=place="${place.id}"`)).items[0];
  const iup = await web(`/api/items/${item.id}/photo`, { method: 'POST', headers: { accept: 'application/json' }, body: (() => { const f = new FormData(); f.append('photo', png()); return f; })() });
  ok(iup.status === 200, 'item photo upload endpoint');
  const withPhoto = (await pbGet(token, `/api/collections/items/records/${item.id}`)).photo;
  ok(!!withPhoto, 'item photo stored');
  const page = await (await web(`/p/${code}`)).text();
  ok(page.includes(`/img/items/${item.id}/`), 'place page shows the item thumbnail');

  // bad uploads are rejected
  const bad = await web(`/api/items/${item.id}/photo`, { method: 'POST', headers: { accept: 'application/json' }, body: (() => { const f = new FormData(); f.append('photo', new File(['not an image'], 'x.txt', { type: 'text/plain' })); return f; })() });
  ok(bad.status === 400, 'non-image upload is rejected');

  const card = await (await web('/')).text();
  ok(card.length > 0, 'browse still renders');
}
