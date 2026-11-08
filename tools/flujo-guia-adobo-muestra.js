// ============================================================
// Carga las 3 guías MUESTRA de adobos mexicanos usando el editor
// existente. Sin sincronizar (cloudSave anulado + perfil temporal
// sin sesión). Redacción propia de técnica tradicional — NO se
// copia Cookidoo. Parámetros TM6 = propuestas pendientes de prueba.
// Fotos reales: el paso de chiles usa la foto CC de la biblioteca
// de alimentos (assets/alimentos).
// Uso: node tools/flujo-guia-adobo-muestra.js [puerto] (9336)
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
  nombre: 'Adobo para tacos al pastor',
  sub: 'tacos', tiempo: 25, kcal: 180,
  fotoChile: 'guajillo.jpg',
  ingredientes: ['30 g de chile guajillo seco (5-6 piezas)', '15 g de chile ancho seco (2 piezas)', '40 g de pasta de achiote (recado rojo)', '120 ml de jugo de piña natural', '30 ml de vinagre blanco', '10 g de ajo (2 dientes)', '3 g de comino molido', '2 g de orégano seco', '1 g de clavo de olor (1 pieza)', '8 g de sal', '2 g de pimienta negra'],
  prep: 'Desvena los chiles guajillo y ancho: ábrelos, retira semillas y venas, y remójalos 15 min en agua caliente. Si no tienes pasta de achiote, usa 1 cda de achiote molido con 1 cdita de vinagre. Los parámetros TM6 de esta guía son PROPUESTAS pendientes de prueba: ajústalos a tu máquina y márcala como verificada solo cuando la hayas cocinado.',
  pasos: [
   { t: 'Desvena y remoja los chiles en agua caliente 15 min. Escúrrelos. Manual.', r: 'Chiles suaves y sin semillas' },
   { t: 'Muele los chiles con el ajo, el achiote, el vinagre y las especias. TM6: 30 seg, vel 8 (accesorio: vaso).', r: 'Pasta roja densa y homogénea' },
   { t: 'Agrega el jugo de piña y la sal. TM6: 20 seg, vel 6, ayudando con la espátula por el bocal.', r: 'Adobo fluido pero espeso, color rojo ladrillo' },
   { t: 'Cuela por un colador fino si quieres una textura lisa (opcional). Manual.', r: 'Adobo sin grumos de piel de chile' },
   { t: 'Marina: 150 g de adobo por kg de carne (cerdo en bistec o rebanada), cubre y refrigera 4-24 h. Manual.', r: 'Carne cubierta por completo, color uniforme' },
   { t: 'Método tradicional completo (sin TM6): muele chiles remojados con ajo, achiote y especias en molcajete o mortero, agrega jugo de piña y vinagre, y mezcla hasta integrar.', r: 'Adobo rústico de molcajete' }
  ],
  adv: ['El chile seco remojado conserva picor en las manos: lávate bien antes de tocarte la cara.', 'No marines carne cruda fuera del refri más de 2 h (riesgo de contaminación).'],
  consejos: ['🧂 Uso: 150 g por kg de carne · ⏱️ Marinado: 4-24 h en refri · 🔥 Cocción segura: trompo u horno a 180°C hasta 74°C internos', '❄️ Conservación del adobo: refri en frasco 5 días; congelado en porciones 3 meses.', 'La piña natural ablanda la carne: no marines más de 24 h o se deshace.'],
  errores: ['Adobo aguado | Menos jugo de piña o cuélalo más tiempo', 'Sabor muy ácido | Reduce el vinagre a 15 ml', 'Carne sin color | Agrega 10 g más de achiote'],
  variantes: ['Con chile morita (10 g) para un fondo ahumado', 'Versión sin piña: 100 ml de agua + 1 cdita de azúcar'],
  accs: ['vaso', 'espatula', 'selector']
 },
 {
  nombre: 'Adobo para birria de res',
  sub: 'carnes', tiempo: 30, kcal: 220,
  fotoChile: 'pasilla.jpg',
  ingredientes: ['40 g de chile guajillo seco', '20 g de chile ancho seco', '10 g de chile de árbol seco', '200 g de jitomate (2 medianos)', '60 g de cebolla blanca', '12 g de ajo (3 dientes)', '30 ml de vinagre blanco', '3 g de comino molido', '3 g de orégano seco', '1 g de clavo de olor', '2 g de canela en raja', '8 g de sal'],
  prep: 'Desvena y remoja los chiles 15 min en agua caliente. Asa el jitomate, la cebolla y los ajos en comal hasta que se ampollen (8-10 min). Los parámetros TM6 son PROPUESTAS pendientes de prueba.',
  pasos: [
   { t: 'Desvena y remoja los chiles 15 min; escúrrelos. Asa jitomate, cebolla y ajos en comal. Manual.', r: 'Chiles suaves; verduras con piel ampollada' },
   { t: 'Muele todo: chiles, jitomate, cebolla, ajo, vinagre y especias. TM6: 40 seg, vel 8-10 (accesorio: vaso).', r: 'Pasta roja oscura y espesa' },
   { t: 'Calienta el adobo para asentar el sabor. TM6: 100°C, 10 min, vel cuchara, giro inverso (accesorio: vaso).', r: 'Adobo más oscuro, aroma profundo de especias' },
   { t: 'Deja enfriar destapado 15 min. Manual.', r: 'Adobo a temperatura ambiente, listo para marinar' },
   { t: 'Marina: 180 g por kg de carne de res (chamberete, espaldilla o maciza), refrigera 12-24 h. Manual.', r: 'Carne teñida de rojo uniforme' },
   { t: 'Método tradicional completo (sin TM6): muele en molcajete o licuadora de vaso; cuece el adobo 10 min en olla a fuego bajo removiendo.', r: 'Adobo rústico con cuerpo' }
  ],
  adv: ['Al tostar chiles secos no los dejes quemar: se amargan y arruinan el adobo.', 'La birria necesita cocción larga: cocina SIEMPRE hasta que la carne se deshebre (85-90°C internos).'],
  consejos: ['🧂 Uso: 180 g por kg de res · ⏱️ Marinado: 12-24 h en refri · 🔥 Cocción segura: sella la carne, agrega caldo y cuece a fuego bajo 3-4 h hasta deshebrar', '❄️ Conservación: refri 5 días; congelado 3 meses.', 'Reserva un poco de adobo sin carne para bañar los tacos dorados al final.'],
  errores: ['Adobo amargo | Los chiles se quemaron al tostar — tuéstalos solo 20 seg', 'Quedó muy espeso | Agrega 100 ml del caldo al momento de usarlo', 'Picor excesivo | Reduce el chile de árbol a 5 g'],
  variantes: ['Birria de chivo: usa chivo y sube el vinagre a 40 ml', 'Con 100 g de jitomate extra para una birria más roja'],
  accs: ['vaso', 'espatula', 'selector']
 },
 {
  nombre: 'Adobo de guajillo tradicional',
  sub: 'tradicionales', tiempo: 20, kcal: 150,
  fotoChile: 'guajillo.jpg',
  ingredientes: ['50 g de chile guajillo seco (10-12 piezas)', '10 g de ajo (2 dientes)', '3 g de comino molido', '2 g de orégano seco', '2 g de pimienta negra', '1 g de clavo de olor', '30 ml de vinagre blanco', '60 ml de agua', '6 g de sal'],
  prep: 'Desvena los chiles guajillo y remójalos 15 min en agua caliente. Tuesta las especias en comal seco 20 seg (solo para despertar el aroma). Los parámetros TM6 son PROPUESTAS pendientes de prueba.',
  pasos: [
   { t: 'Desvena y remoja los chiles 15 min; escúrrelos. Tuesta comino, orégano, pimienta y clavo 20 seg en comal seco. Manual.', r: 'Chiles suaves; especias con aroma despierto' },
   { t: 'Muele chiles con ajo, especias, vinagre, agua y sal. TM6: 30 seg, vel 8 (accesorio: vaso).', r: 'Pasta roja profunda, ligeramente fluida' },
   { t: 'Calienta el adobo para integrar sabores. TM6: 100°C, 5 min, vel cuchara (accesorio: vaso).', r: 'Aroma dulce y profundo de guajillo' },
   { t: 'Deja enfriar destapado 10 min. Manual.', r: 'Adobo listo para marinar' },
   { t: 'Marina: 120 g por kg de carne (pollo, cerdo o res), refrigera 2-12 h. Manual.', r: 'Carne cubierta de adobo rojo' },
   { t: 'Método tradicional completo (sin TM6): muele en molcajete o mortero; cuece 5 min en olla a fuego bajo removiendo con cuchara.', r: 'Adobo rústico tradicional' }
  ],
  adv: ['El guajillo remojado tiñe manos y utensilios: lava pronto con agua y jabón.', 'Nunca marines carne cruda a temperatura ambiente más de 2 h.'],
  consejos: ['🧂 Uso: 120 g por kg (pollo, cerdo, res, setas o verduras) · ⏱️ Marinado: 2-12 h en refri · 🔥 Cocción segura: aves a 74°C internos, cerdo a 71°C, res al término deseado', '❄️ Conservación: refri 5 días; congelado 3 meses.', 'Este adobo es la base: a partir de él salen pastor, birria y enchiladas.'],
  errores: ['Adobo aguado | Remoja los chiles solo 15 min y escurre bien', 'Sabor apagado | Tuesta las especias antes de moler', 'Demasiado espeso | Agrega agua de a poco (10 ml por vez)'],
  variantes: ['Con 10 g de chile ancho para más dulzor', 'Con 5 g de chile de árbol para subir el picor'],
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
  await evalJs(`window.cloudSave=undefined;'ok'`);

  for (const g of GUIAS) {
    await evalJs(`guiaTM6Nueva();'ok'`);
    await sleep(400);
    const fill = `(()=>{
      document.getElementById('tm6gNombre').value=${JSON.stringify(g.nombre)};
      document.getElementById('tm6gTiempo').value='${g.tiempo}';
      document.getElementById('tm6gKcal').value='${g.kcal}';
      document.getElementById('tm6gCat').value='adobos';tm6CatChange();
      document.getElementById('tm6gSub').value='${g.sub}';
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
    // Foto real del chile en el paso 1 (misma foto CC de assets/alimentos)
    const b64 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'alimentos', g.fotoChile)).toString('base64');
    await evalJs(`(()=>{const dataUrl='data:image/jpeg;base64,${b64}';const hash=gvHash(dataUrl);state.guiasMedia=state.guiasMedia||{};state.guiasMedia[hash]=dataUrl;const guia=(state.misGuiasTM6||[]).filter(x=>!x.deleted).find(x=>x.nombre===${JSON.stringify(g.nombre)});if(guia){guia.pasos[0].f=hash;guia.updated_at=new Date().toISOString();}save();return 'ok';})()`);
    await sleep(500);
    console.log('  guía creada: ' + g.nombre);
  }

  const n = await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).length`);
  t('3 guías de adobos guardadas', n === 3, String(n));
  t('en Adobos y marinados, con su subcategoría', await evalJs(`(()=>{const gs=(state.misGuiasTM6||[]).filter(x=>!x.deleted);return gs.length===3&&gs.some(x=>x.nombre.includes('pastor')&&x.subcategoria==='tacos')&&gs.some(x=>x.nombre.includes('birria')&&x.subcategoria==='carnes')&&gs.some(x=>x.nombre.includes('guajillo tradicional')&&x.subcategoria==='tradicionales');})()`));
  t('todas pendientes de prueba', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.verificado==='pendiente')`));
  t('ingredientes pesados en gramos', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.ingredientes.length>=8&&/\\d+ g/.test(x.ingredientes.join(' ')))`));
  t('instrucciones de uso (cantidad por kg, marinado, cocción segura, conservación)', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>(x.consejos||[]).some(c=>/por kg/.test(c))&&(x.consejos||[]).some(c=>/Marinado/.test(c))&&(x.consejos||[]).some(c=>/Cocción segura/.test(c))&&(x.consejos||[]).some(c=>/Conservación/.test(c)))`));
  t('método tradicional y resultados esperados en cada paso', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.pasos.length===6&&x.pasos.some(p=>/tradicional/.test(p.t))&&x.pasos.every(p=>p.r))`));
  t('foto real del chile en el paso de chiles', await evalJs(`(state.misGuiasTM6||[]).filter(x=>!x.deleted).every(x=>x.pasos[0].f&&(state.guiasMedia||{})[x.pasos[0].f])`));
  t('no se sincronizó', await evalJs(`typeof window.cloudSave==='undefined'`));

  await evalJs(`tm6FiltroCat('adobos');'ok'`);
  await sleep(500);
  t('las 3 visibles bajo Adobos y marinados', await evalJs(`(()=>{const out=document.getElementById('misGuiasTM6Out').textContent;return out.includes('tacos al pastor')&&out.includes('birria de res')&&out.includes('guajillo tradicional');})()`));
  const shot = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-adobos-muestra.png'), Buffer.from(shot.data, 'base64'));
  await evalJs(`(()=>{const d=[...document.querySelectorAll('#misGuiasTM6Out details')].find(x=>x.textContent.includes('tacos al pastor'));if(d)d.open=true;return 'ok';})()`);
  await sleep(600);
  const shot2 = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'pruebas', 'tm6-adobos-muestra-detalle.png'), Buffer.from(shot2.data, 'base64'));

  console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
  console.log('Capturas: tools/pruebas/tm6-adobos-muestra{-detalle}.png');
  try { await ws.sendJson('Browser.close', {}); } catch (e) { }
  process.exit(falladas ? 1 : 0);
})().catch(e => { console.error('FALLA GENERAL', e.message); process.exit(2); });
