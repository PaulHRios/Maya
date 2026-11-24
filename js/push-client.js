/* Keep names and log information local; send only opaque IDs and times. */
const MayaPush = (() => {
  const KEY = 'maya.push-connection.v1';
  const base = typeof MAYA_PUSH_BASE === 'string' ? MAYA_PUSH_BASE.replace(/\/$/,'') : '';
  const configured = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base);
  let desired, running, lastNetwork='', lastLocal='', retryAt=0, revoking=false, prepared, preparing;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)||'null'); } catch { return null; } };
  const save = c => c ? localStorage.setItem(KEY,JSON.stringify(c)) : localStorage.removeItem(KEY);
  const platform = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && 'indexedDB' in window;
  const support = () => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    return ios && !matchMedia('(display-mode: standalone)').matches && navigator.standalone!==true
      ? 'install' : platform() ? 'ready' : 'unsupported';
  };
  const enabled = owner => { const c=read(); return configured && !revoking && !!c && !c.revoked && c.owner===owner; };
  const route = c => 'devices/'+encodeURIComponent(c.deviceId);
  const bytes = x => Uint8Array.from(atob(x.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-x.length%4)%4)), c=>c.charCodeAt(0));
  const rand = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  async function api(path,{method='GET',body,token}={}) {
    if (!configured) throw new Error('scheduler-not-configured');
    const abort=new AbortController(), timeout=setTimeout(()=>abort.abort(),10000);
    try {
      const r=await fetch(base+'/v1/'+path,{method,credentials:'omit',cache:'no-store',signal:abort.signal,
        headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
        ...(body?{body:JSON.stringify(body)}:{})});
      if (!r.ok) throw Object.assign(new Error('scheduler-'+r.status),{status:r.status});
      return r.status===204 ? null : r.json().catch(()=>null);
    } finally { clearTimeout(timeout); }
  }
  async function worker() {
    let timeout;
    try { return await Promise.race([navigator.serviceWorker.ready,
      new Promise((_,rej)=>{timeout=setTimeout(()=>rej(new Error('worker-not-ready')),6000);})]); }
    finally { clearTimeout(timeout); }
  }
  function prepare() {
    if (!configured || support()!=='ready') return Promise.resolve(null);
    if (prepared) return Promise.resolve(prepared);
    if (!preparing) preparing=Promise.all([worker(),api('public-key')]).then(async ([reg,key])=>{
      const applicationServerKey=bytes(key.publicKey);
      if (applicationServerKey.length!==65) throw new Error('invalid-VAPID-key');
      prepared={reg,applicationServerKey,sub:await reg.pushManager.getSubscription()};
      return prepared;
    }).catch(()=>null).finally(()=>{preparing=null;});
    return preparing;
  }
  async function turnOn(owner,enrollment,current=()=>true) {
    if (!configured || support()!=='ready') throw new Error(support());
    if (Notification.permission==='denied') throw new Error('permission');
    if (enabled(owner)) return;
    if (read()) {
      await turnOff({clearHistory:read().owner!==owner});
      if (read()) throw new Error('old-registration-still-pending');
      await prepare(); throw new Error('try-again');
    }
    if (!current()) throw new Error('session-changed');
    if (!prepared) { prepare(); throw new Error('preparing'); }
    const {reg,applicationServerKey}=prepared;
    let {sub}=prepared;
    if (sub?.options?.applicationServerKey) {
      const old=new Uint8Array(sub.options.applicationServerKey);
      if (old.length!==applicationServerKey.length || old.some((b,i)=>b!==applicationServerKey[i])) {
        prepared=null; await sub.unsubscribe(); await prepare(); throw new Error('try-again');
      }
    }
    // Subscribe directly from the button gesture, without another await first.
    try { if (!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey}); }
    catch(e){if(e.name==='NotAllowedError')throw new Error('permission');throw e;}
    let enrolled;
    try {
      if (!current()) throw new Error('session-changed');
      enrolled=await api('devices',{method:'POST',body:{subscription:sub.toJSON()},token:enrollment||''});
      if (!enrolled?.deviceId || !enrolled.token || !current()) throw new Error('registration-incomplete');
      await MayaPushStorage.change(old=>({write:old?.owner===owner
        ? {owner,deviceId:enrolled.deviceId,scope:null,jobs:[],completed:old.completed||{}} : null}));
      if (!current()) throw new Error('session-changed');
      save({owner,deviceId:enrolled.deviceId,token:enrolled.token});
      lastNetwork=lastLocal=''; prepared=null;
    } catch(e) {
      if (enrolled?.deviceId && enrolled.token) await api(route(enrolled),{method:'DELETE',token:enrolled.token}).catch(()=>{});
      await sub.unsubscribe().catch(()=>{}); prepared=null; prepare(); throw e;
    }
  }
  function seen(prev,scope) {
    const all=new Map(Object.entries(prev?.completed||{})), set=new Set(all.get(scope)||[]);
    for (const j of prev?.jobs||[]) if(j.delivered || j.expiresAt<=Date.now()) {
      if (prev.scope===scope) set.add(j.localKey);
      else {
        const old=new Set(all.get(prev.scope)||[]); old.add(j.localKey);
        all.set(prev.scope,[...old].slice(-80));
      }
    }
    all.delete(scope); all.set(scope,[...set].slice(-80));
    return {set,map:Object.fromEntries([...all].slice(-6))};
  }
  async function turnOff({clearHistory=false}={}) {
    if (revoking) return;
    revoking=true; desired=null; prepared=null; lastNetwork=lastLocal='';
    const c=read();
    try {
      if (c) save({...c,revoked:true});
      // Invalidate the local details first, even offline.
      await MayaPushStorage.change(old=>({write:!clearHistory && old?.owner===c?.owner && old
        ? {owner:c.owner,deviceId:null,scope:null,jobs:[],completed:seen(old,old.scope).map} : null})).catch(()=>{});
      if(platform()) try { const sub=await (await worker()).pushManager.getSubscription(); await sub?.unsubscribe(); } catch {}
      if(c) try {await api(route(c),{method:'DELETE',token:c.token}); save(null);}
      catch(e) { if(e.status===401 || e.status===404) save(null); }
    } finally { revoking=false; }
  }
  const sig=j=>JSON.stringify([j.id,j.dueAt,j.deadline,j.prefs,j.lang,j.name]);
  function setDesired({owner,scope,plan,dismissed,options,name,lang,allowNetwork=true}) {
    if (!configured || !platform()) return;
    const c=read();
    if(c?.revoked || (c && c.owner!==owner)) {
      if(!revoking && Date.now()>=retryAt) {retryAt=Date.now()+60000;turnOff({clearHistory:c.owner!==owner}).catch(()=>{});}
      return;
    }
    if(!enabled(owner)) return;
    if(Notification.permission!=='granted') {turnOff().catch(()=>{});return;}
    const prefs={quiet:options.quiet,from:options.from,to:options.to};
    const rows=plan.filter(j=>!dismissed?.[j.id]).map(j=>({...j,prefs,name,lang}));
    const signatures=new Set(rows.map(sig)), local=JSON.stringify([c.deviceId,scope,[...signatures]]);
    if(local!==lastLocal) {
      lastLocal=local;
      // Filter old IDB details before any pending network reconcile can finish.
      MayaPushStorage.change(prev=>{
        if(prev?.deviceId!==c.deviceId) return {};
        const jobs=prev.scope===scope ? prev.jobs.filter(j=>signatures.has(j.signature)) : [];
        return {write:{owner,scope,deviceId:c.deviceId,jobs,completed:seen(prev,scope).map}};
      }).catch(()=>{if(lastLocal===local)lastLocal='';});
    }
    desired=allowNetwork ? {c,scope,rows} : null;
    if(allowNetwork && !running && Date.now()>=retryAt) {
      running=reconcile().catch(()=>{retryAt=Date.now()+45000;}).finally(()=>{running=null;});
    }
  }
  async function reconcile() {
    while(desired && !revoking) {
      const {c,scope,rows}=desired; desired=null;
      if(!enabled(c.owner) || read()?.deviceId!==c.deviceId) return;
      const jobs=await MayaPushStorage.change(old=>{
        if(!enabled(c.owner) || read()?.deviceId!==c.deviceId) return {value:null};
        const prev=old?.deviceId===c.deviceId ? old : null;
        const {set,map}=seen(prev,scope), prior=prev?.scope===scope ? prev.jobs : [], now=Date.now();
        const jobs=[];
        for(const j of rows) {
          if(set.has(j.id)) continue;
          const last=prior.find(p=>p.localKey===j.id && p.signature===sig(j));
          if(last) {jobs.push(last);continue;}
          if(j.at>=j.expires || j.expires<=now) continue;
          jobs.push({id:rand(),at:j.at,expiresAt:j.expires,signature:sig(j),localKey:j.id,
            type:j.type,since:j.since,week:j.week,name:j.name,lang:j.lang,prefs:j.prefs});
        }
        return {write:{owner:c.owner,deviceId:c.deviceId,scope,jobs,completed:map},
          value:jobs.filter(j=>!j.delivered && j.expiresAt>now).map(({id,at,expiresAt})=>({id,at,expiresAt}))};
      });
      if(!jobs || revoking || !enabled(c.owner)) continue;
      const key=JSON.stringify([c.deviceId,jobs]);
      if(key===lastNetwork) continue;
      try {await api(route(c)+'/jobs',{method:'PUT',body:{jobs},token:c.token});lastNetwork=key;retryAt=0;}
      catch(e){if(e.status===401){await turnOff();return;}throw e;}
    }
  }
  return {configured,support,enabled,prepare,turnOn,turnOff,setDesired};
})();
