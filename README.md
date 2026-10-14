# Bins

A self-hosted home inventory. Every place (location, room, shelf, bin, nested to any depth) gets a permanent code like `#0042`. Labeled places get a printed 80 × 70 mm label listing their contents plus a QR code that opens the place's page, where you view and edit everything.

- **Backend:** PocketBase (JS hooks in `pocketbase/pb_hooks`, migrations in `pocketbase/pb_migrations`)
- **Front end:** SvelteKit (Svelte 5, TypeScript, `adapter-node`) in `web/`
- **Labels:** one SVG renderer (`web/src/lib/label/render.ts`); PNG is the same SVG rasterised at 203 dpi (640 × 559 px)
- **Public URL:** `https://bin.fwoink.com` (QR codes point at `<PUBLIC_BASE_URL>/p/<code>`)

```
pocketbase/   Dockerfile, pb_hooks/, pb_migrations/
web/          SvelteKit app + Dockerfile + unit tests (npm test)
scripts/      pb:download / pb launchers, e2e + smoke tests, backup.sh
docker-compose.yml          production stack (named volume, env vars only)
docker-compose.dev.yml      Docker Desktop overrides for local use
docker-compose.ghcr.yml     same stack using prebuilt GHCR images
docker-compose.admin.yml    temporary loopback-only PocketBase admin UI
```

## Configuration

Everything comes from environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Public address, e.g. `https://bin.fwoink.com`. Goes into every QR code, so set it before printing labels. |
| `PB_URL` | Where the web app reaches PocketBase (`http://pocketbase:8090` in compose, `http://127.0.0.1:8090` in plain-Node dev). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The one user. Created on first boot if no user exists; changing them later does nothing. |
| `CLOUDFLARE_TUNNEL_TOKEN` | Only for the `tunnel` profile. |
| `WEB_PORT` | Host port for `web` in compose (default 3000). |

Sessions last 30 days (httpOnly cookie, refreshed as you use the app), so scanning a QR code opens the page straight away.

---

## (a) Local development on Windows

Prerequisites: Node 22+, and optionally Docker Desktop.

### Option 1: plain Node (hot reload)

```bash
npm run setup          # installs root + web dependencies
copy .env.example .env # then edit: dev values below
npm run pb:download    # fetches the pinned PocketBase Windows binary into .pb/
npm run pb             # terminal 1: PocketBase on http://127.0.0.1:8090 (admin UI at /_/)
npm run dev            # terminal 2: app on http://localhost:5173
```

For dev, `.env` can be:

```
PUBLIC_BASE_URL=http://localhost:5173
PB_URL=http://127.0.0.1:8090
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=pick-something
```

Sign in at <http://localhost:5173> with those credentials. All npm scripts run on Windows and Linux (`cross-env`, no bash-only syntax). Data lives in `pb_data/` (git-ignored). Delete that folder to start over.

> Dropbox users: mark `node_modules`, `.pb`, `pb_data` and `web/.svelte-kit` as ignored (right-click, Dropbox, "Ignore"; or `Set-Content -Path <dir> -Stream com.dropbox.ignored -Value 1`) so sync doesn't lock files while Vite runs.

### Option 2: Docker Desktop

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

App on <http://localhost:5173>, PocketBase admin on <http://localhost:8090/_/>. This builds the same images as production; the hooks/migrations are bind-mounted so editing them only needs `docker compose restart pocketbase`. Defaults: `dev@example.com` / `dev-password-123` unless you set `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

### Tests

```bash
npm test                 # unit tests: label overflow, 640x559 PNG, QR decode (jsQR), search normalisation, CSV
npm run check            # svelte-check / TypeScript
npm run e2e              # end-to-end checks against a running dev stack (use a throwaway pb_data)
WEB_URL=http://localhost:3000 npm run smoke   # quick smoke test against any running stack
```

---

## (b) Deploy with Portainer (Stacks → Repository) and the tunnel profile

Push this repository to GitHub first (`.env`, `pb_data` and `node_modules` are git-ignored).

1. In Portainer: **Stacks → Add stack → Repository**.
   - Repository URL: your GitHub repo (add credentials if it's private). Reference: `refs/heads/main`.
   - Compose path: `docker-compose.yml`.
2. **Environment variables** (Advanced mode or the form):

   | Name | Value |
   | --- | --- |
   | `PUBLIC_BASE_URL` | `https://bin.fwoink.com` |
   | `ADMIN_EMAIL` | your email |
   | `ADMIN_PASSWORD` | a strong password |
   | `CLOUDFLARE_TUNNEL_TOKEN` | the token from the tunnel step below |
   | `COMPOSE_PROFILES` | `tunnel` |

   `COMPOSE_PROFILES=tunnel` is what enables the `cloudflared` service. Leave it out to run without the tunnel.
3. **Deploy the stack.** Portainer builds both images on the server. If building is too slow there, use the prebuilt images instead (see *Prebuilt images* below).
4. Wait until all containers are healthy, open `https://bin.fwoink.com`, and sign in.

Only `web` is exposed (on `WEB_PORT`, default 3000, for LAN access). PocketBase has no published port and is reachable only on the internal compose network.

> **LAN access caveat:** `ORIGIN` is set to `PUBLIC_BASE_URL`, and SvelteKit rejects form posts whose origin doesn't match. Use the public URL (or set `PUBLIC_BASE_URL` to the LAN address while testing). Item editing uses JSON requests and is unaffected, but login and "create place" are forms.

### Updating

Portainer: open the stack, **Pull and redeploy**. Data survives in the `pb_data` named volume.

> Setting this up for family? See [docs/INSTALL-FAMILY.md](docs/INSTALL-FAMILY.md).

### Prebuilt images (optional)

`.github/workflows/images.yml` builds `ghcr.io/<owner>/bins-web` and `bins-pocketbase` on every push to `main`. In Portainer use `docker-compose.ghcr.yml` as the compose path and add `GHCR_OWNER=<your github user, lowercase>` (and optionally `IMAGE_TAG`). For private packages, add `ghcr.io` as a registry in Portainer with a GitHub token that has `read:packages`.

---

## Cloudflare Tunnel for `bin.fwoink.com`

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → type **Cloudflared** → name it `bins`.
2. Copy the **tunnel token** from the install command (the long string after `--token`). That is `CLOUDFLARE_TUNNEL_TOKEN`.
3. **Public hostname** tab: subdomain `bin`, domain `fwoink.com`, service type **HTTP**, URL `web:3000`. (The `cloudflared` container shares the compose network with `web`, so the service name works.)
4. Deploy the stack with the `tunnel` profile (above). The tunnel shows **Healthy** in the dashboard.
5. Cloudflare creates the `bin.fwoink.com` DNS record for you. Nothing is opened on your router.

Optional extra layer: Cloudflare Access in front of the hostname. Not required, the app has its own login.

---

## (c) Deploy with Coolify (Docker Compose build pack)

Coolify provides its own HTTPS proxy and domain handling, so **don't** use the tunnel profile there.

1. **New resource → Public/Private Repository** (GitHub), pick the repo and branch.
2. **Build pack: Docker Compose**, compose file `/docker-compose.yml`.
3. After it parses, set the domain on the **web** service: `https://bin.fwoink.com:3000` (the `:3000` is the container port). Leave `pocketbase` without a domain.
4. **Environment variables:** `PUBLIC_BASE_URL=https://bin.fwoink.com`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. (`CLOUDFLARE_TUNNEL_TOKEN` is not needed.)
5. Point `bin.fwoink.com` at the Coolify server in DNS (an `A` record, or a proxied record) and **Deploy**.

The `pb_data` named volume is created by Coolify with the compose project prefix. The published `3000` port is harmless behind Coolify's proxy; remove the `ports:` line from the compose file if you'd rather not publish it.

---

## Backups

Everything (database and photos) is in the `pb_data` volume. The nightly job in `scripts/backup.sh` tars it to `/var/backups/bins` and keeps 14 days. As a cron entry on the Linux host:

```bash
# find the exact volume name first (Portainer prefixes it with the stack name)
docker volume ls | grep pb_data

# crontab -e   (root)
15 3 * * * VOLUME=bins_pb_data DEST=/var/backups/bins /opt/bins/scripts/backup.sh >> /var/log/bins-backup.log 2>&1
```

The command it runs is just:

```bash
docker run --rm -v bins_pb_data:/data:ro -v /var/backups/bins:/backup alpine \
  tar czf /backup/pb_data-$(date +%F).tar.gz -C /data .
```

Copy `/var/backups/bins` to another drive or cloud storage (rclone, restic, rsync, ...). Restore by stopping the stack and extracting the archive into an empty volume:

```bash
docker run --rm -v bins_pb_data:/data -v /var/backups/bins:/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/pb_data-2026-10-08.tar.gz -C /data"
```

PocketBase can also schedule its own consistent backups (admin UI → Settings → Backups); see *Admin UI* below.

## Admin UI / password reset

PocketBase isn't exposed. To reach its admin UI temporarily:

```bash
# on the server
docker compose -f docker-compose.yml -f docker-compose.admin.yml up -d pocketbase
docker compose exec pocketbase pocketbase superuser upsert you@example.com a-long-password --dir=/pb_data
# on your PC
ssh -L 8090:127.0.0.1:8090 you@server     # then open http://localhost:8090/_/
```

From there you can change the user's password (collection **users**). Re-run `up -d` without the admin override when you're done.

---

## Using it

- **Browse** drills down from top-level places. **Search** (`/` focuses it) matches names, notes, item names and details; "m8x10", "M8×10" and "M8 x 10" are the same query.
- **Place page** (what the QR opens, `/p/42`): tap an item to edit it; Enter adds the next item; a comma in details starts a new chip; changes save automatically with an **Undo** toast. Pin an item to keep it on the label when space is tight.
- **New place:** quick entry takes one item per line, details after a colon (`Misc metric screws: M8×5, M8×10`).
- **Labels:** the place page previews the label with **Download SVG / PNG**. **Print label** opens a print sheet sized 80 × 70 mm (`@page`), calls the print dialog, and afterwards **Mark as printed** stores the label text so changes can be detected. Choose the M260 as the printer, paper size 80 × 70 mm, margins none.
- **Print queue:** labeled places never printed, or changed since the last print, with a +/- list of what changed. Select, **Print N labels** or **Download zip** (PNG + SVG).
- **Settings:** types (icon, colour, label default), CSV export/import, sign out.

## Notes on design decisions

See `DECISIONS.md`. Open questions and status are in `PROGRESS.md`.

Fonts: Geist and Geist Mono (SIL OFL, `web/static/fonts/OFL.txt`). Label text is converted to outlines at render time, so labels never depend on fonts installed on the server or in the browser.
