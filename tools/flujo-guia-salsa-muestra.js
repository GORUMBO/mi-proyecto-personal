// ============================================================
// Carga las 3 guías MUESTRA de salsas molcajeteadas usando
// EXCLUSIVAMENTE el editor existente (guiaTM6Nueva/guiaTM6Guardar).
// Sin sincronizar: se anula cloudSave en la sesión de prueba
// (perfil temporal sin sesión, además). Redacción propia basada
// en técnica tradicional mexicana — NO se copia contenido de
// Cookidoo. Parámetros TM6 = propuestas pendientes de prueba.
// Uso: node tools/flujo-guia-salsa-muestra.js [puerto] (9336)
// ============================================================
const fs = require('fs');
const path = require('path');
const port = Number(process.argv[2] || 9336);

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) { }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('No se encontró target CDP en el puerto ' + port);
}
function connect(url) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    let id = 0; const pend = new Map(); let resolver;
    ws.onopen = () => {
      ws.sendJson = (m, p) => new Promise((res, rej) => { const mid = ++id; pend.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p || {} })); });
      resolver();
    };
    ws.onerror = () => { };
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
      else if (m.method === 'Page.javascriptDialogOpening') ws.sendJson('Page.handleJavaScriptDialog', { accept: true });
    };
    new Promise(r => { resolver = r; }).then(() => resolve(ws));
  });
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('PASS ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('FAIL ' + label + (extra ? ' · ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GUIAS = [
 {
  nombre: 'Salsa roja molcajeteada',
  tiempo: 20, kcal: 130,
  ingredientes: ['300 g de jitomate (3 medianos)', '25 g de chile serrano (2-3 piezas)', '8 g de ajo (1 diente grande)', '30 g de cebolla blanca (1/4 pieza)', '4 g de sal (1 cdita rasa)', '5 ml de aceite (opcional)'],
  prep: 'Lava los jitomates y los chiles. Si quieres menos picor, corta los chiles por la mitad y retira semillas y venas con una cuchara. Ten listos el molcajete (o la TM6) y la espátula. Los parámetros TM6 de esta guía son PROPUESTAS pendientes de prueba: ajústalos a tu máquina y márcala como verificada solo cuando la hayas cocinado.',
  pasos: [
   { t: 'Tatema en comal: pon los jitomates y los chiles enteros en un comal caliente a fuego medio-alto. Voltéalos cada 2-3 min hasta que la piel se ampolle y aparezcan manchas negras (8-10 min). Este paso es manual, en comal.', r: 'Jitomates con piel ampollada y aroma ahumado' },
   { t: 'Pela el ajo y corta la cebolla en cuartos. Manual, sin máquina.', r: 'Ajo sin piel y cebolla en cuartos' },
   { t: 'Muele primero los chiles con el ajo y la sal hasta obtener una pasta gruesa. En molcajete: machaca en círculos 1-2 min. En TM6: pon todo en el vaso y tritura 8 seg, vel 5 (accesorio: vaso). Deben quedar trocitos, no puré.', r: 'Pasta gruesa con trocitos visibles de chile' },
   { t: 'Agrega los jitomates tatemados y machaca suave. En molcajete: machaca sin deshacer del todo. En TM6: 4 seg, giro inverso, vel 4, ayudando con la espátula por el bocal.', r: 'Salsa rústica, espesa, con trocitos de jitomate' },
   { t: 'Prueba y ajusta la sal. En TM6: 2 seg, vel 3 para integrar.', r: 'Sabor equilibrado, picor medio' },
   { t: 'Método tradicional completo (sin TM6): tatema en comal, muele todo en el molcajete en este orden — primero chiles con ajo y sal, después el jitomate — hasta la textura rústica que te guste.', r: 'Textura rústica de molcajete, sabor ahumado' }
  ],
  adv: ['El chile tatemado suelta vapor que pica: no acerques la cara al comal.', 'Con ingredientes calientes no subas la velocidad de golpe: empieza en vel 4 y sube poco a poco.'],
  consejos: ['🔥 Picante: medio (3/5) · 🍶 Rinde: ~350 g · ⏱️ Total: 20 min', '❄️ Conservación: refri en frasco hermético 5 días. Congela en porciones hasta 3 meses.', 'Para más sabor ahumado, tatema también la cebolla y el ajo con cáscara.'],
  errores: ['Salsa aguada | Reduce jitomates o tatema 3 min más', 'Quedó puré | Usa menos segundos de molienda (golpes cortos)', 'Picor muy bajo | Deja las venas de los chiles'],
  variantes: ['Con 3-4 chiles de árbol secos tostados para un picor más seco e intenso', 'Para enchiladas: agrega 100 ml de caldo de pollo y tritura 10 seg, vel 6'],
  accs: ['vaso', 'espatula', 'selector']
 },
 {
  nombre: 'Salsa verde molcajeteada',
  tiempo: 20, kcal: 95,
  ingredientes: ['300 g de tomatillo (10-12 piezas)', '20 g de chile serrano (2 piezas)', '8 g de ajo (1 diente)', '20 g de cebolla blanca', '20 g de cilantro (1/2 manojo, solo hojas)', '4 g de sal (1 cdita rasa)'],
  prep: 'Lava los tomatillos frotándolos (tienen una película pegajosa) y sécalos bien. Lava y desinfecta el cilantro; usa solo las hojas. Los parámetros TM6 de esta guía son PROPUESTAS pendientes de prueba: ajústalos a tu máquina.',
  pasos: [
   { t: 'Tatema en comal: tomatillos y chiles enteros a fuego medio-alto, volteando cada 2 min, hasta que la piel se ampolle y el color verde se vea opaco (8-10 min). Manual, en comal.', r: 'Tomatillos verdes opacos con manchas tostadas' },
   { t: 'Pela el ajo y corta la cebolla en cuartos. Manual.', r: 'Ajo y cebolla listos' },
   { t: 'Muele chiles con ajo y sal hasta pasta. Molcajete: 1-2 min en círculos. TM6: 8 seg, vel 5 (accesorio: vaso).', r: 'Pasta de chile con trocitos' },
   { t: 'Agrega los tomatillos tatemados y machaca suave. TM6: 4 seg, giro inverso, vel 4 con la espátula por el bocal.', r: 'Salsa verde rústica, con trocitos de tomatillo' },
   { t: 'Agrega el cilantro AL FINAL y solo intégralo. TM6: 2 seg, vel 3. No lo muelas de más o amarga.', r: 'Puntitos verdes de cilantro visibles' },
   { t: 'Método tradicional completo (sin TM6): tatema en comal y muele en molcajete — chiles+ajo+sal, luego tomatillos y al final el cilantro machacado a mano.', r: 'Textura rústica de molcajete, color verde vivo' }
  ],
  adv: ['Tomatillo crudo mal lavado deja sensación pegajosa: lávalos bien y sécalos antes de tatemar.', 'No muelas el cilantro de más: libera amargor.'],
  consejos: ['🔥 Picante: medio (3/5) · 🍶 Rinde: ~350 g · ⏱️ Total: 20 min', '❄️ Conservación: refri en frasco hermético 5 días. Congelada 2 meses (la textura cambia un poco).', 'Si queda muy ácida, agrega 1/4 de aguacate y un golpe de vel 4.'],
  errores: ['Salsa aguada | Tatema 3-4 min más los tomatillos', 'Sabor amargo | El cilantro se molió de más — agrégalo solo al final', 'Pierde color verde | No la tapes caliente: deja enfriar destapada'],
  variantes: ['Con chile habanero (1/2 pieza) para un picor frutal intenso', 'Con 50 g de aguacate para una versión cremosa'],
  accs: ['vaso', 'espatula', 'selector']
 },
 {
  nombre: 'Salsa de chile de árbol',
  tiempo: 15, kcal: 120,
  ingredientes: ['30 g de chile de árbol seco (25-30 piezas)', '200 g de jitomate (2 medianos)', '8 g de ajo (1 diente)', '4 g de sal (1 cdita rasa)', '10 ml de vinagre blanco (opcional)', '15 ml de aceite (opcional)'],
  prep: 'Tuesta los chiles en comal SIN aceite a fuego medio, 20-30 seg por lado, moviéndolos hasta que suelten aroma. El humo pica: ventila la cocina y no acerques la cara. Quita los tallos; si quieres menos picor, retira las semillas con los dedos (usa guantes o lávate muy bien las manos después). Los parámetros TM6 son PROPUESTAS pendientes de prueba.',
  pasos: [
   { t: 'Tuesta los chiles de árbol en comal seco a fuego medio, 20-30 seg por lado, moviéndolos, hasta que oscurezcan un punto y suelten aroma. Manual — NO los frías o se amargan.', r: 'Chiles tostados con aroma intenso, sin quemarse' },
   { t: 'Asa los jitomates en el mismo comal 6-8 min, volteando, hasta que la piel se ampolle. Manual.', r: 'Jitomates con piel ampollada' },
   { t: 'Muele chiles con ajo, sal y vinagre. TM6: 15 seg, vel 6-8 (accesorio: vaso). Queda un polvo-pasta seco.', r: 'Pasta seca de chile, color rojo intenso' },
   { t: 'Agrega los jitomates y muele por golpes. TM6: 5 seg, vel 5, con la espátula por el bocal.', r: 'Salsa roja espesa, con puntitos de chile' },
   { t: 'Si la quieres más fluida, agrega 30-50 ml de agua y un golpe de 3 seg, vel 4. Prueba y ajusta sal.', r: 'Salsa untable o ligeramente fluida, picor alto' },
   { t: 'Método tradicional completo (sin TM6): tuesta los chiles, ásalos con el jitomate y muele todo en molcajete — chiles+ajo+sal primero, después jitomate y vinagre al gusto.', r: 'Textura rústica de molcajete' }
  ],
  adv: ['El humo del chile tostado irrita ojos y garganta: ventila y no acerques la cara.', 'Lávate las manos antes de tocarte la cara: el picor del chile de árbol se queda en la piel.', 'No frías los chiles en aceite: se amargan.'],
  consejos: ['🔥 Picante: alto (4.5/5) · 🍶 Rinde: ~250 g · ⏱️ Total: 15 min', '❄️ Conservación: refri en frasco 1 semana (el vinagre ayuda). Congelada hasta 3 meses.', 'Una cdita transforma caldos, huevos, frijoles y tacos: úsala con moderación.'],
  errores: ['Sabor amargo | Los chiles se quemaron al tostar — 20 seg por lado máximo', 'Salsa aguada | Usa jitomate guaje (menos agua) o reduce el agua añadida', 'Pica demasiado | Retira TODAS las semillas antes de moler'],
  variantes: ['Con 10 g de ajonjolí tostado molido junto con los chiles', 'Con 50 g de cacahuate tostado para una versión más untable'],
  accs: ['vaso', 'espatula', 'selector']
 }
];

(async () => {
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  const evalJs = async (expr) => {
    const r = await ws.sendJson('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL ERROR: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  try { await ws.sendJson('Page.bringToFront', {}); } catch (e) { }

  if(!process.argv.includes('--sin-seed')){
    await evalJs(`localStorage.setItem('pp_full', JSON.stringify({profile:{peso:150,altura:170,edad:30,sexo:'hombre',actividad:'muy alta',objetivo:'ganar músculo',nombre:'Prueba'},onboarded:true,_isOwner:true,uiSettings:{tutorialDone:true,hiddenTabs:[],mode:'personal',dark:false}})); 'ok'`);
    await ws.sendJson('Page.reload', { ignoreCache: true });
    await sleep(4500);
  }
  if (await evalJs(`!!document.getElementById('loginScreen')`)) {
    await evalJs(`(()=>{const b=[...document.querySelectorAll('#loginScreen button')].find(x=>x.textContent.includes('Seguir sin cuenta'));if(b)b.click();return 'ok';})()`);
    await sleep(800);
  }
  if (await evalJs(`!!document.getElementById('avisoSinCuentaBox')`)) { await evalJs(`document.querySelector('#avisoSinCuentaBox button').click()`); await sleep(500); }
  await evalJs(`window._rAFOriginal=requestAnimationFrame;window.requestAnimationFrame=null;openTab('🤖 Thermomix TM6');'ok'`);
  for (let i = 0; i < 20; i++) { if (await evalJs(`!!document.getElementById('misGuiasTM6Out')`)) break; await sleep(500); }
  // SIN sincronizar: anular cloudSave en esta sesión de prueba
  await evalJs(`window.cloudSave=undefined;'ok'`);

  // Crear las 3 guías por el EDITOR EXISTENTE
  for (const g of GUIAS) {
    await evalJs(`guiaTM6Nueva();'ok'`);
    await sleep(400);
    const fill = `(()=>{
      document.getElementById('tm6gNombre').value=${JSON.stringify(g.nombre)};
      document.getElementById('tm6gTiempo').value='${g.tiempo}';
      document.getElementById('tm6gKcal').value='${g.kcal}';
      document.getElementById('tm6gCat').value='salsas';tm6CatChange();
      document.getElementById('tm6gSub').value='molcajeteada';
      document.getElementById('tm6gPrep').value=${JSON.stringify(g.prep)};
      document.getElementById('tm6gIng').value=${JSON.stringify(g.ingredientes.join('\n'))};
      document.getElementById('tm6gAdv').value=${JSON.stringify(g.adv.join('\n'))};
      document.getElementById('tm6gConsejos').value=${JSON.stringify(g.consejos.join('\n'))};
      document.getElementById('tm6gErrores').value=${JSON.stringify(g.errores.join('\n'))};
      document.getElementById('tm6gVariantes').value=${JSON.stringify(g.variantes.join('\n'))};
      ${g.accs.map(a => `tm6AccToggle('${a}');`).join('')}
      return 'ok';
    })()`;
    await evalJs(fill);
    await sleep(300);
    // pasos dinámicos: el primero ya existe; agregar el resto
    for (let pi = 0; pi < g.pasos.length; pi++) {
      if (pi > 0) { await evalJs(`tm6PasoAgregar();'ok'`); await sleep(250); }
      const pf = `(()=>{
        document.getElementById('tm6gP_t_${pi}').value=${JSON.stringify(g.pasos[pi].t)};
        document.getElementById('tm6gP_r_${pi}').value=${JSON.stringify(g.pasos[pi].r)};
        return 'ok';
      })()`;
      await evalJs(pf);
    }
    await sleep(300);
    await evalJs(`guiaTM6Guardar();'ok'`);
    await sleep(900);
    console.log('  guía creada: ' + g.nombre);
  }

  // Verificación
  const n = await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
  t('3 guías guardadas en Mis guías TM6', n === 3, String(n));
  t('todas en Salsas → Molcajeteadas', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.categoria==='salsas'&&x.subcategoria==='molcajeteada')`));
  t('todas pendientes de prueba (nada verificado automáticamente)', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.verificado==='pendiente')`));
  t('contenido completo (ingredientes en gramos, prep previa, advertencias, errores, variantes, accesorios)', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.ingredientes.length>=5&&/\\d+ g/.test(x.ingredientes.join(' '))&&x.prepPrevia&&x.advertencias.length&&x.erroresComunes.length&&x.variantes.length&&x.accesorios.includes('vaso')&&x.pasos.length===6)`));
  t('parámetros TM6 propuestos en los pasos (vel/temp/tiempo) y resultado esperado en cada paso', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.pasos.some(p=>/vel/.test(p.t))&&x.pasos.every(p=>p.r))`));
  t('no se sincronizó (cloudSave anulado en la sesión)', await evalJs(`typeof window.cloudSave==='undefined'||window.cloudSave===undefined`));

  await evalJs(`tm6FiltroCat('salsas');tm6FiltroSub('molcajeteada');'ok'`);
  await sleep(500);
  t('las 3 visibles bajo el filtro Molcajeteadas', await evalJs(`(()=>{const out=document.getElementById('misGuiasTM6Out').textContent;return out.includes('Salsa roja molcajeteada')&&out.includes('Salsa verde molcajeteada')&&out.includes('Salsa de chile de árbol');})()`));
  const shot = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-salsas-muestra.png'), Buffer.from(shot.data, 'base64'));

  // abrir una guía completa para la captura
  await evalJs(`(()=>{const d=[...document.querySelectorAll('#misGuiasTM6Out details')].find(x=>x.textContent.includes('Salsa roja molcajeteada'));if(d)d.open=true;return 'ok';})()`);
  await sleep(600);
  const shot2 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-salsas-muestra-detalle.png'), Buffer.from(shot2.data, 'base64'));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/tm6-salsas-muestra{-detalle}.png');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
