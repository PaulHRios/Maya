const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
test('shell updates revalidate, private requests bypass, offline assets match exact version',async()=>{
  const events={}, origin='https://example.invalid', scope=origin+'/Maya/';
  const called=[], offline={cached:true};
  const ctx=vm.createContext({URL,Response,importScripts:()=>{},
    self:{location:{origin},registration:{scope},addEventListener:(name,cb)=>events[name]=cb},
    fetch:async(req,opts)=>{called.push(opts.cache);throw Error('offline')},
    caches:{open:async key=>{assert.equal(key,'maya-v25');return {match:async r=>r.url===scope+'js/app.js?v=25'?offline:typeof r==='string'?r:undefined}}}
  });
  vm.runInContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),ctx);
  const result=(url,mode)=>{let promise;events.fetch({request:{url,method:'GET',mode},respondWith:p=>promise=p});return promise};
  assert.equal(await result('https://api.github.com/private'),undefined);
  assert.equal(await result(origin+'/other-app.js'),undefined);
  assert.equal(await result(scope+'js/app.js?v=25'),offline);
  assert.equal((await result(scope+'js/app.js?v=21')).type,'error');
  assert.equal(await result(scope+'?demo=1','navigate'),'./index.html');
  assert.equal(await result(scope+'demo.html?lang=es','navigate'),'./demo.html');
  assert.deepEqual(called,Array(4).fill('no-cache'));
});
