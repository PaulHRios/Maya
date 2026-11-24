const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
test('Home CTA routes to existing guidance and disappears for activation, demo, or logout',()=>{
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const snippet=app.slice(app.indexOf('  function updateHomePushCta()'),app.indexOf('  function checkReminders()'));
  const hidden=[], clicked=[];
  const button={},label={}, status={}, state={on:false,real:true,owner:'synthetic',lang:'en',eligible:true,platform:'install'};
  const nodes={'#home-push-cta':{classList:{toggle:(name,value)=>hidden.push(value)}},'#home-push-settings':button,'#home-push-label':label,'#home-push-status':status,
    '#btn-settings':{click:()=>clicked.push('settings')},
    '#background-push-settings':{querySelector:()=>null,scrollIntoView:()=>clicked.push('push section')}};
  const context=vm.createContext({warmingPushButtons:new WeakMap(),warmPushButton:()=>{},$:k=>nodes[k],tabActual:'inicio',Store:{modoDemo:false,hasRealSession:()=>state.real,pushOwner:()=>state.owner,pushEnrollmentEligible:()=>state.eligible},MayaPush:{configured:true,support:()=>state.platform,prepare:()=>{},enabled:()=>state.on},toggleClosedAppReminders:()=>clicked.push('enable'),remText:(es,en)=>state.lang==='en'?en:es});
  vm.runInContext(snippet,context);
  const check=(value)=>{context.updateHomePushCta();assert.equal(hidden.at(-1),value)};
  check(false); assert.equal(label.textContent,'Set up closed-app reminders');
  button.onclick(); assert.deepEqual(clicked,['settings','push section']);
  state.lang='es';check(false);assert.equal(label.textContent,'Configurar avisos con la app cerrada');
  state.platform='ready';check(false);button.onclick();assert.equal(clicked.at(-1),'enable');
  state.eligible=false;check(true);state.eligible=true;
  state.on=true;check(true);state.on=false;
  context.Store.modoDemo=true;check(true);context.Store.modoDemo=false;
  state.real=false;check(true);state.real=true;
  context.tabActual='mas';check(true);context.tabActual='inicio';
  context.MayaPush.configured=false;check(true);
});
test('warmup gates the button and first enrollment fills only untouched preferences',async()=>{
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const snippet=app.slice(app.indexOf('  const warmingPushButtons'),app.indexOf('  function updateHomePushCta()'));
  const reminder=require('../js/reminders.js'), button={isConnected:true}, status={};
  let prepDone, prefs=null,on=false,write;
  const ctx=vm.createContext({Store:{pushOwner:()=>'fixture',photoCacheScope:()=>'fixture-profile'},MayaPush:{
    isPrepared:()=>false,prepare:()=>new Promise(resolve=>{prepDone=resolve}),
    enabled:()=>on,turnOn:async()=>{on=true}
  },MayaReminders:reminder,remRead:()=>prefs,remWrite:(_k,v)=>{write=v},remText:(es,en)=>en,render:()=>{}});
  vm.runInContext(snippet,ctx);
  ctx.warmPushButton(button,status,'fixture');
  assert.equal(button.disabled,true);assert.match(status.textContent,/ready/);
  prepDone(true);await Promise.resolve();
  assert.equal(button.disabled,false);
  await ctx.toggleClosedAppReminders(button,status);
  assert.deepEqual(write,reminder.settings({sleep:true,feed:true,poop:true,wet:true,photo:true}));
  prefs={feed:false};write=undefined;on=false;
  await ctx.toggleClosedAppReminders(button,status);
  assert.equal(write,undefined);
});
