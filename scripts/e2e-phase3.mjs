import { web, json, ok, pbGet, pbAdmin, login } from './e2e-lib.mjs';

export async function run() {
  await login();
  const token = await pbAdmin();
  const get = async (name) => (await pbGet(token, `/api/collections/places/records?filter=name="${name}"`)).items[0];
  const solder = await get('Soldering Supplies');
  const screws = await get('Assorted metric screws');

  // bring both labels to a clean, printed state
  await json('POST', '/api/printed', { codes: [solder.code, screws.code] });
  const inQueue = async (code) => {
    const html = await (await web('/print')).text();
    return html.includes(`/p/${code}"`) && html.includes(`/api/label/${code}.svg`);
  };
  ok(!(await inQueue(screws.code)) && !(await inQueue(solder.code)), 'printed labels are not in the queue');

  // edit an item on a printed place: the label text changes
  const items = (await pbGet(token, `/api/collections/items/records?filter=place="${screws.id}"`)).items;
  const washers = items.find((i) => i.name === 'Washers');
  const edit = await json('PATCH', `/api/items/${washers.id}`, { details: 'M8, M6, M10' });
  ok(edit.status === 200, 'item edit saved');

  let html = await (await web('/print')).text();
  ok(await inQueue(screws.code), 'edited place shows up in the queue');
  ok(html.includes('Changed'), 'row is marked Changed');
  ok(html.includes('Washers — M8, M6</s>') || html.includes('Washers — M8, M6<'), 'old line listed as removed');
  ok(html.includes('Washers — M8, M6, M10'), 'new line listed as added');
  ok(!(await inQueue(solder.code)), 'untouched place stays out of the queue');

  const page = await (await web(`/p/${screws.code}`)).text();
  ok(/Label out of date · 2 changes/.test(page.replace(/<!---->/g, '')), 'place page banner says "Label out of date · 2 changes"');

  // a new item is one added line
  await json('POST', '/api/items', { place: screws.id, name: 'Spacers' });
  const page2 = (await (await web(`/p/${screws.code}`)).text()).replace(/<!---->/g, '');
  ok(/Label out of date · 3 changes/.test(page2), 'new item adds a change');

  const zip = await web(`/api/labels.zip?codes=${screws.code}`);
  const zb = Buffer.from(await zip.arrayBuffer());
  ok(zip.status === 200 && zb.subarray(0, 2).toString() === 'PK', 'zip download works');

  await json('POST', '/api/printed', { codes: [screws.code] });
  ok(!(await inQueue(screws.code)), 'printing removes it from the queue');
}
