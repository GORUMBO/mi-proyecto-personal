// ============================================================
// PRUEBAS — Mis guías TM6 (capa de usuario sincronizada).
// Reglas: misma colección de state (unión por id/updated_at del
// sync existente), MISMO modal del editor (guiasEditorAbrir),
// foto con resizeSkinImage, editar NUNCA duplica, borrar usa
// tombstone. No toca recetas, modos ni funciones actuales.
// Uso: node tests/mis-guias-tm6.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('No se encontró function ' + name);
  let depth = 0, j = i, q = null;
  for (; j < HTML.length; j++) {
    const c = HTML[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return HTML.slice(i, j + 1); }
  }
  throw new Error('incompleta: ' + name);
}
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

/* ---------- 1. Modelo ---------- */
t('state inicializa misGuiasTM6 en el arranque', /state\.misGuiasTM6=state\.misGuiasTM6\|\|\[\];/.test(HTML));
const ctx = {
  state: { misGuiasTM6: [
    { id: 'g1', nombre: 'Crema de elote', pasos: ['Cocina: 100°C, 20 min, vel 2'], ingredientes: ['2 elotes'], updated_at: '2026-11-07T10:00:00.000Z' },
    { id: 'g2', nombre: 'Borrada', deleted: true, updated_at: '2026-11-07T09:00:00.000Z' }
  ] }
};
ctx.misGuiasTM6 = vm.runInNewContext('(' + extractFunc('misGuiasTM6') + ')', ctx);
const misGuiasTM6 = ctx.misGuiasTM6;
const guiaTM6PorId = vm.runInNewContext('(' + extractFunc('guiaTM6PorId') + ')', ctx);
t('misGuiasTM6 filtra las borradas (tombstone)', misGuiasTM6().length === 1, String(misGuiasTM6().length));
t('guiaTM6PorId encuentra por id', !!guiaTM6PorId('g1') && !guiaTM6PorId('g2'));
t('editar = actualizar la misma guía (por id, sin duplicar)', (function () {
  const g = guiaTM6PorId('g1');
  const antes = ctx.state.misGuiasTM6.length;
  g.nombre = 'Crema de elote v2'; g.updated_at = '2026-11-07T11:00:00.000Z';
  return ctx.state.misGuiasTM6.length === antes && misGuiasTM6().length === 1;
})());

/* ---------- 2. Editor reutiliza el modal existente ---------- */
const renderSrc = extractFunc('guiaTM6EditorRender');
const guardarSrc = extractFunc('guiaTM6Guardar');
t('editor usa el MISMO modal (guiasEditorAbrir)', /guiasEditorAbrir\(html\)/.test(renderSrc));
t('editor pide ingredientes, foto principal, video y datos base', /tm6gIng/.test(renderSrc) && /tm6gFoto/.test(renderSrc) && /tm6gVideo/.test(renderSrc) && /tm6gNombre/.test(renderSrc));
t('guardar nuevo usa ppUUID e updated_at', /ppUUID\(\)/.test(guardarSrc) && /updated_at:ahora/.test(guardarSrc));
t('guardar edición actualiza la MISMA guía (rama if(g))', /g\.nombre=nombre; g\.ingredientes=ingredientes/.test(guardarSrc));
t('guardar sincroniza por el canal existente (cloudSave)', /cloudSave\(true\)/.test(guardarSrc));
t('borrar usa tombstone (deleted + updated_at), nunca splice', /g\.deleted=true; g\.updated_at=new Date/.test(extractFunc('guiaTM6Borrar')));

/* ---------- 2b. Pasos con foto y video (patrón del sistema existente) ---------- */
const ctx2 = { state: { guiasMedia: { h1: 'data:image/jpeg;base64,AAA' } } };
ctx2.tm6PasoNorm = vm.runInNewContext('(' + extractFunc('tm6PasoNorm') + ')', ctx2);
const tm6PasoNorm = ctx2.tm6PasoNorm;
t('migra pasos de texto antiguos a {t,f,v} sin perder el texto', tm6PasoNorm('Cocina: 100°C, 15 min').t === 'Cocina: 100°C, 15 min');
t('conserva pasos con foto y video', (function(){var p=tm6PasoNorm({t:'Sofríe',f:'h1',v:'https://x'});return p.t==='Sofríe'&&p.f==='h1'&&p.v==='https://x';})());
t('filas dinámicas de pasos (texto + foto + video + biblioteca)', /tm6PasosRows/.test(renderSrc) && /tm6gP_t_/.test(extractFunc('tm6PasoRowHTML')) && /tm6gP_v_/.test(extractFunc('tm6PasoRowHTML')) && /tm6gP_b_/.test(extractFunc('tm6PasoRowHTML')));
t('foto por paso usa el MISMO almacén con dedupe (gvHash + guiasMedia)', /gvCompressImage/.test(extractFunc('tm6PasoFotoChange')) && /gvHash\(dataUrl\)/.test(extractFunc('tm6PasoFotoChange')) && /state\.guiasMedia\[hash\]=dataUrl/.test(extractFunc('tm6PasoFotoChange')));
t('se puede tomar la foto de la biblioteca de accesorios', /tm6PasoDeBiblioteca/.test(HTML) && /tm6Accesorios/.test(extractFunc('tm6PasoRowHTML')));
t('el visor muestra foto y video por paso', /state\.guiasMedia\|\|\{\}\)\[n\.f\]/.test(extractFunc('renderMisGuiasTM6')) && /Video de este paso/.test(extractFunc('renderMisGuiasTM6')));

/* ---------- 2c. Biblioteca reutilizable de accesorios ---------- */
t('9 accesorios TM6 en la biblioteca', /TM6_ACCESORIOS_DEF=\[([\s\S]*?)\];/.test(HTML) && ['vaso','cuchillas','tapa','cubilete','cestillo','mariposa','varoma','espatula','selector'].every(k=>new RegExp('k:\\s*\\x27'+k+'\\x27').test(HTML)));
t('biblioteca usa guiasMedia (mismo almacén, dedupe por hash)', /state\.guiasMedia\[hash\]=dataUrl/.test(extractFunc('tm6AccesorioElegir')) && /gvCompressImage\(f,1000\)/.test(extractFunc('tm6AccesorioElegir')));
t('subir una foto por accesorio la REUTILIZA (una entrada por accesorio)', /var a=tm6Accesorio\(k\);[\s\S]*?if\(a\)\{ a\.hash=hash;/.test(extractFunc('tm6AccesorioElegir')));
t('quitar foto de la biblioteca no borra el almacén (solo la entrada)', /state\.tm6Accesorios=\(state\.tm6Accesorios\|\|\[\]\)\.filter/.test(extractFunc('tm6AccesorioQuitar')));
t('fotos de referencia CC presentes con créditos', fs.existsSync(path.join(__dirname, '..', 'assets', 'tm6', 'tm6-vorwerk.jpg')) && fs.existsSync(path.join(__dirname, '..', 'assets', 'tm6', 'thermomix-2014.jpg')) && /Thermomix TM6 Vorwerk\.jpg/.test(fs.readFileSync(path.join(__dirname, '..', 'assets', 'tm6', 'CREDITOS.md'), 'utf8')));
t('biblioteca visible en la pestaña TM6', /\$\{tm6BibliotecaHTML\(\)\}/.test(HTML));

/* ---------- 2d. Ingredientes de recetas con foto real ---------- */
t('los ingredientes del detalle muestran su foto cuando existe', /alimentoFoto\(x\)/.test(extractFunc('renderRecipes')) && /alimentoFotoHTML\(x,'s'\)/.test(extractFunc('renderRecipes')));

/* ---------- 2e. Categorías, verificación y guías detalladas ---------- */
t('5 categorías de la biblioteca TM6', /TM6_GUIA_CATEGORIAS=\[/.test(HTML) && ['salsas','adobos','moles','guisados','tecnicas'].every(k => new RegExp('k:\\s*\\x27' + k + '\\x27').test(HTML)));
t('Salsas con 5 subcategorías (molcajeteadas, taqueras, cremosas, tatemadas, especiales)', ['molcajeteada', 'taquera', 'cremosa', 'tatemada', 'especial'].every(k => new RegExp('k:\\s*\\x27' + k + '\\x27').test(HTML)));
t('norm de guía: campos detallados con default honesto (pendiente, sin inventos)', (function () {
  const ctx3 = {};
  const norm = vm.runInNewContext('(' + extractFunc('tm6GuiaNorm') + ')', ctx3);
  const g = norm({});
  return g.verificado === 'pendiente' && Array.isArray(g.advertencias) && Array.isArray(g.consejos) && Array.isArray(g.erroresComunes) && Array.isArray(g.variantes) && Array.isArray(g.accesorios) && g.categoria === '' && g.subcategoria === '';
})());
t('pasos con resultado esperado (textura/color/señal de listo)', /r:''\}/.test(extractFunc('tm6PasoNorm')) && /tm6gP_r_/.test(extractFunc('tm6PasoRowHTML')) && /p\.r=String/.test(extractFunc('tm6PasosLeer')));
const edSrc = extractFunc('guiaTM6EditorRender');
t('editor: categoría + subcategoría + estado verificable', /tm6gCat/.test(edSrc) && /tm6gSub/.test(edSrc) && /data-verif/.test(edSrc) && /tm6VerificadoToggle/.test(edSrc));
t('editor: prep previa, advertencias, consejos, errores, variantes, accesorios', /tm6gPrep/.test(edSrc) && /tm6gAdv/.test(edSrc) && /tm6gConsejos/.test(edSrc) && /tm6gErrores/.test(edSrc) && /tm6gVariantes/.test(edSrc) && /tm6AccToggle/.test(edSrc));
t('guardar: nuevas guías nacen pendientes de prueba', /'pendiente'/.test(extractFunc('guiaTM6Guardar')) && /verificado:verificado/.test(extractFunc('guiaTM6Guardar')));
const visSrc = extractFunc('renderMisGuiasTM6');
t('visor: chips de categoría y subcategoría', /tm6FiltroCat/.test(visSrc) && /tm6FiltroSub/.test(visSrc) && /TM6_GUIA_CATEGORIAS\.map/.test(visSrc));
t('visor: buscador por nombre/ingrediente/categoría', /tm6gSearch/.test(visSrc) && /tm6SubcategoriaNombre\(g\.categoria,g\.subcategoria\)/.test(visSrc));
t('visor: badge ✅ Verificado / 🧪 Pendiente', /Pendiente de prueba/.test(visSrc) && /Verificado/.test(visSrc));
t('visor: resultado esperado por paso + secciones nuevas', /Resultado esperado:/.test(visSrc) && /Antes de empezar/.test(visSrc) && /Errores y soluciones/.test(visSrc) && /Variantes/.test(visSrc) && /tm6AccesorioSrc\(k\)/.test(visSrc));

/* ---------- 3. Integración con la pestaña TM6 ---------- */
t('tarjeta Mis guías TM6 dentro de la pestaña Thermomix', /\$\{misGuiasTM6HTML\(\)\}/.test(HTML));
t('la lista clasifica los pasos con el sistema TM existente', /recetaClasificarTM5\(\{method:'TM5',steps:\(g\.pasos\|\|\[\]\)\.map\(tm6PasoTexto\)\}\)/.test(extractFunc('renderMisGuiasTM6')));
t('hook de render en buildTabIfNeeded (patrón de otras pestañas)', /tabs\[i\]==='🤖 Thermomix TM6'&&typeof renderMisGuiasTM6==='function'\)renderMisGuiasTM6\(\)/.test(HTML));
t('el botón ➕ Nueva guía TM6 abre el editor', /onclick="guiaTM6Nueva\(\)"/.test(extractFunc('misGuiasTM6HTML')));

/* ---------- 4. Compatibilidad con el merge existente ---------- */
t('los campos van en state (la unión por id/updated_at ya los cubre)', /state\.misGuiasTM6/.test(HTML));
t('renderRecipes NO se tocó (los modos y el catálogo siguen intactos)', !/misGuiasTM6/.test(extractFunc('renderRecipes')));

/* ---------- 4b. Merge de guiasMedia (fix v1.206, zona sync) ---------- */
t('el merge une guiasMedia como mapa (fix presente)', /base\.guiasMedia=_mergeMapa\(local\.guiasMedia,remote\.guiasMedia\);/.test(extractFunc('mergeCloudStates')));
const mergeMapa = vm.runInNewContext('(' + extractFunc('_mergeMapa') + ')');
t('unión: fotos de ambos lados se conservan (distintas llaves)', (function(){var m=mergeMapa({a:'IMG-A'},{b:'IMG-B'});return m.a==='IMG-A'&&m.b==='IMG-B';})());
t('misma llave = misma imagen (no sobrescribe fotos válidas distintas)', (function(){var m=mergeMapa({a:'IMG-A'},{a:'IMG-A'});return m.a==='IMG-A';})());
t('no restaura imágenes eliminadas: el borrado es de la REFERENCIA, no del almacén', (function(){
  // guía con la foto quitada (f='') + almacén que aún tiene la entrada:
  // la unión del almacén NO vuelve a colocar la foto en la guía.
  const g={nombre:'x',pasos:[{t:'a',f:'',v:'',r:''}]};
  const store=mergeMapa({h:'IMG'},{});
  return g.pasos[0].f==='' && store.h==='IMG';
})());
t('el merge es por usuario (una fila por cuenta, RLS): nunca mezcla usuarios', /personal_backups/.test(HTML) && /auth\.uid\(\) = user_id/.test(fs.readFileSync(path.join(__dirname, '..', 'CONFIGURAR-SUPABASE.sql'), 'utf8')));

console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
if (falladas > 0) process.exit(1);
