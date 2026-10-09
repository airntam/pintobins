// Downloads the pinned PocketBase release for the current OS into .pb/
import { mkdirSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

export const PB_VERSION = '0.40.5';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '.pb');
const isWin = process.platform === 'win32';
const os = isWin ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
const exe = join(dir, isWin ? 'pocketbase.exe' : 'pocketbase');

if (existsSync(exe) && !process.argv.includes('--force')) {
  console.log(`PocketBase already present at ${exe} (use --force to re-download)`);
  process.exit(0);
}
const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
mkdirSync(dir, { recursive: true });
const entry = zip.getEntries().find((e) => /^pocketbase(\.exe)?$/.test(e.entryName));
if (!entry) throw new Error('pocketbase binary not found in archive');
writeFileSync(exe, entry.getData());
if (!isWin) chmodSync(exe, 0o755);
console.log(`PocketBase ${PB_VERSION} installed to ${exe}`);
