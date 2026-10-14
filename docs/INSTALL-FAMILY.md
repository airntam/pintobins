# Install Pinto Bins at home

Pinto Bins is a home inventory app: every shelf, bin and box gets a code and a printable QR label. It runs in Docker on your own computer. Your data stays on your machine.

## What you need

- **Docker Desktop** (Windows or Mac) from https://www.docker.com/products/docker-desktop, or Docker Engine on Linux. Install it and start it once.
- About 500 MB of disk space.

## Install

1. Make a folder, for example `pintobins`.
2. Download these two files into it:
   - [`docker-compose.ghcr.yml`](https://raw.githubusercontent.com/airntam/pintobins/main/docker-compose.ghcr.yml)
   - [`.env.example`](https://raw.githubusercontent.com/airntam/pintobins/main/.env.example), then rename it to `.env`
3. Open `.env` in a text editor and set these values:

   ```
   GHCR_OWNER=airntam
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=pick-a-long-password
   PUBLIC_BASE_URL=http://localhost:3000
   ```

   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` are your login. They are only used the first time the app starts. Changing them later does not change your password.
   - `PUBLIC_BASE_URL` must be exactly the address you type into your browser. See "Using it from your phone" below.
   - You can ignore `CLOUDFLARE_TUNNEL_TOKEN`.
4. In a terminal inside that folder, run:

   ```bash
   docker compose -f docker-compose.ghcr.yml up -d
   ```

5. Wait about 30 seconds, open http://localhost:3000 and sign in.

## Using it from your phone

The QR codes on labels contain `PUBLIC_BASE_URL`, and your phone has to be able to reach that address.

- **Same Wi-Fi only:** use your computer's local address, such as `PUBLIC_BASE_URL=http://192.168.1.50:3000`. Give that computer a fixed IP in your router so it doesn't change. Then open that same address (not `localhost`) in every browser, or logins will fail.
- **Anywhere:** you need a domain and a tunnel (Cloudflare Tunnel is free). See the main README, section "Cloudflare Tunnel". Then set `PUBLIC_BASE_URL=https://your.domain` and start with `--profile tunnel`.

After changing `PUBLIC_BASE_URL`, apply it with the update command below. Labels printed earlier keep their old QR code, so choose the address before you print.

## Update to the latest version

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Your data is kept in a Docker volume called `pb_data`, so updates don't touch it.

## Stop, start, and logs

```bash
docker compose -f docker-compose.ghcr.yml stop      # stop
docker compose -f docker-compose.ghcr.yml start     # start again
docker compose -f docker-compose.ghcr.yml logs -f   # watch the logs
```

Docker Desktop also starts the app again after a reboot, as long as Docker Desktop launches at login.

## Back up your data

Everything lives in the `pb_data` volume. To save a copy into the current folder:

```bash
docker run --rm -v bins_pb_data:/data -v "${PWD}:/backup" alpine tar czf /backup/pintobins-backup.tgz -C /data .
```

On Windows Command Prompt, use `%cd%` instead of `${PWD}`. If the volume name differs, run `docker volume ls` and look for the one ending in `pb_data`. The main README has a nightly cron version.

## Remove it

```bash
docker compose -f docker-compose.ghcr.yml down       # keeps your data
docker compose -f docker-compose.ghcr.yml down -v    # also deletes all your data
```

## Trouble

- **Login says "Cross-site POST form submissions are forbidden":** the address in your browser doesn't match `PUBLIC_BASE_URL`. Fix one of them, then run the update command.
- **`pull` is denied:** the images may be private. Tell Aaron.
- **Forgot your password:** see "Admin UI / password reset" in the main README.
