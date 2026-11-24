const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { TextEncoder, TextDecoder } = require('node:util');
const source = readFileSync(require.resolve('../js/store.js'), 'utf8');
const CAP = 'data:image/jpeg;base64,ABC=';
const THUMB = 'data:image/jpeg;base64,DEF=';
function fixture() {
  const mem = new Map(Object.entries({
    'maya.session.v1':'ok',
    'maya.sesion-activa.v1':'{"familia":"test","quien":"papa","email":"fake@example.invalid"}',
    'maya.bebe-activo.v1':'fake-baby',
    'maya.config.v1.test':'{"owner":"mock","repo":"mocktest","branch":"x","token":"synthetic","autoSync":false}',
  }));
  const localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k,v) => mem.set(k,String(v)), removeItem: k => mem.delete(k) };
  const requests = [], files = new Map();
  const errors = new Set();
  const src = name => 'fotos/' + name + '.jpg';
  const mini = name => 'fotos/miniaturas/' + name + '.jpg';
  const response = (status, body) => ({ status, ok:status>=200&&status<300, json:async()=>body });
  async function fetch(url, opts = {}) {
    assert.ok(url.startsWith('https://api.github.com/repos/mock/mocktest/contents/'), 'only synthetic endpoints');
    const path = new URL(url).pathname.split('/contents/')[1], method=opts.method || 'GET';
    requests.push({path,method,opts});
    if (errors.delete(method+':'+path)) return response(503,{});
    if (method === 'PUT') {
      const request = JSON.parse(opts.body);
      files.set(path,{sha:'stub',content:request.content});
      return response(201,{sha:'stub'});
    }
    if (method === 'DELETE') { files.delete(path); return response(200,{}); }
    return files.has(path) ? response(200,files.get(path)) : response(404,{});
  }
  const thumbCache = new Map(), discarded = [];
  const ctx = vm.createContext({
    console, localStorage, fetch, TextEncoder, TextDecoder, setTimeout, clearTimeout,
    atob, btoa, AbortController, Date, URL,
    MayaPhotoThumbs: {
      valid: s => /^data:image\/jpeg;base64,/.test(s || ''),
      resize: async s => s ? THUMB : null,
      async get({scope, file, load, stillCurrent}) {
        const k = JSON.stringify([scope,file]);
        if (thumbCache.has(k)) return thumbCache.get(k);
        const result=await load();
        if (!stillCurrent()) return null;
        if (result) thumbCache.set(k,result);
        return result;
      },
      async discard(scope,file) { const k=JSON.stringify([scope,file]); discarded.push(k); thumbCache.delete(k); },
    },
  });
  vm.runInContext(source + '\nglobalThis.Store=Store;',ctx);
  ctx.Store.loadLocal();
  return { Store:ctx.Store, files, errors, requests, src, mini, discarded };
}
const stub = (id, opts) => ({ id, fecha:'2026-11-22T21:00:00.000Z', archivo:id+'.jpg', ...opts });
test('Remote preview is fetched without the original; legacy thumbnail is generated and reused', async () => {
  const { Store, files, requests, src, mini } = fixture();
  files.set(mini('new'), { content:'DEF=', sha:'test' });
  files.set(src('new'), { content:'ABC=', sha:'test' });
  files.set(src('old'), { content:'ABC=', sha:'test' });
  assert.equal(await Store.fetchThumb(stub('new', {miniatura:true})),THUMB);
  assert.deepEqual(requests.map(r=>r.path),[mini('new')]);
  assert.equal(await Store.fetchPhoto(stub('new'), {retain:false}),CAP);
  assert.equal(await Store.fetchThumb(stub('old')),THUMB);
  assert.equal(await Store.fetchThumb(stub('old')),THUMB);
  assert.equal(requests.filter(r=>r.path===src('old')).length,1);
  assert.ok(!requests.some(r=>r.method==='PUT'));
});
test('Failed sidecar uploads retry on next sync; private thumbnail bytes never go in JSON metadata', async () => {
  const {Store, files, errors, requests, src, mini} = fixture();
  Store.add('fotos', stub('new',{ miniatura:true, miniaturaPendiente:THUMB, dataUrl:CAP, sincronizada:false }));
  errors.add('PUT:'+mini('new'));
  await Store.syncNow();
  assert.ok(files.has(src('new')));
  assert.ok(!files.has(mini('new')));
  assert.equal(Store.data.fotos[0].miniaturaPendiente,THUMB);
  await Store.syncNow();
  assert.equal(files.get(mini('new')).content,'DEF=');
  assert.equal(requests.filter(r=>r.method==='PUT' && r.path===mini('new')).length,2);
  assert.equal(requests.filter(r=>r.method==='PUT' && r.path===src('new')).length,1);
  const json=JSON.parse(Buffer.from(files.get('datos/bebe-fake-baby.json').content,'base64').toString());
  assert.equal(json.fotos[0].miniatura,true);
  assert.equal(json.fotos[0].miniaturaPendiente,undefined);
  assert.equal(json.fotos[0].dataUrl,undefined);
  Store.remove('fotos','new');
  await Store.syncNow();
  assert.ok(!files.has(mini('new')));
  assert.ok(files.has(src('new')));
  assert.equal(Store.data.fotos.length,0);
});
test('Missing sidecar remains usable via original fallback; demo cannot request private photo URLs', async () => {
  const {Store, files, requests, src} = fixture();
  files.set(src('new'),{ content:'ABC=' });
  assert.equal(await Store.fetchThumb(stub('new',{miniatura:true})),THUMB);
  const n=requests.length;
  Store.activarDemo({version:1,fotos:[]});
  assert.equal(await Store.fetchThumb(stub('new',{miniatura:true})),null);
  assert.equal(requests.length,n);
});
