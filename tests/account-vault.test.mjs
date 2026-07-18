import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  AccountVaultError,
  createAccountVault,
  constants,
  normalizeUsername,
} = require('../js/account-vault.js');

const PASSWORD = 'Una frase larga y unica 2026!';

function accountRecords(storage) {
  return [...storage.entries()]
    .filter(([key]) => key.includes(':account:'))
    .map(([key, value]) => ({ key, record: JSON.parse(value) }));
}

function initialData(marker = 'privado') {
  return {
    baby: {
      name: `Bebe ${marker}`,
      birthDate: '2026-01-02',
    },
    data: {
      feeds: [{ id: 'feed-1', ml: 60, note: marker }],
      sleeps: [],
    },
  };
}

test('crea, lista y desbloquea una cuenta sin guardar plaintext sensible', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'test.vault.basic' });
  const source = initialData('ultra-secreto');

  const created = await vault.createAccount({
    username: '  Maya.Parent  ',
    displayName: 'Mamá de Maya',
    password: PASSWORD,
    baby: source.baby,
    data: source.data,
  });

  assert.equal(created.account.username, 'maya.parent');
  assert.equal(created.account.displayName, 'Mamá de Maya');
  assert.deepEqual(created.data.baby, source.baby);
  assert.equal(vault.hasSession(), true);
  assert.equal(vault.currentAccount().revision, 1);

  const listed = vault.listAccounts();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].username, 'maya.parent');
  assert.equal(listed[0].displayName, 'Mamá de Maya');

  const serializedStorage = [...storage.values()].join('\n');
  assert.equal(serializedStorage.includes('Bebe ultra-secreto'), false);
  assert.equal(serializedStorage.includes('feed-1'), false);
  assert.equal(serializedStorage.includes(PASSWORD), false);

  vault.logout();
  assert.equal(vault.hasSession(), false);
  assert.equal(vault.currentAccount(), null);
  await assert.rejects(vault.loadVault(), /No se pudo cargar la boveda\./);

  const unlocked = await vault.unlockAccount({
    username: 'MAYA.PARENT',
    password: PASSWORD,
  });
  assert.deepEqual(unlocked.data.baby, source.baby);
  assert.deepEqual(await vault.loadVault(), unlocked.data);
});

test('usa PBKDF2-SHA256 >=310k, salt unico e IV nuevo por cuenta', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'test.vault.crypto' });

  await vault.createAccount({
    username: 'account-one',
    displayName: 'Cuenta Uno',
    password: PASSWORD,
    baby: { name: 'Uno' },
  });
  vault.lock();
  await vault.createAccount({
    username: 'account-two',
    displayName: 'Cuenta Dos',
    password: PASSWORD,
    baby: { name: 'Dos' },
  });

  const records = accountRecords(storage).map(entry => entry.record);
  assert.equal(records.length, 2);
  for (const record of records) {
    assert.equal(record.kdf.name, 'PBKDF2');
    assert.equal(record.kdf.hash, 'SHA-256');
    assert.ok(record.kdf.iterations >= 310000);
    assert.equal(Buffer.from(record.kdf.salt, 'base64').byteLength, constants.SALT_BYTES);
    assert.equal(record.cipher.name, 'AES-GCM');
    assert.equal(record.cipher.tagLength, 128);
    assert.equal(Buffer.from(record.cipher.iv, 'base64').byteLength, constants.IV_BYTES);
  }
  assert.notEqual(records[0].kdf.salt, records[1].kdf.salt);
  assert.notEqual(records[0].cipher.iv, records[1].cipher.iv);
  assert.notEqual(records[0].cipher.ciphertext, records[1].cipher.ciphertext);
});

test('normaliza username y conserva capitalizacion y acentos del display name', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'test.vault.names' });

  assert.equal(normalizeUsername('  ＡＬＩＣＥ  '), 'alice');
  await vault.createAccount({
    username: 'Alice',
    displayName: 'Álice Hernández',
    password: PASSWORD,
    baby: { name: 'Maya' },
  });

  assert.equal(vault.listAccounts()[0].displayName, 'Álice Hernández');
  await assert.rejects(
    vault.createAccount({
      username: '  ＡＬＩＣＥ ',
      displayName: 'Otra Álice',
      password: 'Otra frase larga y distinta!',
      baby: { name: 'Otro bebé' },
    }),
    error => error instanceof AccountVaultError
      && error.message === 'No se pudo crear la cuenta.',
  );
});

test('guarda con IV nuevo, carga el contenido y no persiste la sesion', async () => {
  const storage = new Map();
  const namespace = 'test.vault.session';
  const first = createAccountVault({ storage, namespace });

  await first.createAccount({
    username: 'caregiver',
    displayName: 'Cuidador Principal',
    password: PASSWORD,
    baby: { name: 'Maya' },
    data: { feeds: [] },
  });
  const before = accountRecords(storage)[0].record;

  const updated = {
    schemaVersion: 1,
    baby: { name: 'Maya', weightKg: 4.2 },
    feeds: [{ id: 'feed-2', ml: 75 }],
  };
  await first.saveVault(updated);
  const after = accountRecords(storage)[0].record;

  assert.equal(after.revision, 2);
  assert.notEqual(after.cipher.iv, before.cipher.iv);
  assert.notEqual(after.cipher.ciphertext, before.cipher.ciphertext);
  assert.deepEqual(await first.loadVault(), updated);

  const freshProcess = createAccountVault({ storage, namespace });
  assert.equal(freshProcess.hasSession(), false);
  await assert.rejects(freshProcess.load(), /No se pudo cargar la boveda\./);
  const unlocked = await freshProcess.unlock({ username: 'CAREGIVER', password: PASSWORD });
  assert.deepEqual(unlocked.data, updated);
});

test('da el mismo error generico para cuenta inexistente y password incorrecto', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'test.vault.errors' });
  await vault.createAccount({
    username: 'existing-user',
    displayName: 'Usuario Existente',
    password: PASSWORD,
    baby: { name: 'Maya' },
  });
  vault.lock();

  const messages = [];
  for (const credentials of [
    { username: 'existing-user', password: 'Password incorrecto pero largo' },
    { username: 'missing-user', password: 'Password incorrecto pero largo' },
  ]) {
    try {
      await vault.unlockAccount(credentials);
      assert.fail('unlock debio fallar');
    } catch (error) {
      assert.ok(error instanceof AccountVaultError);
      messages.push(error.message);
    }
  }
  assert.deepEqual(messages, [
    'No se pudo desbloquear la cuenta.',
    'No se pudo desbloquear la cuenta.',
  ]);
});

test('detecta alteracion del ciphertext mediante AES-GCM', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'test.vault.tamper' });
  await vault.createAccount({
    username: 'tamper-user',
    displayName: 'Tamper Test',
    password: PASSWORD,
    baby: { name: 'Dato autenticado' },
  });
  vault.lock();

  const entry = accountRecords(storage)[0];
  const bytes = Buffer.from(entry.record.cipher.ciphertext, 'base64');
  bytes[0] ^= 0x01;
  entry.record.cipher.ciphertext = bytes.toString('base64');
  storage.set(entry.key, JSON.stringify(entry.record));

  await assert.rejects(
    vault.unlock({ username: 'tamper-user', password: PASSWORD }),
    error => error instanceof AccountVaultError
      && error.message === 'No se pudo desbloquear la cuenta.',
  );
});

test('evita overwrite silencioso entre dos instancias con revision optimista', async () => {
  const storage = new Map();
  const namespace = 'test.vault.conflict';
  const first = createAccountVault({ storage, namespace });
  const second = createAccountVault({ storage, namespace });

  await first.createAccount({
    username: 'shared-local',
    displayName: 'Cuenta Local Compartida',
    password: PASSWORD,
    baby: { name: 'Maya' },
  });
  await second.unlockAccount({ username: 'shared-local', password: PASSWORD });

  await first.save({ schemaVersion: 1, baby: { name: 'Maya', note: 'primero' } });
  await assert.rejects(
    second.save({ schemaVersion: 1, baby: { name: 'Maya', note: 'segundo' } }),
    /No se pudo guardar la boveda\./,
  );

  const latest = await second.load();
  assert.equal(latest.baby.note, 'primero');
  await second.save({ schemaVersion: 1, baby: { name: 'Maya', note: 'segundo' } });
  assert.equal((await second.load()).baby.note, 'segundo');
});

test('aplica validacion basica, limites y minimo criptografico', async () => {
  const storage = new Map();
  assert.throws(
    () => createAccountVault({
      storage,
      namespace: 'test.vault.weak-kdf',
      iterations: 309999,
    }),
    /No se pudo inicializar la boveda\./,
  );

  const vault = createAccountVault({ storage, namespace: 'test.vault.limits' });
  await assert.rejects(vault.createAccount({
    username: 'bad username with spaces',
    displayName: 'Nombre',
    password: PASSWORD,
    baby: { name: 'Maya' },
  }), /No se pudo crear la cuenta\./);

  await assert.rejects(vault.createAccount({
    username: 'short-password',
    displayName: 'Nombre',
    password: 'muy-corta',
    baby: { name: 'Maya' },
  }), /No se pudo crear la cuenta\./);

  await assert.rejects(vault.createAccount({
    username: 'oversized-data',
    displayName: 'Nombre',
    password: PASSWORD,
    baby: { name: 'Maya', note: 'x'.repeat(600 * 1024) },
  }), /No se pudo crear la cuenta\./);

  assert.equal(storage.size, 0);
});

test('elimina solo la cuenta autenticada y cierra su sesion', async () => {
  const storage = new Map();
  const vault = createAccountVault({ storage, namespace: 'delete-test' });
  await vault.createAccount({
    username: 'familia-uno', displayName: 'Familia Uno', password: PASSWORD,
    baby: { name: 'Bebé' }, data: { tracker: { bebe: { nombre: 'Bebé' } } },
  });
  assert.equal(vault.deleteCurrentAccount(), true);
  assert.equal(vault.hasSession(), false);
  assert.deepEqual(vault.listAccounts(), []);
  await assert.rejects(() => vault.unlockAccount({ username: 'familia-uno', password: PASSWORD }));
});
