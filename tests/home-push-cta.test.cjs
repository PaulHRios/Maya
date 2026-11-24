const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
test('Home CTA routes to existing guidance and disappears for activation, demo, or logout',()=>{
  const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  const snippet=app.slice(app.indexOf('  function updateHomePushCta()'),app.indexOf('  function checkReminders()'));
  const hidden=[], clicked=[];
  const button={}, state={on:false,real:true,owner:'synthetic',lang:'en'};
  const nodes={'#home-push-cta':{classList:{toggle:(name,value)=>hidden.push(value)}},'#home-push-settings':button,
    '#btn-settings':{click:()=>clicked.push('settings')},
    '#background-push-settings':{querySelector:()=>null,scrollIntoView:()=>clicked.push('push section')}};
  const context=vm.createContext({$:k=>nodes[k],tabActual:'inicio',Store:{modoDemo:false,hasRealSession:()=>state.real,pushOwner:()=>state.owner},MayaPush:{configured:true,enabled:()=>state.on},remText:(es,en)=>state.lang==='en'?en:es});
  vm.runInContext(snippet,context);
  const check=(value)=>{context.updateHomePushCta();assert.equal(hidden.at(-1),value)};
  check(false); assert.equal(button.textContent,'Set up closed-app reminders');
  button.onclick(); assert.deepEqual(clicked,['settings','push section']);
  state.lang='es';check(false);assert.equal(button.textContent,'Configurar avisos con la app cerrada');
  state.on=true;check(true);state.on=false;
  context.Store.modoDemo=true;check(true);context.Store.modoDemo=false;
  state.real=false;check(true);state.real=true;
  context.tabActual='mas';check(true);context.tabActual='inicio';
  context.MayaPush.configured=false;check(true);
});
