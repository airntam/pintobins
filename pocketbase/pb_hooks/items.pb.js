/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  const lib = require(`${__hooks}/lib.js`);
  e.record.set('search_text', lib.normalize(e.record.get('name') + ' ' + e.record.get('details')));
  e.next();
}, 'items');

onRecordUpdate((e) => {
  const lib = require(`${__hooks}/lib.js`);
  e.record.set('search_text', lib.normalize(e.record.get('name') + ' ' + e.record.get('details')));
  e.next();
}, 'items');
