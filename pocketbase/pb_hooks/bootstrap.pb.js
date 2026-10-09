/// <reference path="../pb_data/types.d.ts" />

// Create the single user from ADMIN_EMAIL / ADMIN_PASSWORD on first boot.
onBootstrap((e) => {
  e.next();
  const email = $os.getenv('ADMIN_EMAIL');
  const password = $os.getenv('ADMIN_PASSWORD');
  if (!email || !password) return;
  try {
    if (e.app.countRecords('users') > 0) return;
    const users = e.app.findCollectionByNameOrId('users');
    const user = new Record(users);
    user.set('email', email);
    user.set('name', 'Aaron');
    user.set('verified', true);
    user.setPassword(password);
    e.app.save(user);
    console.log('[bins] created initial user ' + email);
  } catch (err) {
    console.log('[bins] could not create initial user: ' + err);
  }
});
