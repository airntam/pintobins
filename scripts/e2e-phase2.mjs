import { web, json, ok, pbGet, pbAdmin, login, WEB } from './e2e-lib.mjs';

export async function run() {
  await login();
  const token = await pbAdmin();
  const bin = (await pbGet(token, `/api/collections/places/records?filter=name="Soldering Supplies"`)).items[0];
  ok(!!bin, 'phase 1 data present (Soldering Supplies)');

  const svg = await web(`/api/label/${bin.code}.svg`);
  const svgText = await svg.text();
  ok(svg.status === 200 && svg.headers.get('content-type') === 'image/svg+xml', 'label SVG endpoint');
  ok(svgText.includes('width="70mm"') && svgText.includes('height="80mm"'), 'SVG is 70 × 80 mm');

  const png = await web(`/api/label/${bin.code}.png`);
  const buf = Buffer.from(await png.arrayBuffer());
  ok(png.status === 200 && buf.subarray(1, 4).toString() === 'PNG', 'label PNG endpoint');
  ok(buf.readUInt32BE(16) === 559 && buf.readUInt32BE(20) === 640, `PNG is 559 × 640 (got ${buf.readUInt32BE(16)} × ${buf.readUInt32BE(20)})`);
  ok((await web('/api/label/9999.svg')).status === 404, 'unknown code is a 404');

  const page = await (await web(`/p/${bin.code}`)).text();
  ok(page.includes(`/api/label/${bin.code}.svg`) && page.includes('Download PNG'), 'place page shows the label preview and downloads');

  const sheet = await (await web(`/print/sheet?codes=${bin.code}`)).text();
  ok(sheet.includes(`/api/label/${bin.code}.svg`) && sheet.includes('Mark as printed') && sheet.includes('size: 70mm 80mm'), 'print sheet renders at 70 × 80 mm');

  const marked = await json('POST', '/api/printed', { codes: [bin.code] });
  ok(marked.status === 200, 'Mark as printed succeeds');
  const after = (await pbGet(token, `/api/collections/places/records/${bin.id}`));
  ok(Array.isArray(after.label_snapshot) && after.label_snapshot[0] === 'Soldering Supplies' && !!after.printed_at, 'snapshot and printed_at saved');
}
