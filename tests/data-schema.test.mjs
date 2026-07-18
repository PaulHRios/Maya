import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const schema = require('../js/data-schema.js');

test('normaliza un respaldo y elimina propiedades desconocidas', () => {
  const value = schema.importData({
    bebe: { nombre: '<Maya>', nacimiento: '2026-01-02', secreto: 'no' },
    tomas: [{ id: 'feed-1', tipo: 'materno', inicio: '2026-07-17T10:00:00Z', notas: '<img onerror=x>', token: 'secret' }],
  });
  assert.equal(value.bebe.nombre, '<Maya>');
  assert.equal('secreto' in value.bebe, false);
  assert.equal('token' in value.tomas[0], false);
  assert.equal(value.tomas[0].notas, '<img onerror=x>');
});

test('rechaza identificadores peligrosos, URLs no HTTPS y archivos irreconocibles', () => {
  const value = schema.normalizeData({
    bebe: { nombre: 'Bebé' },
    condiciones: [{ id: 'x\" onclick=bad', nombre: 'x', info: { enlaces: [{ texto: 'x', url: 'javascript:alert(1)' }] } }],
  });
  assert.equal(value.condiciones.length, 0);
  assert.throws(() => schema.importData({ random: true }));
});
