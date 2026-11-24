const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require.resolve('../js/store.js'), 'utf8');
const application = readFileSync(require.resolve('../js/app.js'), 'utf8');
const sessionKey = 'maya.session.v1';
const profileKey = 'maya.sesion-activa.v1';
const roleKey = 'maya.dispositivo.v1';
const fixtureProfile = JSON.stringify({ familia: 'fixture', email: 'sample@example.invalid', quien: 'papa' });

function fixture(entries) {
  const storage = new Map(entries);
  const api = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  };
  const ctx = vm.createContext({ localStorage: api, clearTimeout, console });
  const store = vm.runInContext(source + '\nStore;', ctx);
  return { storage, store };
}

test('a durable session marker without an authenticated principal is not a real login', () => {
  const { store } = fixture([[sessionKey, 'ok']]);
  assert.equal(store.hasRealSession(), false);
  assert.equal(store.hasSession(), false);
  assert.equal(store.canSync(), false);
});

test('synthetic demo opens without writing a real login marker or changing the saved device role', async () => {
  const { storage, store } = fixture([[roleKey, 'papa']]);
  store.activarDemo(store.emptyData());
  store.setDispositivo('mama');
  const result = await store.crearCuenta({ email: 'sample@example.invalid' });
  assert.ok(result.error);
  assert.equal(store.getDispositivo(), 'mama');
  assert.equal(storage.get(roleKey), 'papa');
  assert.equal(store.hasSession(), true);
  assert.equal(store.hasRealSession(), false);
  assert.equal(storage.has(sessionKey), false);
  assert.equal(storage.has(profileKey), false);
});

test('demo exit leaves a valid real session untouched; real logout clears it', () => {
  const entries = [[sessionKey, 'ok'], [profileKey, fixtureProfile]];
  const demo = fixture(entries);
  demo.store.activarDemo(demo.store.emptyData());
  demo.store.logout();
  assert.equal(demo.storage.get(sessionKey), 'ok');
  assert.equal(demo.storage.get(profileKey), fixtureProfile);
  assert.equal(demo.store.canSync(), false);

  const real = fixture(entries);
  assert.equal(real.store.hasRealSession(), true);
  real.store.logout();
  assert.equal(real.store.hasRealSession(), false);
  assert.equal(real.storage.has(sessionKey), false);
  assert.equal(real.storage.has(profileKey), false);
});

test('legacy fragments are removed but have no configuration parser in application startup', () => {
  const startup = application.slice(application.lastIndexOf('const paramsURL'));
  assert.match(startup, /history\.replaceState/);
  assert.doesNotMatch(startup, /JSON\.parse|atob\(|Store\.saveConfig|Store\.config/);
  assert.match(application, /const leerCfg = \(\) => \{[\s\S]*?Store\.saveConfig\(\)/);
});
