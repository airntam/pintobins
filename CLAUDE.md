# Bins — build brief

A self-hosted home inventory app. Every **place** (a location, room, shelf or bin, nested to any depth) gets a permanent code like `#0042`. Labeled places get a printed 70 × 80 mm label listing their contents, plus a QR code that opens the place's page, where you can view and edit it. One user (Aaron). Dark UI only, in a Linear-inspired style.

- Spec (source of truth for behavior): https://claude.ai/code/artifact/8de865a7-44f7-4b1a-bb74-842b57df30cc
- UI mockups (source of truth for look): https://claude.ai/artifact/VJjB33v3MDS2yaU7PVqTUg

## How to work (read first)

- Work autonomously. Build phase by phase, in order. Don't stop to ask questions unless you're truly blocked (e.g. a credential is missing). When a choice isn't covered here, pick the simplest option that fits, note it in `DECISIONS.md`, and keep going.
- After each phase, run the phase's checks. Fix anything that fails, commit with a message like `phase 1: core`, then continue to the next phase.
- Keep a short `PROGRESS.md`: what's done, what's next, and any open questions for Aaron.
- Prefer boring, well-known libraries. Don't add a UI framework or Tailwind. Use plain CSS with the tokens below.

## Stack

| Layer | Choice |
| --- | --- |
| Backend | PocketBase (latest stable), with JS hooks in `pb_hooks/` and migrations in `pb_migrations/` |
| Front end | SvelteKit (Svelte 5, TypeScript, `adapter-node`). Talks to PocketBase server-side through the `pocketbase` JS SDK. Auth token kept in an httpOnly cookie. |
| Icons | `lucide-svelte` |
| Headless UI | `bits-ui`, only where needed (menus, dialogs, combobox) |
| QR | `qrcode` (SVG output, error correction level M) |
| Label PNG | `@resvg/resvg-js` (SVG → PNG at 203 dpi). Bundle Geist and Geist Mono TTF files (OFL) in `static/fonts/` so resvg can render them. |
| Deploy | Docker Compose stack, deployable as-is through **Portainer** (Stacks → Repository) or **Coolify** (Docker Compose build pack). Public URL: `https://bin.clevernaut.com`. |

The env vars `PUBLIC_BASE_URL=https://bin.clevernaut.com`, `PB_URL=http://pocketbase:8090` and `CLOUDFLARE_TUNNEL_TOKEN` go in `.env`. Provide a `.env.example` file.

## Environments: develop on Windows, deploy on Linux

Development and testing happen on Aaron's **Windows** PC. The production server is a separate **Linux** machine running Portainer (Coolify is the alternative). Build with that in mind from the start:

- **Local dev on Windows:**
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` with Docker Desktop must work.
  - The plain-Node path must work too: `npm run dev` for the front end, plus the PocketBase Windows binary, fetched by `npm run pb:download` and started by `npm run pb`.
  - npm scripts must run on both Windows and Linux. Use `cross-env`, and no bash-only syntax in `package.json`.
  - With the dev setup, `PUBLIC_BASE_URL` is `http://localhost:5173`.
- **Production compose (`docker-compose.yml`):**
  - Self-contained, with no host-specific paths. Use **named volumes** (`pb_data`), not `./` bind mounts.
  - Each service builds from a Dockerfile in the repo: `pocketbase/Dockerfile` downloads a pinned Linux PocketBase release and copies in `pb_hooks` and `pb_migrations`; `web/Dockerfile` is a multi-stage Node build.
  - Every service has a healthcheck and `restart: unless-stopped`.
  - Configuration comes only from env vars, which get set in the Portainer or Coolify UI.
  - Only `web` is exposed. PocketBase stays on the internal network.
- **cloudflared:** put it under a compose `profiles: [tunnel]`. Portainer enables that profile; Coolify uses its own proxy and domain settings instead. The README documents both.
- **Line endings:** add a `.gitattributes` with `* text=auto eol=lf` so files edited on Windows don't break the Linux containers.
- **Git:** keep the repo pushable to GitHub, since both Portainer and Coolify deploy straight from a git repo. Never commit `.env`, `pb_data` or `node_modules`.
- **Optional:** a GitHub Actions workflow that builds both images and pushes them to GHCR, plus a `docker-compose.ghcr.yml` that uses those images. That's for when building on the server is too slow.

## Data model (PocketBase collections)

**types**: `name` (text, required, unique) · `icon` (text, a Lucide icon name) · `color` (text, hex) · `labeled_default` (bool) · `sort` (number)

Seed these four:

| name | icon | color | labeled_default |
| --- | --- | --- | --- |
| Location | `house` | `#4CB782` | false |
| Room | `door-closed` | `#E59A5B` | false |
| Shelf | `library` (or the closest shelving icon) | `#5BA4E6` | false |
| Bin | `archive` | `#A28BF5` | true |

**places**: `code` (number, unique, assigned by a hook) · `name` (text, required) · `type` (relation → types, required) · `parent` (relation → places, optional) · `photo` (file, optional, 1 image) · `notes` (text) · `labeled` (bool) · `label_snapshot` (json: the label text lines at last print) · `printed_at` (date) · `search_text` (text, set by a hook)

**items**: `place` (relation → places, required, cascade delete) · `name` (text, required) · `details` (text, a comma-separated list) · `photo` (file, optional) · `pinned` (bool) · `sort` (number) · `search_text` (text, set by a hook)

Hooks in `pb_hooks/`:

- **On place create:** set `code` = max(code) + 1 inside the same transaction. Codes start at 1 and are shown zero-padded to 4 digits as `#0001`. If `labeled` isn't set, copy it from the type's `labeled_default`.
- **On place update:** reject a `parent` that is the place itself or one of its own descendants (no loops).
- **search_text:** on place and item create or update, store a normalized string: lowercase, `×` turned into `x`, and spaces removed between a number and `x` (so "M8 × 10", "M8×10" and "m8x10" all become "m8x10"). Search normalizes the query the same way and matches with `~` (LIKE). Add SQLite FTS5 only if this turns out to be slow.
- **Access rules:** only authenticated users can read or write anything. Create one user from the env vars `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first boot.

## Routes

| Route | What it does |
| --- | --- |
| `/login` | Email and password. Sessions last 30 days. |
| `/` | Browse: top-level places as cards, each drilling down. |
| `/p/[code]` | The place page. This is what the QR code opens: `https://bin.clevernaut.com/p/42`, with no `#` and leading zeros optional. |
| `/new?parent=[code]` | Create place |
| `/search?q=` | Search |
| `/print` | Print queue |
| `/print/sheet?codes=1,2,3` | The print-ready page |
| `/types` | Type settings: icon, colour and label default |
| `/api/label/[code].svg` and `/api/label/[code].png` | Label downloads |

## Screens (match the mockups)

- **Place page:** the location path with a type icon on each step, the photo, the type and code, and the name. A "Label out of date · N changes" banner appears when the place is labeled and its current label text differs from `label_snapshot`. Buttons: Print label, Move, Add photo. Then an **Inside** section (child places as cards with type tiles) and an **Items** section (name, detail chips, pin icon), edited in place. Enter adds the next item, a comma in details starts a new chip, and changes save automatically with an undo toast. An "Add item" row sits at the bottom.
- **Create place:** type buttons with icons; a large name field; Inside (parent picker with full path); the code shown as "assigned on create"; a Labeled switch that starts at the type's default and shows "Changed from the type default" once flipped; a photo button. An **Items quick-entry** box takes one item per line, with details after a colon, separated by commas (`Misc metric screws: M8×5, M8×10`), and shows a live preview. Below that, "Print label" and "Create another" checkboxes. The button text changes between "Create and print label" and "Create [type]".
- **Search:** the input with a clear button, results as you type, and a line saying what else the query matches. An **Items** group shows detail chips with the matching chip highlighted, plus the full path with icons. A **Places** group follows.
- **Print queue (desktop-first):** a sidebar with nav and the place tree. The list shows labeled places whose label has never been printed or has changed since. Each row has a checkbox, a type tile, the code, the name, a Changed or New status dot, its path, and the changes in monospace (green lines for additions, red struck-through lines for removals), plus a label thumbnail. Actions: Select all, Download zip, Print N labels.
- **Phone navigation:** a bottom bar with Browse, Search and Print (with a count badge). On desktop, a left sidebar.

## Label (70 mm wide × 80 mm tall, portrait, pure black on white)

- **Style:** sci-fi equipment tag. A chamfered outline frame; everything else flush inside it.
- **Header:** on the left, a small tracked caption with the type ("BIN NO.") and the item count, the code's digits (about 9.5 mm cap height, Iosevka), and a boxed info strip with the uppercase tracked path. On the right, a QR code about 15 mm square holding `PUBLIC_BASE_URL/p/<code>`, in a rounded box with a quiet zone.
- **Body:** a hazard-stripe band, the name in bold between corner brackets (up to 2 lines), then the contents (room for 9-10 item lines): each item is a bold name followed by " — details". Child places are listed last, after a dashed rule, as `▸ Name #0043`.
- **Overflow:** measure the space and drop details first, then items, then end with "+ N more · scan for full list". Pinned items are always kept.
- **Rendering:** one SVG renderer, `src/lib/label/render.ts`, produces the SVG at mm units. The PNG is that SVG rasterized at 203 dpi (559 × 640 px). The preview, print and downloads all use the same renderer.
- **Print sheet:** `@page { size: 70mm 80mm; margin: 0 }`, one label per page as an `<img>` of the SVG. It calls `window.print()` automatically. After printing, the user confirms with "Mark as printed", which saves `label_snapshot` and `printed_at`.
- **Label text** (used for the snapshot and the change list): an ordered list of lines, `name`, `path`, then each item line, then each child line.

## Design tokens (`src/lib/styles/tokens.css`)

```css
:root {
  --bg: #0B0B0D; --bg-sunken: #0F0F12; --surface: #101013; --surface-2: #141417; --surface-hover: #16161A;
  --border: #1C1C20; --border-strong: #232327; --chip-border: #26262B; --chip-bg: #17171A;
  --text: #EDEDEF; --text-2: #B4B8C0; --text-3: #8A8F98; --text-4: #62666D; --sep: #4A4D55;
  --accent: #5E6AD2; --accent-soft: #23264A; --accent-text: #A5ADF6; --accent-border: #4B53A8;
  --warn: #E8C26A; --warn-bg: #1A1610; --warn-border: #3A2E14;
  --add: #7FD3A8; --add-bg: rgba(76,183,130,.10); --remove: #F09595; --remove-bg: rgba(235,87,87,.10);
  --font: 'Geist', system-ui, sans-serif; --mono: 'Geist Mono', ui-monospace, monospace;
  --fs-xs: 11px; --fs-sm: 12px; --fs-md: 13px; --fs-base: 14px; --fs-lg: 16px; --fs-xl: 20px; --fs-2xl: 22px;
  --r-sm: 5px; --r-md: 6px; --r-lg: 8px; --r-xl: 10px;
  --space: 4px; /* everything in multiples of 4 */
}
```

UI rules:

- One primary action per screen.
- Edit in place; no modal forms for content.
- Autosave with an undo toast.
- Section labels are 12 px grey sentence case, never uppercase.
- Codes are always in monospace.
- Type icons: 32 px tinted tiles (the colour at 14% opacity) on cards, 12–15 px plain icons in paths and trees.
- Touch targets are at least 44 px on phone.
- Text contrast is at least 4.5:1.
- No emoji, gradients or shadows. The only exception is the focus ring: `0 0 0 3px rgba(94,106,210,.18)`.

## Phases and checks

1. **Core:** the collections and migrations, the hooks (codes, loop check, search_text, seed types and user), login, browse, the place page with in-place item editing, create place with quick entry, and search.
   *Checks:* create Home › Upstairs Office › Silver Shelf › Soldering Supplies › Assorted metric screws through the UI, then add items via quick entry. Searching "m8x10" must find "M8×10". Moving a place into its own child must be refused. Codes must increase by 1.
2. **Labels:** the renderer, QR codes, the SVG and PNG endpoints, the label preview on the place page with download buttons, the print sheet, and "Mark as printed".
   *Checks:* a unit test for overflow (40 items gives "+ N more", and pinned items stay). The PNG must be 559 × 640. The QR must decode to the right URL (test with `jsqr` or similar).
3. **Print queue:** change detection against `label_snapshot`, the change list, batch print, and zip download.
   *Checks:* editing an item on a printed place puts it in the queue with the right +/− lines. Printing it removes it from the queue.
4. **Photos:** places and items, with thumbnails on cards (PocketBase `thumb`).
5. **Polish:** moving places and items (a parent picker with search), type settings, CSV export and import, and empty states.
6. **Deploy:** the production compose, the Dockerfiles, `.env.example` and `.gitattributes`. A README with step-by-step guides for (a) local dev on Windows, (b) deploying through Portainer Stacks → Repository with the `tunnel` profile, and (c) deploying through Coolify. It also covers the Cloudflare Tunnel setup for `bin.clevernaut.com`, and a nightly backup of the `pb_data` volume (a `docker run --rm -v pb_data:/data …` tar command for cron).
   *Checks:* `docker compose config` validates. `docker compose build` succeeds. The stack comes up healthy on Docker Desktop using only named volumes and env vars.

Do phases 1–5 against the Windows dev setup. Keep the production compose building from phase 1 onward, so deploy issues show up early.