/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const authed = '@request.auth.id != ""';
    const stamps = [
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true }
    ];

    // Single-user app: no public signup, 30-day sessions.
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null;
    users.authToken.duration = 2592000;
    app.save(users);

    const types = new Collection({
      type: 'base',
      name: 'types',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { type: 'text', name: 'name', required: true },
        { type: 'text', name: 'icon' },
        { type: 'text', name: 'color' },
        { type: 'bool', name: 'labeled_default' },
        { type: 'number', name: 'sort' },
        ...stamps
      ],
      indexes: ['CREATE UNIQUE INDEX idx_types_name ON types (name)']
    });
    app.save(types);

    const places = new Collection({
      type: 'base',
      name: 'places',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        { type: 'number', name: 'code', onlyInt: true },
        { type: 'text', name: 'name', required: true },
        { type: 'relation', name: 'type', required: true, collectionId: types.id, maxSelect: 1 },
        {
          type: 'file',
          name: 'photo',
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          thumbs: ['96x96', '400x300']
        },
        { type: 'text', name: 'notes' },
        { type: 'bool', name: 'labeled' },
        { type: 'json', name: 'label_snapshot', maxSize: 200000 },
        { type: 'date', name: 'printed_at' },
        { type: 'text', name: 'search_text' },
        ...stamps
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_places_code ON places (code)',
        'CREATE INDEX idx_places_search ON places (search_text)'
      ]
    });
    app.save(places);
    // the self relation needs the collection id, so add it after the first save
    places.fields.add(new RelationField({ name: 'parent', collectionId: places.id, maxSelect: 1 }));
    app.save(places);
    places.addIndex('idx_places_parent', false, 'parent', '');
    app.save(places);

    const items = new Collection({
      type: 'base',
      name: 'items',
      listRule: authed,
      viewRule: authed,
      createRule: authed,
      updateRule: authed,
      deleteRule: authed,
      fields: [
        {
          type: 'relation',
          name: 'place',
          required: true,
          collectionId: places.id,
          maxSelect: 1,
          cascadeDelete: true
        },
        { type: 'text', name: 'name', required: true },
        { type: 'text', name: 'details' },
        {
          type: 'file',
          name: 'photo',
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          thumbs: ['96x96', '400x300']
        },
        { type: 'bool', name: 'pinned' },
        { type: 'number', name: 'sort' },
        { type: 'text', name: 'search_text' },
        ...stamps
      ],
      indexes: [
        'CREATE INDEX idx_items_place ON items (place)',
        'CREATE INDEX idx_items_search ON items (search_text)'
      ]
    });
    app.save(items);

    const seed = [
      ['Location', 'house', '#4CB782', false],
      ['Room', 'door-closed', '#E59A5B', false],
      ['Shelf', 'shelf', '#5BA4E6', false],
      ['Bin', 'archive', '#A28BF5', true]
    ];
    seed.forEach((s, i) => {
      const r = new Record(types);
      r.set('name', s[0]);
      r.set('icon', s[1]);
      r.set('color', s[2]);
      r.set('labeled_default', s[3]);
      r.set('sort', i);
      app.save(r);
    });
  },
  (app) => {
    ['items', 'places', 'types'].forEach((n) => {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (_) {}
    });
  }
);
