const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('the existing extraction timer starts before the reminder prompt; cancel clears the timer',()=>{
  const code=fs.readFileSync(require.resolve('../js/app.js'),'utf8'), calls=[];
  let timers={};
  const env=vm.createContext({Date,Store:{getTimers:()=>timers,setTimers:t=>{timers=t;calls.push('timer')}},
    modoExt:()=>({}),toast:()=>{},hojaAvisoExtraccion:()=>calls.push('prompt')});
  const i=code.indexOf('  function iniciarExtraccion('), j=code.indexOf('  function hojaAvisoExtraccion(',i);
  const k=code.indexOf('  function terminarExtraccion('),l=code.indexOf('  function hojaFinExtraccion(',k);
  vm.runInContext(code.slice(i,j)+code.slice(k,l),env);
  env.iniciarExtraccion('normal');
  assert.deepEqual(calls,['timer','prompt']);assert.equal(timers.extraccion.modo,'normal');
  assert.equal(timers.extraccion.reminderMinutes,undefined);
  env.terminarExtraccion(true);
  assert.equal(timers.extraccion,undefined);
});

test('choosing the method replaces the same sheet without scheduling an old close',()=>{
  const code=fs.readFileSync(require.resolve('../js/app.js'),'utf8'), events=[], button={dataset:{metodo:'normal'}};
  const a=code.indexOf('  function hojaElegirMetodo('), b=code.indexOf('  function iniciarExtraccion(',a);
  const env=vm.createContext({Object,MODOS_EXTRACCION:{normal:{emoji:'',nombre:'',desc:''}},
    abrirSheet:()=>events.push('method sheet'),document:{querySelectorAll:()=>[button]},
    cerrarSheet:()=>events.push('queued close'),iniciarExtraccion:()=>events.push('reminder sheet')});
  vm.runInContext(code.slice(a,b),env);
  env.hojaElegirMetodo();button.onclick();
  assert.deepEqual(events,['method sheet','reminder sheet']);
});
