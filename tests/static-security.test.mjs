import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

test('el frontend no contiene secretos, setup remoto ni una clave OpenAI', async () => {
  const jsFiles = (await readdir(resolve(root, 'js'))).filter(name => name.endsWith('.js'));
  const content = (await Promise.all(['index.html', ...jsFiles.map(name => `js/${name}`)].map(file => readFile(resolve(root, file), 'utf8')))).join('\n');
  for (const forbidden of ['SYNC_EMBED', 'ACCESS_HASH', 'github_pat_', 'sk-proj-', '#setup=', 'api.github.com']) {
    assert.equal(content.includes(forbidden), false, `No debe aparecer ${forbidden}`);
  }
});

test('la PWA permite zoom y anuncia diálogos y estados', async () => {
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert.equal(html.includes('user-scalable=no'), false);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Navegación principal"/);
});
