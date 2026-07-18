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

test('preserva metadatos permitidos de condición y elimina extras desconocidos', () => {
  const value = schema.normalizeData({
    bebe: { nombre: 'Bebé Demo' },
    condiciones: [{
      id: 'condition-demo-1',
      nombre: 'Observación sintética',
      info: {
        resumen: 'Resumen sintético',
        cuidados: ['Nota sintética'],
        enlaces: [
          { texto: 'Fuente segura', url: 'https://example.test/guia?q=demo' },
          { texto: 'Fuente insegura', url: 'javascript:alert(1)' },
        ],
        consultado: '2026-07-17T12:30:00-06:00',
        extraWiki: `Texto sintético ${'x'.repeat(5000)}`,
        tipo: 'campo-no-permitido',
        token: 'secreto-sintético',
      },
    }],
  });

  const info = value.condiciones[0].info;
  assert.equal(info.consultado, '2026-07-17T18:30:00.000Z');
  assert.equal(info.extraWiki.length, 4000);
  assert.equal(info.enlaces.length, 1);
  assert.equal(info.enlaces[0].url, 'https://example.test/guia?q=demo');
  assert.equal('tipo' in info, false);
  assert.equal('token' in info, false);
});

test('normaliza consultado inválido y conserva extraWiki nulo', () => {
  const value = schema.normalizeData({
    bebe: { nombre: 'Bebé Demo' },
    condiciones: [{
      id: 'condition-demo-2',
      nombre: 'Otra observación',
      info: { consultado: 'no-es-fecha', extraWiki: null },
    }],
  });

  assert.equal(value.condiciones[0].info.consultado, '');
  assert.equal(value.condiciones[0].info.extraWiki, null);
});

test('rechaza formatos no ISO y valores no textuales en los metadatos opcionales', () => {
  const value = schema.normalizeData({
    bebe: { nombre: 'Bebé Demo' },
    condiciones: [{
      id: 'condition-demo-3',
      nombre: 'Observación',
      info: { consultado: '17 de julio de 2026', extraWiki: { texto: 'no' } },
    }],
  });

  assert.equal(value.condiciones[0].info.consultado, '');
  assert.equal(value.condiciones[0].info.extraWiki, null);
});
