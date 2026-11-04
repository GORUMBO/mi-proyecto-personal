// ============================================================
// PRUEBAS — Hub visual de modos de cocina (tarjetas con foto).
// Reglas: UN solo sistema de modos (estaciones de Mi cocina +
// filtro _recMethod de Recetas + openTab); fotos locales en
// assets/cocina; el número de la tarjeta SIEMPRE coincide con
// lo que filtra renderRecipes (misma función recetaEsDelMetodo).
// Uso: node tests/cocina-modos-hub.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const VER = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
const { buildBaseRecipes } = require('../tools/auditar-recetas.js');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '/' && (HTML[j + 1] === "'" || HTML[j + 1] === '"' || HTML[j + 1] === '\\') && /[\(,=:\[!&|?;{+\-*%~^<>]\s*$/.test(HTML.slice(Math.max(0, j - 4), j))) {
      j++;
      while (j < HTML.length && !(HTML[j] === '/' && HTML[j - 1] !== '\\')) j++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
function fn(name, ctx) {
  return vm.runInNewContext('(' + extractFunc(name) + ')', ctx || {});
}
function constArr(name) {
  const m = HTML.match(new RegExp('const ' + name + '=(\\[[\\s\\S]*?\\]);\\n'));
  if (!m) throw new Error('No se encontró const ' + name);
  return vm.runInNewContext('(' + m[1] + ')');
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const COCINA_MODOS = constArr('COCINA_MODOS');
const { base } = buildBaseRecipes();
const ctx = {
  baseRecipes: base,
  safeText: s => String(s),
  _aparatoEncendido: () => true,
  COCINA_MODOS
};
const methodKeyOf = fn('methodKeyOf', ctx);
ctx.methodKeyOf = methodKeyOf;
const recetaEsDelMetodo = fn('recetaEsDelMetodo', ctx);
ctx.recetaEsDelMetodo = recetaEsDelMetodo;
const cocinaModoRecetas = fn('cocinaModoRecetas', ctx);
ctx.cocinaModoRecetas = cocinaModoRecetas;
const cocinaModoApagado = fn('cocinaModoApagado', ctx);
ctx.cocinaModoApagado = cocinaModoApagado;
const cocinaHubHTML = fn('cocinaHubHTML', ctx);
const renderRecipesSrc = extractFunc('renderRecipes');

/* ---------- 1. Definición de los 4 modos ---------- */
t('COCINA_MODOS tiene 4 modos', COCINA_MODOS.length === 4);
t('IDs únicos', new Set(COCINA_MODOS.map(m => m.id)).size === 4);
const nombres = COCINA_MODOS.map(m => m.nombre).join(' | ');
t('Modos iniciales correctos', ['Thermomix TM6', 'Horno', 'Air Fryer', 'Sartén'].every(n => nombres.includes(n)));
COCINA_MODOS.forEach(m => {
  const imgPath = path.join(__dirname, '..', m.img);
  t(m.id + ': imagen local existe', fs.existsSync(imgPath), m.img);
  if (fs.existsSync(imgPath)) {
    const buf = fs.readFileSync(imgPath);
    t(m.id + ': imagen JPEG válida', buf[0] === 0xFF && buf[1] === 0xD8, (buf.length / 1024).toFixed(0) + ' KB');
    t(m.id + ': imagen con peso razonable', buf.length > 40 * 1024, (buf.length / 1024).toFixed(0) + ' KB');
  }
  t(m.id + ': tiene nombre, descripción y emoji', !!(m.nombre && m.desc && m.emoji));
  t(m.id + ': acción válida', m.accion === 'tab' || m.accion === 'metodo', m.accion);
});

/* ---------- 2. Navegación existente ---------- */
const tm6 = COCINA_MODOS.find(m => m.id === 'tm6');
t('TM6 abre una pestaña real del sistema', tm6.accion === 'tab' && HTML.includes(`'${tm6.tab}'`), tm6.tab);
COCINA_MODOS.filter(m => m.accion === 'metodo').forEach(m => {
  t(m.id + ': método declarado y presente en el filtro de Recetas', !!m.metodo && renderRecipesSrc.includes(`recetaEsDelMetodo(r,m)`), m.metodo);
});
t('renderRecipes usa la MISMA regla de compatibilidad que las tarjetas', /\(\(m==='airfryer'\|\|m==='sarten'\)&&recetaEsDelMetodo\(r,m\)\)/.test(renderRecipesSrc));

/* ---------- 3. Compatibilidad real sobre las 610 recetas ---------- */
const porModo = {};
COCINA_MODOS.filter(m => m.accion === 'metodo').forEach(m => {
  const lista = cocinaModoRecetas(m.metodo);
  porModo[m.id] = lista;
  t(m.id + ': tiene recetas compatibles (' + lista.length + ')', lista.length > 0);
  t(m.id + ': sin duplicados', new Set(lista).size === lista.length);
});
t('horno: todas las compatibles declaran horno en su método', porModo.horno.every(r => String(r.method).toLowerCase().includes('horno')));
t('airfryer: todas declaran air fryer en su método', porModo.airfryer.every(r => /air\s?fryer|freidora de aire/.test(String(r.method).toLowerCase())));
t('sartén: todas son de la familia estufa y mencionan sartén/comal', porModo.sarten.every(r => methodKeyOf(r.method) === 'estufa' && /sart[ée]n|comal/.test((r.method + ' ' + (r.steps || []).join(' ')).toLowerCase())));
t('horno no se traga recetas sin cocinar', !porModo.horno.some(r => /sin cocinar/.test(String(r.method).toLowerCase())));
t('airfryer no se traga recetas de estufa', !porModo.airfryer.some(r => r === undefined || methodKeyOf(r.method) === 'estufa'));
t('sartén no incluye recetas solo de olla', !porModo.sarten.some(r => /olla/.test(String(r.method)) && !/sart[ée]n|comal/.test(String(r.method))));
// Solapamientos honestos: un modo puede compartir recetas si usa los dos equipos,
// pero la regla de sartén solo admite llave estufa (nunca horno puro).
t('sartén nunca incluye recetas horno puras', !porModo.sarten.some(r => String(r.method).toLowerCase().includes('horno') && !String(r.method).toLowerCase().includes('estufa')));

/* ---------- 4. Casos límite de recetaEsDelMetodo ---------- */
const fixture = [
  [{ method: 'estufa', steps: ['Sartén BIEN caliente 4 min.'] }, 'sarten', true, 'estufa con sartén'],
  [{ method: 'sarten', steps: ['Dora 3 min.'] }, 'sarten', true, 'método sartén'],
  [{ method: 'sartén', steps: ['Fríe.'] }, 'sarten', true, 'método sartén con acento'],
  [{ method: 'olla', steps: ['Hierve 20 min.'] }, 'sarten', false, 'olla no es sartén'],
  [{ method: 'horno', steps: ['Hornea 20 min.'] }, 'sarten', false, 'horno no es sartén'],
  [{ method: 'horno', steps: ['Hornea.'] }, 'horno', true, 'horno puro'],
  [{ method: 'estufa y horno', steps: ['Guisa y hornea.'] }, 'horno', true, 'combinado cuenta para horno'],
  [{ method: 'air fryer', steps: ['Aire caliente 15 min.'] }, 'airfryer', true, 'air fryer'],
  [{ method: 'air fryer', steps: [] }, 'horno', false, 'air fryer no es horno'],
  [{ method: 'estufa', steps: ['Calienta.'] }, 'airfryer', false, 'estufa no es air fryer'],
  [{ method: 'comal', steps: ['Tuesta tortillas.'] }, 'sarten', true, 'comal cuenta como sartén'],
  [{ method: 'sin cocinar', steps: ['Mezcla.'] }, 'sarten', false, 'sin cocinar nunca es sartén']
];
fixture.forEach(([r, m, esperado, caso]) => {
  t('caso: ' + caso, recetaEsDelMetodo(r, m) === esperado, JSON.stringify(r.method));
});

/* ---------- 5. Tarjetas: HTML y chips ---------- */
const html = cocinaHubHTML();
COCINA_MODOS.forEach(m => {
  t(m.id + ': tarjeta presente con nombre', html.includes('>`'.slice(0, 0) + m.nombre + '<') || html.includes(m.nombre), m.nombre);
  t(m.id + ': tarjeta con imagen local', html.includes('src="' + m.img + '"'), m.img);
  t(m.id + ': tarjeta accesible (role=button)', html.includes('role="button"'));
});
t('hub: 4 tarjetas exactas', (html.match(/class="cocina-card/g) || []).length === 4);
COCINA_MODOS.filter(m => m.accion === 'metodo').forEach(m => {
  const n = cocinaModoRecetas(m.metodo).length;
  t(m.id + ': chip muestra el conteo real (' + n + ')', html.includes(n + ' recetas'), n + ' recetas');
});
t('tm6: chip sin conteo engañoso (guía, sin recetas no comprobadas)', html.includes('Guía completa'));

/* ---------- 6. Aparato apagado en Mi cocina (mismo sistema de modos) ---------- */
const ctxOff = { ...ctx, _aparatoEncendido: id => id !== 'horno' };
const cocinaModoApagadoOff = vm.runInNewContext('(' + extractFunc('cocinaModoApagado') + ')', ctxOff);
ctxOff.cocinaModoApagado = cocinaModoApagadoOff;
const cocinaHubHTMLOff = vm.runInNewContext('(' + extractFunc('cocinaHubHTML') + ')', { ...ctxOff, COCINA_MODOS, baseRecipes: base, safeText: s => String(s) })();
t('horno apagado se detecta', cocinaModoApagadoOff(COCINA_MODOS.find(m => m.id === 'horno')) === true);
t('sartén encendida se detecta', cocinaModoApagadoOff(COCINA_MODOS.find(m => m.id === 'sarten')) === false);
t('tarjeta apagada muestra aviso', cocinaHubHTMLOff.includes('Apagado en Mi cocina') && cocinaHubHTMLOff.includes('⏻ Apagado'));
t('tarjeta apagada usa clase off', cocinaHubHTMLOff.includes('cocina-card off'));

/* ---------- 7. Integración con secRecetas y navegación ---------- */
t('secRecetas incluye el hub arriba de la calculadora', /function secRecetas\(\)\{[\s\S]*?\$\{cocinaHubHTML\(\)\}[\s\S]*?f3CalcAlimHTML/.test(HTML));
t('abrirCocinaModo reutiliza openTab y setRecipeMethod', /function abrirCocinaModo\(id\)\{[\s\S]*?openTab[\s\S]*?setRecipeMethod/.test(HTML));
t('abrirCocinaModo despliega Mi cocina para el aparato apagado', /function abrirCocinaModo\(id\)\{[\s\S]*?panelCocina[\s\S]*?closest\('details'\)\.open=true/.test(HTML));
t('etiquetas nuevas en el filtro', /sarten:'🍳 Recetas en sartén'/.test(HTML) && /airfryer:'💨 Recetas en air fryer'/.test(HTML));
t('recetaFiltroDesc muestra nombres legibles', /m==='sarten'\?'Sartén':\(m==='airfryer'\?'Air fryer':m\)/.test(HTML));
t('apagar estación refresca las tarjetas del hub en vivo', /function toggleEstacion\(id\)\{[\s\S]*?hub\.outerHTML=cocinaHubHTML\(\)/.test(HTML));

/* ---------- 7b. Pestaña Thermomix TM6 y filtro honesto ---------- */
t('la pestaña visible se llama Thermomix TM6 (sin TM5 visible)', /'🤖 Thermomix TM6'/.test(HTML) && !/Thermomix TM5/.test(HTML));
t('filtro thermomix SOLO recetas con modo TM real (no marca adaptaciones como verificadas)', /m==='thermomix'\)\{match=recipeMethods\(r\)\.some\(function\(x\)\{return x\.key==='thermomix';\}\);\}/.test(renderRecipesSrc));
const mKM = HTML.match(/const KITCHEN_METHODS=\{([\s\S]*?)\};\s*const KITCHEN_TOOLS_ORDER/);
if (!mKM) throw new Error('No se encontró KITCHEN_METHODS');
const KITCHEN_METHODS = vm.runInNewContext('({' + mKM[1] + '})');
const recipeMethods = fn('recipeMethods', { ...ctx, KITCHEN_METHODS });
ctx.recipeMethods = recipeMethods;
const tmVerificadas = base.filter(r => recipeMethods(r).some(x => x.key === 'thermomix'));
t('modo thermomix tiene recetas reales (' + tmVerificadas.length + ')', tmVerificadas.length > 0);
t('modo thermomix: ninguna es una receta ajena (todas declaran modo TM)', tmVerificadas.every(r => recipeMethods(r).some(x => x.key === 'thermomix')));
t('etiqueta del filtro thermomix ya no dice "todas las adaptadas"', /thermomix:'🤖 Recetas con modo Thermomix'/.test(HTML));

/* ---------- 8. Publicación en sincronía (checklist) ---------- */
const verApp = (HTML.match(/window\.HM_APP_VERSION='([^']+)'/) || [])[1];
t('HM_APP_VERSION detectado', !!verApp, verApp);
t('version.json latest coincide con HM_APP_VERSION', VER.latest === verApp, VER.latest + ' vs ' + verApp);
t('CACHE del service worker coincide con la versión', SW.includes('mi-proyecto-v' + verApp.replace(/\./g, '-')), 'mi-proyecto-v' + verApp.replace(/\./g, '-'));
['tm6', 'horno', 'airfryer', 'sarten'].forEach(f => {
  t('sw precachea ' + f + '.jpg (offline)', SW.includes('./assets/cocina/' + f + '.jpg'));
});
t('version.json tiene entrada de historia para la versión', VER.history.some(h => h.version === verApp));

/* ---------- Resumen ---------- */
console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
if (falladas > 0) process.exit(1);
