/// <reference path="../pb_data/types.d.ts" />

// Default the Labeled switch from the type when the client didn't send it.
onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {};
  if (body.labeled === undefined || body.labeled === null || body.labeled === '') {
    try {
      const type = e.app.findRecordById('types', e.record.get('type'));
      e.record.set('labeled', type.getBool('labeled_default'));
    } catch (_) {}
  }
  e.next();
}, 'places');

// Assign the next code inside the same transaction as the insert.
onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib.js`);
  const row = new DynamicModel({ m: 0 });
  e.app.db().newQuery('SELECT COALESCE(MAX(code), 0) AS m FROM places').one(row);
  e.record.set('code', row.m + 1);
  e.record.set('search_text', lib.normalize(e.record.get('name') + ' ' + e.record.get('notes')));
  e.next();
}, 'places');

onRecordUpdate((e) => {
  const lib = require(`${__hooks}/lib.js`);

  // Codes are permanent.
  const original = e.record.original();
  if (original && e.record.get('code') !== original.get('code')) {
    e.record.set('code', original.get('code'));
  }

  // No loops: walk up from the new parent; hitting ourselves means a cycle.
  let cur = e.record.get('parent');
  let guard = 0;
  while (cur && guard++ < 1000) {
    if (cur === e.record.id) {
      throw new BadRequestError("A place can't be moved into itself or one of its own children.");
    }
    cur = e.app.findRecordById('places', cur).get('parent');
  }

  e.record.set('search_text', lib.normalize(e.record.get('name') + ' ' + e.record.get('notes')));
  e.next();
}, 'places');

// Refuse to delete a place that still has places inside it.
onRecordDelete((e) => {
  const n = e.app.countRecords('places', $dbx.hashExp({ parent: e.record.id }));
  if (n > 0) {
    throw new BadRequestError('Move or delete the places inside first.');
  }
  e.next();
}, 'places');
