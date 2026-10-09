/// <reference path="../pb_data/types.d.ts" />
// Use the mockup's shelving icon for the built-in Shelf type (was Lucide "library").
migrate(
  (app) => {
    try {
      const shelf = app.findFirstRecordByFilter('types', "name = 'Shelf' && icon = 'library'");
      shelf.set('icon', 'shelf');
      app.save(shelf);
    } catch (_) {
      // already changed by the user, or a fresh install that seeds "shelf"
    }
  },
  (app) => {}
);
