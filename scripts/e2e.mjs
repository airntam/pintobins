// Usage: node scripts/e2e.mjs [phase]   (phase = 1..5, default: all)
// Runs against a live dev stack (npm run pb + npm run dev); point it at a throwaway pb_data.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fails } from './e2e-lib.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const phase = process.argv[2] ? Number(process.argv[2]) : 0;
for (const p of phase ? [phase] : [1, 2, 3, 4, 5]) {
  const file = join(dir, `e2e-phase${p}.mjs`);
  if (!existsSync(file)) continue;
  console.log(`\n== phase ${p} ==`);
  await (await import(pathToFileURL(file).href)).run();
}
console.log(fails() ? `\n${fails()} FAILED` : '\nall passed');
process.exit(fails() ? 1 : 0);
