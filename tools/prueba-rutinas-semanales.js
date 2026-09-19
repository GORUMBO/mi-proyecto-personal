// Prueba de RUTINAS SEMANALES con clics reales en la instancia Windows.
// Fase 1 (perfil nuevo): crear 4 días, lunes≠martes, guardar nombre,
// marcar semana, segunda rutina, solo hoy, simular día siguiente.
// Fase 2 (mismo perfil tras reiniciar): persistencia + apertura automática
// + eliminar ejercicio.
// Fase 3 (mismo perfil tras reiniciar): el ejercicio eliminado no reaparece.
// Uso: node tools/prueba-rutinas-semanales.js [puerto] [fase]
const port = Number(process.argv[2] || 9334);
const fase = process.argv[3] || '1';
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) {}
    await wait(500);
  }
  throw new Error('sin target');
}
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pend = new Map();
    ws.onopen = () => {
      ws.sendJson = (method, params) => new Promise((res, rej) => {
        const mid = ++id; pend.set(mid, { res, rej });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      });
      resolve(ws);
    };
    ws.onerror = e => reject(new Error('ws error'));
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m); }
    };
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}

async function main() {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  const ev = async (e) => {
    const m = await ws.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (m.result && m.result.exceptionDetails) return 'EXC:' + (m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text);
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  const centro = async (sel) => ev(`(()=>{var el=document.querySelector(${JSON.stringify(sel)});if(!el)return null;el.scrollIntoView({block:'center'});var r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const clic = async (sel) => {
    const p = await centro(sel);
    if (!p) return false;
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return true;
  };
  const clicTexto = async (txt) => {
    const ok = await ev(`(()=>{var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(${JSON.stringify(txt)}));if(!b)return false;b.scrollIntoView({block:'center'});var r=b.getBoundingClientRect();window.__pc={x:r.x+r.width/2,y:r.y+r.height/2};return true;})()`);
    if (!ok) return false;
    const p = await ev('window.__pc');
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return true;
  };

  await wait(8000);
  await ev(`(()=>{window.alert=function(m){window.__alerts=window.__alerts||[];window.__alerts.push(String(m));};window.confirm=function(){return true;};window.prompt=function(m,s){window.__prompts=window.__prompts||[];window.__prompts.push(String(m));return window.__promptVal||null;};window.__promptVal=null;try{state.onboarded=true;state._avisoSinCuentaVisto=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1;})()`);

  if (fase === '1') {
    console.log('== FASE 1 · Crear rutina de 4 días con clics reales ==');
    await ev(`openTab('💪 Ejercicio')`);
    await wait(1200);
    t('abre el constructor con clic real', await clicTexto('Crear rutina'));
    await wait(800);
    // marcar 4 días (Lun, Mar, Mié, Jue) con clics reales
    let diasMarcados = 0;
    for (const di of [0, 1, 2, 3]) {
      const ok = await clic(`#crDiasRow button[data-dia="${di}"]`);
      if (ok) diasMarcados++;
    }
    await ev(`(()=>{var s=document.getElementById('crActividad');s.value='trabajo_intenso';s.dispatchEvent(new Event('change'));var t2=document.getElementById('crTipo');t2.value='auto';t2.dispatchEvent(new Event('change'));return 1;})()`);
    t('4 días marcados (Lun–Jue) con clics reales', diasMarcados === 4);
    t('crea la rutina con clic real', await clicTexto('✅ Crear mi rutina'));
    await wait(3000);
    const dias = await ev(`(()=>{var out=document.getElementById('customRoutineOut');var r=state.customRoutine;if(!r||!r.days)return JSON.stringify({n:0});var nombres=r.days.map(function(d){return d.day;});return JSON.stringify({n:r.days.length,nombres:nombres,comparacion:out.textContent.indexOf('Comparación entre días')>=0});})()`);
    const d = JSON.parse(dias);
    t('rutina de al menos 4 días creada', d.n >= 4, JSON.stringify(d));
    t('lunes y martes tienen enfoques DIFERENTES', d.nombres && d.nombres[0] !== d.nombres[1], JSON.stringify(d.nombres));
    t('comparación automática entre días visible', d.comparacion === true);
    // guardar con nombre nuevo (prompt sobrescrito con valor editable)
    await ev(`window.__promptVal='Rutina de prueba';`);
    t('guardar con clic real', await clicTexto('💾 Guardar esta rutina'));
    await wait(1200);
    const guardada = await ev(`(()=>{var r=(state.savedRoutines||[])[0];return JSON.stringify(r?{nombre:r.name,id:r.id,dias:(r.dias||[]).length,ejercicios:(r.plan||[]).length}:null);})()`);
    const g = JSON.parse(guardada);
    t('nombre EXACTO "Rutina de prueba" con ID estable', g && g.nombre === 'Rutina de prueba' && !!g.id, guardada);
    t('días y ejercicios guardados completos', g && g.dias >= 4 && g.ejercicios > 0, guardada);

    console.log('== FASE 1b · Marcar como Rutina de la semana ==');
    await ev(`openTab('💪 Ejercicio')`);
    await wait(1000);
    await clicTexto('🔄 Cambiar rutina');
    await wait(1000);
    // el detalle debe estar ABIERTO para que el clic caiga sobre el botón
    await ev(`(()=>{var d=document.getElementById('savedRoutinesDetails');if(d)d.open=true;return 1;})()`);
    await wait(300);
    t('marcar semana con clic real', await clicTexto('📌 Semana'));
    await wait(800);
    t('activeRoutineId fijado', await ev(`state.activeRoutineId===(state.savedRoutines[0]||{}).id`));
    t('cabecera muestra la rutina de la semana', (await ev(`document.body.textContent.indexOf('Mi rutina de la semana')>=0`)) === true);

    console.log('== FASE 1c · Segunda rutina + Solo hoy ==');
    await clicTexto('Crear rutina');
    await wait(800);
    for (const di of [0, 1, 2, 3]) { await clic(`#crDiasRow button[data-dia="${di}"]`); }
    await clicTexto('✅ Crear mi rutina');
    await wait(2500);
    await ev(`window.__promptVal='Segunda rutina';`);
    await clicTexto('💾 Guardar esta rutina');
    await wait(1200);
    t('dos rutinas guardadas sin duplicarse', await ev(`(state.savedRoutines||[]).filter(r=>!r.deleted).length`) === 2);
    await clicTexto('🔄 Cambiar rutina');
    await wait(800);
    await ev(`(()=>{var d=document.getElementById('savedRoutinesDetails');if(d)d.open=true;return 1;})()`);
    await wait(300);
    const idSegunda = await ev(`state.savedRoutines[1].id`);
    await ev(`(()=>{var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('🔄 Solo hoy')&&x.closest('.item')&&x.closest('.item').textContent.indexOf('Segunda rutina')>=0);if(b){b.scrollIntoView({block:'center'});var r=b.getBoundingClientRect();window.__pc={x:r.x+r.width/2,y:r.y+r.height/2};return true;}return false;})()`).then(async ok => {
      if (!ok) return false;
      const p = await ev('window.__pc');
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      return true;
    });
    await wait(800);
    t('"solo hoy" marca excepción sin tocar la semanal', await ev(`state.fitnessToday.oneOff===true&&state.activeRoutineId===(state.savedRoutines[0]||{}).id`));
    console.log('== FASE 1d · Simular el día siguiente ==');
    await ev(`(()=>{state.fitnessToday.date='2026-09-17';state.fitnessToday.localDate='2026-09-17';createFitnessToday();return 1;})()`);
    await wait(1000);
    t('al día siguiente vuelve automáticamente la Rutina de la semana', await ev(`state.fitnessToday.oneOff!==true&&state.fitnessToday.loadedRoutineId===(state.savedRoutines[0]||{}).id`));
  } else if (fase === '2') {
    console.log('== FASE 2 · Tras cerrar y reabrir: persistencia y apertura automática ==');
    await ev(`openTab('💪 Ejercicio')`);
    await wait(2000);
    const r = await ev(`(()=>{var rs=(state.savedRoutines||[]).filter(r=>!r.deleted);return JSON.stringify({n:rs.length,nombre0:rs[0]?rs[0].name:null,dias0:rs[0]?(rs[0].dias||[]).length:0,nombre1:rs[1]?rs[1].name:null,activa:state.activeRoutineId===((rs[0]||{}).id),cabecera:document.body.textContent.indexOf('Mi rutina de la semana')>=0,nombreCab:document.body.textContent.indexOf('Rutina de prueba')>=0});})()`);
    const d = JSON.parse(r);
    t('las dos rutinas persisten con sus nombres EXACTOS', d.n === 2 && d.nombre0 === 'Rutina de prueba' && d.nombre1 === 'Segunda rutina', r);
    t('la Rutina de la semana sigue fijada y se abre automáticamente', d.activa === true && d.cabecera === true && d.nombreCab === true, r);
    t('los días guardados persisten (4 días)', d.dias0 >= 4, r);
    console.log('== FASE 2b · Eliminar un ejercicio de la rutina ==');
    await ev(`openRoutineConfig(state.savedRoutines[0].id)`);
    await wait(1000);
    const antes = await ev(`(()=>{var cfg=window._routineCfg;if(!cfg)return -1;return cfg.dias[0]?cfg.dias[0].exs.length:-1;})()`);
    const okX = await ev(`(()=>{var b=[...document.querySelectorAll('button')].find(x=>x.onclick&&String(x.onclick).indexOf('cfgExQuitar')>=0);if(!b)return false;b.scrollIntoView({block:'center'});var r=b.getBoundingClientRect();window.__pc={x:r.x+r.width/2,y:r.y+r.height/2};return true;})()`);
    if (okX) {
      const p = await ev('window.__pc');
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await ws.sendJson('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    }
    await wait(800);
    const despues = await ev(`(()=>{var cfg=window._routineCfg;if(!cfg)return -1;return cfg.dias[0]?cfg.dias[0].exs.length:-1;})()`);
    t('el ejercicio se quitó en el editor', antes >= 0 && despues === antes - 1, antes + '→' + despues);
  } else {
    console.log('== FASE 3 · El ejercicio eliminado NO reaparece ==');
    await ev(`openTab('💪 Ejercicio')`);
    await wait(1500);
    const r = await ev(`(()=>{var rs=(state.savedRoutines||[]).filter(r=>!r.deleted);var r1=rs[0];if(!r1)return 'sin rutina';var n0=(r1.dias&&r1.dias[0]&&r1.dias[0].exs)?r1.dias[0].exs.length:-1;return JSON.stringify({exsDia0:n0});})()`);
    const d = JSON.parse(r);
    t('tras recargar, el ejercicio eliminado sigue fuera (día 0 con ' + d.exsDia0 + ' ejercicios)', d.exsDia0 === 3, r);
  }
  console.log('\n===== RUTINAS SEMANALES (fase ' + fase + '): ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
  process.exit(falladas ? 1 : 0);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(2); });
