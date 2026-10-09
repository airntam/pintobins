import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  plugins: [sveltekit()],
  // share the repo-root .env with the PocketBase scripts in dev
  envDir: '..',
  // keep the dep cache out of synced folders (Dropbox locks it on Windows)
  cacheDir: join(tmpdir(), 'bins-vite-cache'),
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
});
