const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const R=require('../js/reminders.js');
const client=readFileSync(require.resolve('../js/push-client.js'),'utf8');
const sw=readFileSync(require.resolve('../sw.js'),'utf8');
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Opaque schedules, cancellation while request is pending, and at-most-once local display', async()=>{
  const local=new Map(), requests=[], shown=[], listeners={};
  let state=null, release, handle=Promise.resolve();
  const storage={change(fn){
    const task=handle.then(()=>{
      const result=fn(state);
      if(result?.write!==undefined)state=result.write;
      return result?.value;
    });
    handle=task.catch(()=>{});
    return task;
  }};
  const sub={toJSON:()=>({endpoint:'https://push.example.invalid/a',keys:{auth:'test'}}),unsubscribe:async()=>true};
  const self={location:{origin:'https://example.invalid'},registration:{scope:'https://example.invalid/',
    showNotification:async (...args)=>shown.push(args)},addEventListener:(n,cb)=>listeners[n]=cb};
  const ctx=vm.createContext({
    AbortController,Date,Promise,setTimeout,clearTimeout,Uint8Array,atob,btoa,URL,
    MAYA_PUSH_BASE:'https://scheduler.example.invalid',MayaPushStorage:storage,
    MayaReminders:R,importScripts:()=>{},self,crypto:webcrypto,
    window:{Notification:{},PushManager:{},indexedDB:{}},Notification:{permission:'granted'},
    navigator:{userAgent:'Chrome',serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>sub}})}},
    localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
    fetch:async (url,options)=>{
      assert.equal(new URL(url).host,'scheduler.example.invalid');
      requests.push({url,options});
      if(url.endsWith('public-key'))return response(200,{publicKey:Buffer.alloc(65).toString('base64url')});
      if(url.endsWith('/devices'))return response(201,{deviceId:'id123',token:'issued-secret'});
      if(url.endsWith('/jobs')&&requests.filter(r=>r.url.endsWith('/jobs')).length===1)
        return new Promise(resolve=>{release=()=>resolve(response(200,{}));});
      return response(200,{});
    },
  });
  vm.runInContext(client+'\nglobalThis.api=MayaPush;',ctx);
  vm.runInContext(sw,ctx);
  await ctx.api.prepare();
  await ctx.api.turnOn('owner','fixture-enroll');
  assert.equal(requests.find(r=>r.url.endsWith('/devices')).options.headers.Authorization,'Bearer fixture-enroll');
  assert.ok(![...local.values()].some(v=>v.includes('fixture-enroll')));
  const now=Date.now(), job={id:'feed:123',type:'feed',since:now-4*3600000,dueAt:now,at:now,expires:now+60000,deadline:now+3600000};
  const opts={owner:'owner',scope:'scope',plan:[job],options:{quiet:false},name:'Fixture Name',lang:'es'};
  const jobReq=()=>requests.filter(r=>r.url.endsWith('/jobs')).map(r=>JSON.parse(r.options.body));
  ctx.api.setDesired(opts);
  for(let i=0;i<20&&!release;i++)await tick();
  assert.equal(typeof release,'function');
  const first=jobReq()[0].jobs[0];
  assert.deepEqual(Object.keys(first).sort(),['at','expiresAt','id']);
  assert.match(first.id,/^[A-Za-z0-9_-]{22}$/);
  assert.doesNotMatch(JSON.stringify(first),/Fixture|feed|scope|owner/);
  ctx.api.setDesired({...opts,plan:[]});
  await handle;
  const push=id=>new Promise(resolve=>listeners.push({data:{json:()=>({id})},waitUntil:p=>p.then(resolve)}));
  await push(first.id);
  assert.equal(shown.length,0);
  release();
  for(let i=0;i<20&&jobReq().length<2;i++)await tick();
  assert.deepEqual(jobReq()[1],{jobs:[]});
  ctx.api.setDesired({...opts,plan:[{...job,id:'feed:next'}]});
  for(let i=0;i<20&&jobReq().length<3;i++)await tick();
  const fresh=jobReq()[2].jobs[0];
  await push(fresh.id);await push(fresh.id);
  assert.equal(shown.length,1);
  assert.match(shown[0][1].body,/toma de Fixture Name/);
  await ctx.api.turnOff({clearHistory:true});
  assert.equal(state,null);
  assert.equal(ctx.api.enabled('owner'),false);
});
