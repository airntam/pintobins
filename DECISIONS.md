# Decisions

Choices made where the brief was silent or where reality differed. Newest concerns last within each section.

## Stack versions

- **PocketBase v0.40.5** (latest at build time), pinned in `scripts/pb-download.mjs` and `pocketbase/Dockerfile`. In this version the JS hook for startup is `onBootstrap` (there is no `onServe`), so the first-user creation runs after `e.next()` in `onBootstrap`.
- **SvelteKit 2 / Vite 7**, not SvelteKit 3. `npm` resolves `@sveltejs/kit@latest` to v3, which removes `$lib`, `$env/*` and `svelte.config.js`. The brief's stack (adapter-node, Svelte 5) is fully met by 2.x, so the app is pinned to `^2`.
- **No `bits-ui`.** The only overlay needed was the place picker, built on the native `<dialog>` element (focus trap, Esc, backdrop for free). Fewer dependencies.
- Vite's dependency cache is moved to the OS temp dir (`web/vite.config.ts`) because Dropbox locks `node_modules/.vite` on Windows.

## Data and hooks

- PocketBase collections created through JS don't get `created`/`updated`, so the migration adds explicit autodate fields.
- `labeled` defaults from the type in an `onRecordCreateRequest` hook, only when the request doesn't send it. The UI always sends it (it has the switch).
- Codes are immutable (an update that changes `code` is silently reverted) and a place with children can't be deleted (move them first).
- Deleting a place cascades to its items (relation `cascadeDelete`).
- `search_text` is `normalize(name + notes)` for places and `normalize(name + details)` for items. The normalisation exists twice (`pb_hooks/lib.js`, `web/src/lib/search.ts`) and is unit-tested on the TS side. Search uses PocketBase's `~` filter; FTS5 was not needed.
- Photos are served by a SvelteKit proxy (`/img/...`) that requires the session; PocketBase itself is never exposed. Thumbnails: `96x96` (cards, items) and `400x300` (place header).
- Items store `sort`; new items go to the end. Reorder by dragging the grip (pointer events, works with touch) or with the arrow keys on it; every changed `sort` is saved with an Undo toast.

## Labels

- **Text is converted to outlines** (opentype.js, bundled Geist TTFs). The SVG is then identical in a browser `<img>`, in print and when rasterised, with no fonts needed in the container or the browser, and measurement for overflow uses the exact same metrics. `▸` isn't in Geist, so it's drawn as a triangle.
- **Path on the label** leaves out the outermost ancestor once there are at least two ("Upstairs Office › Silver Shelf", not "Home › …"), matching the mockup. The place page breadcrumb shows the full path.
- **Overflow order:** full wrapped details → details cut to one line → names only → drop entries from the end (child places go before items, pinned items never) with "+ N more · scan for full list".
- **QR:** error correction M, module size is a whole number of 203 dpi pixels (5 px for a 29-module code, ≈ 18 mm square) so it stays crisp when thresholded. Larger would need a shorter URL.
- **PNG** is the same layout rendered with `width=559 height=640` (70 mm × 80 mm at 203 dpi is 559.4 × 639.4 px, so the raster is non-uniformly scaled by well under 1%), thresholded to pure black and white, 8-bit greyscale.
- **Snapshot** (`label_snapshot`) is the ordered text lines: name, path, item lines (`name — details`), child lines (`▸ Name #0043`). Change detection is a multiset diff, so re-ordering items isn't a change; renaming an item is one removed + one added line (2 changes).
- Marking printed happens in a separate step ("Mark as printed") because the browser can't tell whether the printer actually printed.

## App behaviour

- Moving a place also offers "Top level". The picker hides the place and its descendants; the server hook is the real guard.
- `Create another` keeps the same parent; with `Print label` ticked it prints first and returns to the form (`next=` on the print sheet).
- The print queue starts with nothing selected ("Select all" is one click) so nothing is printed by accident.
- CSV import always creates new places with new codes (codes in the file are only used to link rows); missing types are created. Items in a file may also point at an existing place code.
- `--text-4` was lightened from the brief's #62666D (about 3.3:1) to #7D828B (about 5:1) so every text and icon use meets the 4.5:1 rule. Disabled buttons use a dim but readable style instead of reduced opacity.
- Phone navigation has four tabs (Browse, Search, Print, Settings); the top search bar appears only on place pages, as in the mockup. The New place footer is part of the page flow so it never covers the Items field.
- Accounts: sign-up is disabled (`users` create rule is admin-only); one user comes from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first boot. Sessions are 30 days, refreshed when older than a day.

## Deployment

- `web` uses `node:22-slim` (glibc) rather than Alpine so `@resvg/resvg-js` runs without extra work.
- `ORIGIN` is set to `PUBLIC_BASE_URL` in compose, which SvelteKit needs behind a TLS-terminating proxy or tunnel; the consequence is that form posts must come from that origin.
- The compose project is named `bins`, so the data volume is `bins_pb_data` when run from the CLI (Portainer prefixes the stack name instead).
- `COMPOSE_PROFILES=tunnel` is how Portainer turns on `cloudflared`; Coolify leaves it off.
- A small `docker-compose.admin.yml` publishes the PocketBase admin UI on the server's loopback only, for password resets.

- **Label typeface: Data voice of Aaron's Design System** (2026-10-13). Labels use Iosevka Aile 800 (place name), 600 (item and child names), 400 (path, details, "+ N more") and Iosevka 600 (codes). The UI keeps Geist. Fonts are the design system's Latin-subset WOFF2 files converted to TTF (opentype.js can't read WOFF2) in `web/static/fonts/`, with `OFL-Iosevka.txt`. Any character missing from the subset falls back to the matching Geist face, per character. Layout, sizes and spacing are unchanged; the design system's copy and mark rules (em dashes, ▸, centred code) are deliberately not applied.

- **Sci-fi label layout** (2026-10-14). Per Aaron's reference: chamfered frame, huge code digits (scaled to fill the left column, about 13 mm cap height) under a "BIN NO." caption built from the place's type, boxed QR, hazard stripes, bracketed name, boxed info strip (path and item count). Revised the same day to keep 9-10 item lines: QR about 15 mm, code about 9.5 mm cap height, path strip and item count moved into the header beside the QR. Label text lines for the snapshot are unchanged, so printed labels don't show as changed.
