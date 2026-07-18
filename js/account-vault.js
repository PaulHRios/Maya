/*
 * AccountVault
 * Boveda local cifrada y aislada para cuentas del Baby Tracker.
 *
 * - Navegador: window.AccountVault.createAccountVault()
 * - Node/CommonJS: const { createAccountVault } = require('./account-vault.js')
 *
 * El modulo no sincroniza datos ni contiene usuarios, contrasenas o secretos
 * predefinidos. El indice publico solo contiene los usernames normalizados;
 * los datos del bebe siempre viven dentro del payload AES-GCM.
 */
(function accountVaultModule(root, factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AccountVault = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function accountVaultFactory() {
  'use strict';

  const FORMAT_VERSION = 1;
  const DEFAULT_NAMESPACE = 'babytracker.account-vault.v1';
  const KDF_ITERATIONS = 310000;
  const MIN_KDF_ITERATIONS = 310000;
  const MAX_KDF_ITERATIONS = 2000000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const AES_KEY_BITS = 256;
  const AES_TAG_BITS = 128;
  const MIN_PASSWORD_LENGTH = 12;
  const MAX_PASSWORD_BYTES = 1024;
  const MAX_USERNAME_LENGTH = 64;
  const MAX_DISPLAY_NAME_LENGTH = 100;
  const MAX_ACCOUNTS = 50;
  const MAX_VAULT_BYTES = 2 * 1024 * 1024;
  const MAX_RECORD_BYTES = 3 * 1024 * 1024;
  const MAX_INDEX_BYTES = 64 * 1024;
  const MAX_JSON_DEPTH = 32;
  const MAX_JSON_NODES = 50000;
  const MAX_OBJECT_KEYS = 5000;
  const MAX_ARRAY_ITEMS = 20000;
  const MAX_STRING_BYTES = 512 * 1024;
  const AAD_CONTEXT = 'babytracker-account-vault-aes-gcm-v1';

  const PRIVATE = new WeakMap();
  const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  class AccountVaultError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AccountVaultError';
    }
  }

  function publicError(action) {
    return new AccountVaultError(`No se pudo ${action}.`);
  }

  function getTextTools() {
    let Encoder = typeof TextEncoder !== 'undefined' ? TextEncoder : null;
    let Decoder = typeof TextDecoder !== 'undefined' ? TextDecoder : null;

    if ((!Encoder || !Decoder) && typeof require === 'function') {
      try {
        const util = require('node:util');
        Encoder = Encoder || util.TextEncoder;
        Decoder = Decoder || util.TextDecoder;
      } catch (_) {
        // Se valida abajo con un error generico de inicializacion.
      }
    }

    if (!Encoder || !Decoder) throw publicError('inicializar la boveda');
    return { encoder: new Encoder(), decoder: new Decoder('utf-8', { fatal: true }) };
  }

  function resolveCrypto(explicitCrypto) {
    if (explicitCrypto && explicitCrypto.subtle && explicitCrypto.getRandomValues) {
      return explicitCrypto;
    }

    if (typeof globalThis !== 'undefined' && globalThis.crypto
      && globalThis.crypto.subtle && globalThis.crypto.getRandomValues) {
      return globalThis.crypto;
    }

    if (typeof require === 'function') {
      try {
        const webcrypto = require('node:crypto').webcrypto;
        if (webcrypto && webcrypto.subtle && webcrypto.getRandomValues) return webcrypto;
      } catch (_) {
        // Se convierte en un error generico de inicializacion abajo.
      }
    }

    throw publicError('inicializar la boveda');
  }

  function adaptStorage(providedStorage) {
    let target = providedStorage;

    if (target === undefined) {
      try {
        target = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
      } catch (_) {
        target = null;
      }
    }

    if (target
      && typeof target.getItem === 'function'
      && typeof target.setItem === 'function'
      && typeof target.removeItem === 'function') {
      return {
        getItem(key) {
          const value = target.getItem(key);
          return value === null || value === undefined ? null : String(value);
        },
        setItem(key, value) { target.setItem(key, String(value)); },
        removeItem(key) { target.removeItem(key); },
      };
    }

    // Un Map se puede pasar directamente como adapter de pruebas.
    if (target
      && typeof target.get === 'function'
      && typeof target.set === 'function'
      && typeof target.delete === 'function') {
      return {
        getItem(key) {
          const value = target.get(key);
          return value === undefined ? null : String(value);
        },
        setItem(key, value) { target.set(key, String(value)); },
        removeItem(key) { target.delete(key); },
      };
    }

    throw publicError('inicializar la boveda');
  }

  function normalizeNamespace(namespace) {
    if (typeof namespace !== 'string') throw new TypeError('namespace');
    const value = namespace.trim();
    if (!value || value.length > 120 || !/^[a-zA-Z0-9._:-]+$/.test(value)) {
      throw new TypeError('namespace');
    }
    return value;
  }

  function normalizeUsername(username) {
    if (typeof username !== 'string' || username.length > 256) {
      throw new TypeError('username');
    }

    const value = username.trim().normalize('NFKC').toLowerCase();
    if (!value || value.length > MAX_USERNAME_LENGTH) throw new TypeError('username');

    // Letras/numeros Unicode; punto, guion y guion bajo solo en medio.
    const valid = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]{0,62}[\p{L}\p{N}])?$/u;
    if (!valid.test(value)) throw new TypeError('username');
    return value;
  }

  function validateDisplayName(displayName, encoder) {
    if (typeof displayName !== 'string') throw new TypeError('displayName');
    const value = displayName.trim();
    if (!value || value.length > MAX_DISPLAY_NAME_LENGTH
      || /[\u0000-\u001f\u007f]/.test(value)
      || encoder.encode(value).byteLength > 400) {
      throw new TypeError('displayName');
    }
    // Conserva mayusculas, acentos y forma visible; solo quita espacio exterior.
    return value;
  }

  function validatePasswordForCreate(password, encoder) {
    if (typeof password !== 'string'
      || password.length < MIN_PASSWORD_LENGTH
      || encoder.encode(password).byteLength > MAX_PASSWORD_BYTES) {
      throw new TypeError('password');
    }
    return password;
  }

  function validatePasswordForUnlock(password, encoder) {
    if (typeof password !== 'string' || !password.length
      || encoder.encode(password).byteLength > MAX_PASSWORD_BYTES) {
      throw new TypeError('password');
    }
    return password;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function normalizeJson(value, encoder, maxBytes) {
    let nodes = 0;

    function inspect(current, depth) {
      nodes += 1;
      if (nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) throw new TypeError('json');

      if (current === null || typeof current === 'boolean') return;
      if (typeof current === 'number') {
        if (!Number.isFinite(current)) throw new TypeError('json');
        return;
      }
      if (typeof current === 'string') {
        if (encoder.encode(current).byteLength > MAX_STRING_BYTES) throw new TypeError('json');
        return;
      }
      if (Array.isArray(current)) {
        if (current.length > MAX_ARRAY_ITEMS) throw new TypeError('json');
        current.forEach(item => inspect(item, depth + 1));
        return;
      }
      if (!isPlainObject(current)) throw new TypeError('json');

      const keys = Object.keys(current);
      if (keys.length > MAX_OBJECT_KEYS) throw new TypeError('json');
      for (const key of keys) {
        if (!key || key.length > 160 || DANGEROUS_KEYS.has(key)
          || /[\u0000-\u001f\u007f]/.test(key)) {
          throw new TypeError('json');
        }
        inspect(current[key], depth + 1);
      }
    }

    inspect(value, 0);
    const json = JSON.stringify(value);
    if (typeof json !== 'string' || encoder.encode(json).byteLength > maxBytes) {
      throw new TypeError('json');
    }
    return { value: JSON.parse(json), json };
  }

  function normalizeVaultData(data, encoder) {
    if (!isPlainObject(data) || !isPlainObject(data.baby)) throw new TypeError('vault');
    return normalizeJson(data, encoder, MAX_VAULT_BYTES);
  }

  function prepareInitialData(data, baby, encoder) {
    if (!isPlainObject(baby)) throw new TypeError('baby');
    const safeBaby = normalizeJson(baby, encoder, MAX_VAULT_BYTES).value;
    const safeData = data === undefined
      ? {}
      : normalizeJson(data, encoder, MAX_VAULT_BYTES).value;
    if (!isPlainObject(safeData)) throw new TypeError('data');

    const payload = Object.assign({}, safeData, { baby: safeBaby });
    if (!Object.prototype.hasOwnProperty.call(payload, 'schemaVersion')) {
      payload.schemaVersion = 1;
    }
    return normalizeVaultData(payload, encoder);
  }

  function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined' && Buffer && typeof Buffer.from === 'function') {
      return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
    }
    if (typeof btoa !== 'function') throw new TypeError('base64');

    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, offset + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function base64ToBytes(value, maxBytes) {
    if (typeof value !== 'string' || value.length % 4 !== 0
      || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
      || value.length > Math.ceil(maxBytes / 3) * 4 + 4) {
      throw new TypeError('base64');
    }

    let bytes;
    if (typeof Buffer !== 'undefined' && Buffer && typeof Buffer.from === 'function') {
      const decoded = Buffer.from(value, 'base64');
      bytes = new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    } else {
      if (typeof atob !== 'function') throw new TypeError('base64');
      const binary = atob(value);
      bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    }

    if (bytes.byteLength > maxBytes) throw new TypeError('base64');
    return new Uint8Array(bytes);
  }

  function accountStorageKey(state, username) {
    const encoded = bytesToBase64(state.encoder.encode(username))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `${state.namespace}:account:${encoded}`;
  }

  function randomBytes(state, length) {
    const bytes = new Uint8Array(length);
    state.crypto.getRandomValues(bytes);
    return bytes;
  }

  async function deriveKey(state, password, salt, iterations) {
    const material = await state.crypto.subtle.importKey(
      'raw',
      state.encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );
    return state.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: AES_KEY_BITS },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  function aadForRecord(state, record) {
    const aad = JSON.stringify([
      AAD_CONTEXT,
      record.version,
      record.username,
      record.displayName,
      record.createdAt,
      record.updatedAt,
      record.revision,
      record.kdf.name,
      record.kdf.hash,
      record.kdf.iterations,
      record.kdf.salt,
      record.cipher.name,
      record.cipher.tagLength,
    ]);
    return state.encoder.encode(aad);
  }

  async function encryptPayload(state, key, record, normalizedPayload) {
    const iv = randomBytes(state, IV_BYTES);
    const ciphertext = await state.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadForRecord(state, record),
        tagLength: AES_TAG_BITS,
      },
      key,
      state.encoder.encode(normalizedPayload.json),
    );
    return {
      name: 'AES-GCM',
      tagLength: AES_TAG_BITS,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  async function decryptPayload(state, key, parsed) {
    const plaintext = await state.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: parsed.iv,
        additionalData: aadForRecord(state, parsed.record),
        tagLength: AES_TAG_BITS,
      },
      key,
      parsed.ciphertext,
    );
    if (plaintext.byteLength > MAX_VAULT_BYTES) throw new TypeError('vault');

    const decoded = state.decoder.decode(plaintext);
    const data = JSON.parse(decoded);
    return normalizeVaultData(data, state.encoder).value;
  }

  function parseIndex(state) {
    const raw = state.storage.getItem(state.indexKey);
    if (raw === null) return { version: FORMAT_VERSION, accounts: [] };
    if (state.encoder.encode(raw).byteLength > MAX_INDEX_BYTES) throw new TypeError('index');

    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || parsed.version !== FORMAT_VERSION
      || !Array.isArray(parsed.accounts) || parsed.accounts.length > MAX_ACCOUNTS) {
      throw new TypeError('index');
    }

    const seen = new Set();
    const accounts = parsed.accounts.map(username => {
      const normalized = normalizeUsername(username);
      if (normalized !== username || seen.has(normalized)) throw new TypeError('index');
      seen.add(normalized);
      return normalized;
    });
    return { version: FORMAT_VERSION, accounts };
  }

  function writeIndex(state, index) {
    const raw = JSON.stringify(index);
    if (state.encoder.encode(raw).byteLength > MAX_INDEX_BYTES) throw new TypeError('index');
    state.storage.setItem(state.indexKey, raw);
  }

  function validIsoDate(value) {
    return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
  }

  function parseRecord(state, raw, expectedUsername) {
    if (typeof raw !== 'string' || state.encoder.encode(raw).byteLength > MAX_RECORD_BYTES) {
      throw new TypeError('record');
    }

    const record = JSON.parse(raw);
    if (!isPlainObject(record) || record.version !== FORMAT_VERSION
      || normalizeUsername(record.username) !== record.username
      || (expectedUsername && record.username !== expectedUsername)
      || validateDisplayName(record.displayName, state.encoder) !== record.displayName
      || !validIsoDate(record.createdAt) || !validIsoDate(record.updatedAt)
      || !Number.isSafeInteger(record.revision) || record.revision < 1
      || !isPlainObject(record.kdf)
      || record.kdf.name !== 'PBKDF2' || record.kdf.hash !== 'SHA-256'
      || !Number.isInteger(record.kdf.iterations)
      || record.kdf.iterations < MIN_KDF_ITERATIONS
      || record.kdf.iterations > MAX_KDF_ITERATIONS
      || !isPlainObject(record.cipher)
      || record.cipher.name !== 'AES-GCM'
      || record.cipher.tagLength !== AES_TAG_BITS) {
      throw new TypeError('record');
    }

    const salt = base64ToBytes(record.kdf.salt, SALT_BYTES);
    const iv = base64ToBytes(record.cipher.iv, IV_BYTES);
    const ciphertext = base64ToBytes(record.cipher.ciphertext, MAX_VAULT_BYTES + 64);
    if (salt.byteLength !== SALT_BYTES || iv.byteLength !== IV_BYTES
      || ciphertext.byteLength < AES_TAG_BITS / 8) {
      throw new TypeError('record');
    }

    return { record, salt, iv, ciphertext };
  }

  function publicAccount(record) {
    return Object.freeze({
      username: record.username,
      displayName: record.displayName,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      revision: record.revision,
    });
  }

  function cloneVaultData(data, encoder) {
    return normalizeVaultData(data, encoder).value;
  }

  function stateFor(instance) {
    const state = PRIVATE.get(instance);
    if (!state) throw publicError('usar la boveda');
    return state;
  }

  class AccountVault {
    constructor(options) {
      const settings = options || {};
      try {
        const text = getTextTools();
        const iterations = settings.iterations === undefined
          ? KDF_ITERATIONS
          : Number(settings.iterations);
        if (!Number.isInteger(iterations)
          || iterations < MIN_KDF_ITERATIONS
          || iterations > MAX_KDF_ITERATIONS) {
          throw new TypeError('iterations');
        }

        const namespace = normalizeNamespace(settings.namespace || DEFAULT_NAMESPACE);
        PRIVATE.set(this, {
          crypto: resolveCrypto(settings.crypto),
          storage: adaptStorage(settings.storage),
          encoder: text.encoder,
          decoder: text.decoder,
          namespace,
          indexKey: `${namespace}:accounts`,
          iterations,
          session: null,
        });
      } catch (_) {
        throw publicError('inicializar la boveda');
      }
    }

    listAccounts() {
      const state = stateFor(this);
      try {
        const index = parseIndex(state);
        return index.accounts.map(username => {
          const raw = state.storage.getItem(accountStorageKey(state, username));
          if (raw === null) throw new TypeError('record');
          return publicAccount(parseRecord(state, raw, username).record);
        });
      } catch (_) {
        throw publicError('listar las cuentas');
      }
    }

    list() {
      return this.listAccounts();
    }

    async createAccount(options) {
      const state = stateFor(this);
      try {
        if (!isPlainObject(options)) throw new TypeError('options');
        const username = normalizeUsername(options.username);
        const displayName = validateDisplayName(options.displayName, state.encoder);
        const password = validatePasswordForCreate(options.password, state.encoder);
        const normalizedPayload = prepareInitialData(options.data, options.baby, state.encoder);
        const index = parseIndex(state);
        const recordKey = accountStorageKey(state, username);

        if (index.accounts.includes(username) || index.accounts.length >= MAX_ACCOUNTS
          || state.storage.getItem(recordKey) !== null) {
          throw new TypeError('account');
        }

        const salt = randomBytes(state, SALT_BYTES);
        const key = await deriveKey(state, password, salt, state.iterations);
        const timestamp = new Date().toISOString();
        const record = {
          version: FORMAT_VERSION,
          username,
          displayName,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          kdf: {
            name: 'PBKDF2',
            hash: 'SHA-256',
            iterations: state.iterations,
            salt: bytesToBase64(salt),
          },
          cipher: { name: 'AES-GCM', tagLength: AES_TAG_BITS },
        };
        record.cipher = await encryptPayload(state, key, record, normalizedPayload);
        const rawRecord = JSON.stringify(record);
        if (state.encoder.encode(rawRecord).byteLength > MAX_RECORD_BYTES) {
          throw new TypeError('record');
        }

        state.storage.setItem(recordKey, rawRecord);
        try {
          writeIndex(state, {
            version: FORMAT_VERSION,
            accounts: [...index.accounts, username],
          });
        } catch (error) {
          try { state.storage.removeItem(recordKey); } catch (_) { /* best effort */ }
          throw error;
        }

        state.session = {
          username,
          displayName,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          recordKey,
          key,
        };

        return {
          account: publicAccount(record),
          data: cloneVaultData(normalizedPayload.value, state.encoder),
        };
      } catch (_) {
        throw publicError('crear la cuenta');
      }
    }

    create(options) {
      return this.createAccount(options);
    }

    async unlockAccount(options) {
      const state = stateFor(this);
      state.session = null;

      try {
        if (!isPlainObject(options)) throw new TypeError('options');
        const username = normalizeUsername(options.username);
        const password = validatePasswordForUnlock(options.password, state.encoder);
        const index = parseIndex(state);
        const recordKey = accountStorageKey(state, username);
        const raw = index.accounts.includes(username) ? state.storage.getItem(recordKey) : null;

        if (raw === null) {
          // Reduce la diferencia temporal entre una cuenta inexistente y un password malo.
          await deriveKey(
            state,
            password,
            randomBytes(state, SALT_BYTES),
            state.iterations,
          );
          throw new TypeError('unlock');
        }

        const parsed = parseRecord(state, raw, username);
        const key = await deriveKey(
          state,
          password,
          parsed.salt,
          parsed.record.kdf.iterations,
        );
        const data = await decryptPayload(state, key, parsed);

        state.session = {
          username,
          displayName: parsed.record.displayName,
          createdAt: parsed.record.createdAt,
          updatedAt: parsed.record.updatedAt,
          revision: parsed.record.revision,
          recordKey,
          key,
        };

        return {
          account: publicAccount(parsed.record),
          data: cloneVaultData(data, state.encoder),
        };
      } catch (_) {
        state.session = null;
        throw publicError('desbloquear la cuenta');
      }
    }

    unlock(options) {
      return this.unlockAccount(options);
    }

    async loadVault() {
      const state = stateFor(this);
      try {
        if (!state.session) throw new TypeError('session');
        const raw = state.storage.getItem(state.session.recordKey);
        if (raw === null) throw new TypeError('record');
        const parsed = parseRecord(state, raw, state.session.username);
        const data = await decryptPayload(state, state.session.key, parsed);

        state.session.displayName = parsed.record.displayName;
        state.session.createdAt = parsed.record.createdAt;
        state.session.updatedAt = parsed.record.updatedAt;
        state.session.revision = parsed.record.revision;
        return cloneVaultData(data, state.encoder);
      } catch (_) {
        throw publicError('cargar la boveda');
      }
    }

    load() {
      return this.loadVault();
    }

    async saveVault(data) {
      const state = stateFor(this);
      try {
        if (!state.session) throw new TypeError('session');
        const normalizedPayload = normalizeVaultData(data, state.encoder);
        const oldRaw = state.storage.getItem(state.session.recordKey);
        if (oldRaw === null) throw new TypeError('record');
        const parsed = parseRecord(state, oldRaw, state.session.username);

        // Evita pisar silenciosamente un cambio realizado por otra instancia/pestana.
        if (parsed.record.revision !== state.session.revision) throw new TypeError('conflict');
        await decryptPayload(state, state.session.key, parsed);

        const nextRecord = {
          version: parsed.record.version,
          username: parsed.record.username,
          displayName: parsed.record.displayName,
          createdAt: parsed.record.createdAt,
          updatedAt: new Date().toISOString(),
          revision: parsed.record.revision + 1,
          kdf: Object.assign({}, parsed.record.kdf),
          cipher: { name: 'AES-GCM', tagLength: AES_TAG_BITS },
        };
        nextRecord.cipher = await encryptPayload(
          state,
          state.session.key,
          nextRecord,
          normalizedPayload,
        );
        const nextRaw = JSON.stringify(nextRecord);
        if (state.encoder.encode(nextRaw).byteLength > MAX_RECORD_BYTES) {
          throw new TypeError('record');
        }

        state.storage.setItem(state.session.recordKey, nextRaw);
        state.session.updatedAt = nextRecord.updatedAt;
        state.session.revision = nextRecord.revision;
        return cloneVaultData(normalizedPayload.value, state.encoder);
      } catch (_) {
        throw publicError('guardar la boveda');
      }
    }

    save(data) {
      return this.saveVault(data);
    }

    deleteCurrentAccount() {
      const state = stateFor(this);
      try {
        if (!state.session) throw new TypeError('session');
        const username = state.session.username;
        const recordKey = state.session.recordKey;
        const rawRecord = state.storage.getItem(recordKey);
        if (rawRecord === null) throw new TypeError('record');
        parseRecord(state, rawRecord, username);
        const index = parseIndex(state);
        if (!index.accounts.includes(username)) throw new TypeError('index');

        state.storage.removeItem(recordKey);
        try {
          writeIndex(state, {
            version: FORMAT_VERSION,
            accounts: index.accounts.filter(item => item !== username),
          });
        } catch (error) {
          // Restore the encrypted record if updating the index fails.
          state.storage.setItem(recordKey, rawRecord);
          throw error;
        }
        state.session = null;
        return true;
      } catch (_) {
        throw publicError('eliminar la cuenta');
      }
    }

    currentAccount() {
      const state = stateFor(this);
      if (!state.session) return null;
      return Object.freeze({
        username: state.session.username,
        displayName: state.session.displayName,
        createdAt: state.session.createdAt,
        updatedAt: state.session.updatedAt,
        revision: state.session.revision,
      });
    }

    hasSession() {
      return !!stateFor(this).session;
    }

    lock() {
      stateFor(this).session = null;
    }

    closeSession() {
      this.lock();
    }

    logout() {
      this.lock();
    }
  }

  function createAccountVault(options) {
    return new AccountVault(options);
  }

  return Object.freeze({
    AccountVault,
    AccountVaultError,
    createAccountVault,
    normalizeUsername,
    constants: Object.freeze({
      FORMAT_VERSION,
      DEFAULT_NAMESPACE,
      KDF_ITERATIONS,
      MIN_KDF_ITERATIONS,
      SALT_BYTES,
      IV_BYTES,
      AES_KEY_BITS,
      AES_TAG_BITS,
      MIN_PASSWORD_LENGTH,
      MAX_PASSWORD_BYTES,
      MAX_USERNAME_LENGTH,
      MAX_DISPLAY_NAME_LENGTH,
      MAX_ACCOUNTS,
      MAX_VAULT_BYTES,
    }),
  });
}));
