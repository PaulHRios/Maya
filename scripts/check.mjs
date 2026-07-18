import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const folders = ['js'];
const files = ['sw.js'];
for (const folder of folders) {
  for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(`${folder}/${entry.name}`);
  }
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
process.stdout.write(`Sintaxis válida en ${files.length} archivos JavaScript.\n`);
