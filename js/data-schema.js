/* Strict, dependency-free normalizer for imported and persisted tracker data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MayaDataSchema = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 2;
  const MAX_ITEMS = 50000;
  const ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

  const emptyData = (babyName = '') => ({
    version: VERSION,
    bebe: { nombre: text(babyName, 80), nacimiento: '' },
    tomas: [],
    suenos: [],
    panales: [],
    condiciones: [],
    intervenciones: [],
    medicamentos: [],
    crecimiento: [],
    fotos: [],
    actividades: [],
    banco: [],
    borrados: [],
  });

  function text(value, max = 500) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
  }

  function id(value) {
    const cleaned = text(value, 128);
    return ID_RE.test(cleaned) ? cleaned : '';
  }

  function date(value, dateOnly = false) {
    const cleaned = text(value, 40);
    if (!cleaned) return '';
    if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const parsed = new Date(cleaned);
    return Number.isFinite(parsed.getTime()) ? cleaned : '';
  }

  function time(value) {
    const cleaned = text(value, 8);
    return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(cleaned) ? cleaned : '';
  }

  function number(value, min, max, allowNull = false) {
    if ((value === '' || value === null || value === undefined) && allowNull) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return allowNull ? null : 0;
    return Math.min(max, Math.max(min, parsed));
  }

  function enumValue(value, allowed, fallback = '') {
    const cleaned = text(value, 40).toLowerCase();
    return allowed.includes(cleaned) ? cleaned : fallback;
  }

  function safeUrl(value) {
    try {
      const url = new URL(text(value, 1000));
      return url.protocol === 'https:' ? url.toString() : '';
    } catch {
      return '';
    }
  }

  function imageDataUrl(value) {
    const raw = typeof value === 'string' ? value : '';
    if (raw.length > 6_500_000) return '';
    return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(raw) ? raw : '';
  }

  function base(item) {
    return { id: id(item.id), updatedAt: date(item.updatedAt) };
  }

  const normalizers = {
    tomas(item) {
      return {
        ...base(item),
        tipo: enumValue(item.tipo, ['materno', 'donante', 'formula'], 'materno'),
        ml: number(item.ml, 0, 2000, true),
        lado: enumValue(item.lado, ['izq', 'der'], ''),
        duracionSeg: number(item.duracionSeg, 0, 24 * 3600, true),
        inicio: date(item.inicio),
        notas: text(item.notas, 4000),
      };
    },
    suenos(item) {
      const bitacora = Array.isArray(item.bitacora) ? item.bitacora.slice(0, 1000).map(entry => ({
        hora: date(entry && entry.hora),
        autor: enumValue(entry && entry.autor, ['mama', 'papa', 'otro'], ''),
        texto: text(entry && entry.texto, 2000),
      })).filter(entry => entry.hora || entry.texto) : [];
      return {
        ...base(item),
        inicio: date(item.inicio),
        fin: date(item.fin),
        tipo: enumValue(item.tipo, ['sueno', 'vigilia'], 'sueno'),
        quien: enumValue(item.quien, ['mama', 'papa', 'otro'], ''),
        notas: text(item.notas, 4000),
        bitacora,
      };
    },
    panales(item) {
      return {
        ...base(item),
        tipo: enumValue(item.tipo, ['pipi', 'popo', 'mixto'], 'pipi'),
        hora: date(item.hora),
        color: text(item.color, 40),
        consistencia: text(item.consistencia, 60),
        fotoId: id(item.fotoId),
        notas: text(item.notas, 4000),
      };
    },
    condiciones(item) {
      const mediciones = Array.isArray(item.mediciones) ? item.mediciones.slice(0, 10000).map(measure => ({
        id: id(measure && measure.id),
        valor: (measure && (measure.valor === '' || measure.valor === null || measure.valor === undefined))
          ? null : number(measure && measure.valor, -1000000, 1000000, true),
        fecha: date(measure && measure.fecha),
        nota: text(measure && measure.nota, 2000),
      })).filter(measure => measure.id && measure.fecha) : [];
      let info = null;
      if (item.info && typeof item.info === 'object') {
        info = {
          resumen: text(item.info.resumen, 3000),
          cuidados: Array.isArray(item.info.cuidados) ? item.info.cuidados.slice(0, 30).map(x => text(x, 500)).filter(Boolean) : [],
          enlaces: Array.isArray(item.info.enlaces) ? item.info.enlaces.slice(0, 20).map(link => ({
            texto: text(link && link.texto, 150),
            url: safeUrl(link && link.url),
          })).filter(link => link.url) : [],
        };
      }
      return { ...base(item), nombre: text(item.nombre, 120), unidad: text(item.unidad, 40), mediciones, info };
    },
    intervenciones(item) {
      return { ...base(item), titulo: text(item.titulo, 160), categoria: text(item.categoria, 80), fecha: date(item.fecha), notas: text(item.notas, 4000) };
    },
    medicamentos(item) {
      return {
        ...base(item), nombre: text(item.nombre, 160), dosis: text(item.dosis, 160), frecuencia: text(item.frecuencia, 160),
        inicio: date(item.inicio), fin: date(item.fin), notas: text(item.notas, 4000), activo: item.activo !== false,
      };
    },
    crecimiento(item) {
      return {
        ...base(item), fecha: date(item.fecha), pesoKg: number(item.pesoKg, 0, 300, true),
        tallaCm: number(item.tallaCm, 0, 300, true), perimetroCm: number(item.perimetroCm, 0, 200, true),
      };
    },
    fotos(item) {
      return {
        ...base(item), fecha: date(item.fecha), titulo: text(item.titulo, 200), archivo: text(item.archivo, 240).replace(/[^A-Za-z0-9._-]/g, ''),
        categoria: text(item.categoria, 60), semana: number(item.semana, 0, 1000, true), sincronizada: !!item.sincronizada,
        dataUrl: imageDataUrl(item.dataUrl),
      };
    },
    actividades(item) {
      return {
        ...base(item), fecha: date(item.fecha, true), tarea: text(item.tarea, 120), titulo: text(item.titulo, 200),
        hecha: !!item.hecha, duracionSeg: number(item.duracionSeg, 0, 24 * 3600, true),
      };
    },
    banco(item) {
      return {
        ...base(item), tipo: text(item.tipo, 40), lugar: text(item.lugar, 40), ml: number(item.ml, 0, 10000, true),
        fecha: date(item.fecha), notas: text(item.notas, 4000), tomaId: id(item.tomaId), modo: text(item.modo, 60),
        duracionSeg: number(item.duracionSeg, 0, 24 * 3600, true),
      };
    },
  };

  function normalizeCollection(input, name) {
    if (!Array.isArray(input)) return [];
    const seen = new Set();
    return input.slice(0, MAX_ITEMS).map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const normalized = normalizers[name](item);
      if (!normalized.id || seen.has(normalized.id)) return null;
      seen.add(normalized.id);
      return normalized;
    }).filter(Boolean);
  }

  function normalizeData(input, options = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Formato de datos no válido');
    const output = emptyData(options.defaultBabyName || '');
    const baby = input.bebe && typeof input.bebe === 'object' ? input.bebe : {};
    output.bebe = {
      nombre: text(baby.nombre || options.defaultBabyName, 80),
      nacimiento: date(baby.nacimiento, true),
      hora: time(baby.hora),
      mama: text(baby.mama, 80),
      papa: text(baby.papa, 80),
      actualizado: date(baby.actualizado),
    };
    Object.keys(normalizers).forEach(name => { output[name] = normalizeCollection(input[name], name); });
    output.borrados = Array.isArray(input.borrados) ? input.borrados.slice(-5000).map(tomb => ({
      col: Object.prototype.hasOwnProperty.call(normalizers, tomb && tomb.col) ? tomb.col : '',
      id: id(tomb && tomb.id),
      at: date(tomb && tomb.at),
    })).filter(tomb => tomb.col && tomb.id && tomb.at) : [];
    return output;
  }

  function importData(input) {
    const normalized = normalizeData(input);
    const hasKnownShape = input.bebe || Object.keys(normalizers).some(name => Array.isArray(input[name]));
    if (!hasKnownShape) throw new TypeError('El archivo no contiene datos reconocibles');
    return normalized;
  }

  return Object.freeze({ VERSION, MAX_ITEMS, emptyData, normalizeData, importData, text, id, safeUrl });
});
