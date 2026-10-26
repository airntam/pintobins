# Progress

## Done (all six phases, each committed)

1. **Core** - collections + migrations, hooks (codes, loop check, search_text, seed types, first user), login, browse, place page with in-place item editing and undo toasts, create place with quick entry and live preview, search.
2. **Labels** - SVG renderer, QR (M), PNG 640 × 559 at 203 dpi, SVG/PNG endpoints, label preview with downloads, print sheet (`@page 80mm 70mm`, auto print, Mark as printed). Unit tests: overflow ("+ N more", pinned kept), PNG size, QR decodes to the right URL.
3. **Print queue** - change detection vs `label_snapshot`, +/- change list, batch print, zip download (PNG + SVG), queue badge, "Label out of date · N changes" banner.
4. **Photos** - places and items, thumbnails on cards, authenticated image proxy.
5. **Polish** - move places and items (searchable picker), type settings, CSV export/import, empty states.
6. **Deploy** - production compose (named volume, env vars only, healthchecks, `tunnel` profile), Dockerfiles, `.env.example`, `.gitattributes`, README (Windows dev, Portainer, Coolify, Cloudflare Tunnel, backups), GHCR workflow + `docker-compose.ghcr.yml`.

7. **Layout concepts** (2026-10-25) - Browse as a map (recently opened, rooms with what's inside, rollups, out-of-date line), place page with a right rail and a big code, swipe actions on phone item rows, docked Add item field, sidebar filter, Ctrl+Z undo, `/scan` camera page. See DECISIONS.md.

## Verified

- `npm test`: 15 unit tests pass. `npm run check`: 0 errors.
- `npm run e2e` (phases 1-5, live PocketBase + web): all pass, including the phase checks from the brief (Home › Upstairs Office › Silver Shelf › Soldering Supplies › Assorted metric screws via the UI endpoints, "m8x10" finds "M8×10", moving into a child is refused, codes increase by 1, edit-after-print lands in the queue with the right +/- lines and leaves it after printing).
- `docker compose config` validates (base, dev, tunnel profile). `docker compose build` succeeds. The stack comes up healthy on Docker Desktop using only named volumes and env vars (`npm run smoke` against it passes), for both `docker-compose.yml` and the dev override.

## Not verified

- `/scan` with a real phone camera (the preview pane blocks the camera; typing a code works). Swipe actions were tested with synthetic touch events, not a finger.

- A real print to the Phomemo M260 (no printer here). The label template is 80 × 70 mm; check the first print against the real labels (the spec's open item).
- Portainer, Coolify and the Cloudflare Tunnel themselves (no access). The compose file is validated and the stack runs locally; the README steps follow each tool's documented flow.
- The GHCR workflow hasn't run (needs the repo on GitHub).
- A phone camera scan of a printed label (the QR decodes correctly from the rendered PNG in tests).

## Open questions for Aaron

1. Should the label path always start at the top-level place ("Home › …") rather than dropping it? Currently dropped, as in the mockup.
2. (Done) Items can be reordered by dragging the handle (or arrow keys on it).
3. Printing: the Phomemo driver's paper size has to be set to 80 × 70 mm once in the browser's print dialog; if it keeps defaulting to something else, we can try a different `@page` approach after the first real print.
4. Any other label contents (e.g. notes, date printed)?
