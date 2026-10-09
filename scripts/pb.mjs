// Starts the local PocketBase with this repo's hooks + migrations (reads ./.env)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const exe = join(root, '.pb', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
if (!existsSync(exe)) {
  console.error('PocketBase binary missing. Run: npm run pb:download');
  process.exit(1);
}
const args = [
  'serve',
  '--http=127.0.0.1:8090',
  `--dir=${join(root, 'pb_data')}`,
  `--hooksDir=${join(root, 'pocketbase', 'pb_hooks')}`,
  `--migrationsDir=${join(root, 'pocketbase', 'pb_migrations')}`
];
const child = spawn(exe, args, { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
