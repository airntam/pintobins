import { web, form, json, ok, pbGet, pbAdmin, login } from './e2e-lib.mjs';

export async function run() {
  await login();
  const token = await pbAdmin();
  const get = async (name) => (await pbGet(token, `/api/collections/places/records?filter=name="${name}"`)).items[0];
  const office = await get('Upstairs Office');
  const shelf = await get('Silver Shelf');
  const solder = await get('Soldering Supplies');
  const screws = await get('Assorted metric screws');

  // move a place, then move it back
  const mv = await json('PATCH', `/api/places/${screws.id}`, { parent: shelf.id });
  ok(mv.status === 200, 'move a bin to a different parent');
  ok((await pbGet(token, `/api/collections/places/records/${screws.id}`)).parent === shelf.id, 'parent changed');
  const deep = await json('PATCH', `/api/places/${shelf.id}`, { parent: screws.id });
  ok(deep.status === 400, 'cannot move a shelf into its own descendant');
  await json('PATCH', `/api/places/${screws.id}`, { parent: solder.id });

  // move an item to another place
  const item = (await pbGet(token, `/api/collections/items/records?filter=place="${screws.id}"&sort=name`)).items[0];
  const mi = await json('PATCH', `/api/items/${item.id}`, { place: solder.id });
  ok(mi.status === 200 && (await pbGet(token, `/api/collections/items/records/${item.id}`)).place === solder.id, 'move an item to another place');
  await json('PATCH', `/api/items/${item.id}`, { place: screws.id });

  // places picker data
  const picker = await (await web('/api/places')).json();
  ok(picker.length >= 5 && picker.find((p) => p.name === 'Assorted metric screws')?.path === 'Home / Upstairs Office / Silver Shelf / Soldering Supplies', 'place picker list has full paths');

  // types
  const created = await json('POST', '/api/types', { name: 'Drawer', icon: 'package', color: '#E5C07B', labeled_default: true });
  ok(created.status === 201, 'create a type');
  const { id } = await created.json();
  ok((await json('PATCH', `/api/types/${id}`, { color: 'red' })).status === 400, 'bad colour is rejected');
  ok((await json('PATCH', `/api/types/${id}`, { color: '#112233', name: 'Drawers' })).status === 200, 'edit a type');
  const html = await (await web('/types')).text();
  ok(html.includes('Drawers') && html.includes('Export CSV'), 'settings page lists types and data tools');
  const bin = (await pbGet(token, `/api/collections/types/records?filter=name="Bin"`)).items[0];
  const used = await web(`/api/types/${bin.id}`, { method: 'DELETE', headers: { accept: 'application/json' } });
  ok(used.status === 400, 'a type in use cannot be deleted');
  const del = await web(`/api/types/${id}`, { method: 'DELETE', headers: { accept: 'application/json' } });
  ok(del.status === 200, 'an unused type can be deleted');

  // csv round trip
  const csv = await (await web('/api/export.csv')).text();
  ok(csv.startsWith('kind,code,name,type,parent_code,labeled,notes,details,pinned') && csv.includes('place,4,Soldering Supplies,Bin,3,1'), 'CSV export has places');
  ok(csv.includes('item,5,Misc metric screws,,,,,"M8×5, M8×10, M8×14",0'), 'CSV export has items');

  const before = (await pbGet(token, '/api/collections/places/records?perPage=1')).totalItems;
  const sample = 'kind,code,name,type,parent_code,labeled,notes,details,pinned\n' +
    'place,100,Imported Garage,Location,,0,,,\n' +
    'place,101,Imported Rack,Shelf,100,0,"has, comma",,\n' +
    'item,101,Hacksaw,,,,,"blade, spare",1\n';
  const f = form({});
  f.append('file', new File([sample], 'import.csv', { type: 'text/csv' }));
  const imp = await web('/types?/import', { method: 'POST', headers: { accept: 'application/json' }, body: f });
  const body = await imp.json();
  ok(imp.status === 200 && String(body.data).includes('Imported') === false && body.type === 'success', 'import action succeeds');
  const after = (await pbGet(token, '/api/collections/places/records?perPage=1')).totalItems;
  ok(after === before + 2, 'import created 2 places');
  const rack = (await pbGet(token, `/api/collections/places/records?filter=name="Imported Rack"`)).items[0];
  const garage = (await pbGet(token, `/api/collections/places/records?filter=name="Imported Garage"`)).items[0];
  ok(rack?.parent === garage?.id && rack.notes === 'has, comma', 'import kept the hierarchy and quoted fields');
  const saw = (await pbGet(token, `/api/collections/items/records?filter=name="Hacksaw"`)).items[0];
  ok(saw?.place === rack.id && saw.pinned === true, 'import attached the item to its place');
  ok(!!office, 'sanity');
}
