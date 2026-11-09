// ============================================================
// PRUEBAS — Biblioteca TM6: datos de las 49 guías (salsas + adobos).
// Valida el archivo tools/guias-biblioteca-data.js contra el esquema
// de la app y la subcategoría «Para cocinar» en TM6_GUIA_CATEGORIAS.
// Reglas: solo datos (nada de funciones nuevas); todas las guías
// nacen 'pendiente' — nunca se marcan verificadas sin prueba real.
// Uso: node tests/guias-biblioteca.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const { SALSAS, ADOBOS } = require('../tools/guias-biblioteca-data.js');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) pasadas++;
  else { falladas++; console.log('  ✗ ' + label + (extra ? ' → ' + extra : '')); }
}
// --- el archivo de datos ---
t('27 salsas + 22 adobos = 49 guías', SALSAS.length === 27 && ADOBOS.length === 22, SALSAS.length + '+' + ADOBOS.length);
const SUBS_S = new Set(['molcajeteada', 'taquera', 'cremosa', 'tatemada', 'especial', 'cocinar']);
const SUBS_A = new Set(['tradicionales', 'tacos', 'carnes', 'regionales', 'especiales']);
const ACCS = new Set(['vaso', 'cuchillas', 'tapa', 'cubilete', 'cestillo', 'mariposa', 'varoma', 'espatula', 'selector']);
const UNIDADES = /\d+\s*(g|kg|ml|l|cdita|cda|pieza|piezas|taza|oz|%)\b/i;
let nombres = new Set(), dupes = 0;
for (const [g, cat, subs] of [...SALSAS.map(x => [x, 'salsas', SUBS_S]), ...ADOBOS.map(x => [x, 'adobos', SUBS_A])]) {
  const id = cat + '/' + g.sub + ' · ' + g.nombre;
  if (nombres.has(g.nombre)) { dupes++; t(id + ': nombre duplicado', false); }
  nombres.add(g.nombre);
  if (!subs.has(g.sub)) { t(id + ': subcategoría inválida', false); continue; }
  if (!(g.kcal > 0)) t(id + ': kcal', false);
  if (!(g.tiempo > 0)) t(id + ': tiempo', false);
  if (g.ingredientes.length < 5) t(id + ': <5 ingredientes', false, String(g.ingredientes.length));
  if (g.ingredientes.some(i => !UNIDADES.test(i) && !/^\d+/.test(i))) t(id + ': ingrediente sin cantidad/unidad', false);
  if (g.pasos.length !== 6) t(id + ': pasos != 6', false, String(g.pasos.length));
  g.pasos.forEach((p, i) => {
    if (!p.t || p.t.length < 8) t(id + ': paso ' + (i + 1) + ' sin texto', false);
    if (!p.r) t(id + ': paso ' + (i + 1) + ' sin resultado esperado', false);
    const tm6 = /vel\s*\d|°C|giro|\d+\s*(seg|min)\b/i.test(p.t);
    const alt = /manual|tradicional|sin tm6|molcajete|metate|mortero|licuadora/i.test(p.t);
    if (!tm6 && !alt) t(id + ': paso ' + (i + 1) + ' sin TM6 ni alternativa manual', false);
  });
  if (g.pasos.some(p => /vel\s*\d|°C|giro|TM6/i.test(p.t)) && !/pendiente/i.test(g.prep))
    t(id + ': usa TM6 sin declarar parámetros pendientes', false);
  if (!g.adv.length) t(id + ': sin advertencias', false);
  if (!g.consejos.some(c => /❄️\s*Conservación/i.test(c))) t(id + ': sin conservación', false);
  g.errores.forEach((e, i) => { if (e.split('|').length !== 2) t(id + ': error ' + (i + 1) + ' sin Error | Solución', false); });
  if (!g.variantes.length) t(id + ': sin variantes', false);
  if (!g.accs.length || g.accs.some(a => !ACCS.has(a))) t(id + ': accesorios inválidos', false, JSON.stringify(g.accs));
  if (/cookidoo|vorwerk/i.test(JSON.stringify(g).slice(0, 400))) t(id + ': contenido ajeno (Cookidoo/Vorwerk)', false);
}
t('sin nombres duplicados', dupes === 0, String(dupes));
// --- subcategoría «Para cocinar» en la app (solo datos) ---
t('«Para cocinar» existe en TM6_GUIA_CATEGORIAS (salsas)',
  /\{k:'salsas',\s*n:'🌶️ Salsas mexicanas',\s*subs:\[[^\]]*\{k:'cocinar',n:'Para cocinar'\}/.test(HTML));
t('las 5 salsas de cocinar usan sub "cocinar"',
  ['Salsa ranchera', 'Salsa roja para enchiladas', 'Salsa verde para enchiladas', 'Salsa roja para chilaquiles', 'Salsa verde para chilaquiles']
    .every(n => { const g = [...SALSAS, ...ADOBOS].find(x => x.nombre === n); return g && g.sub === 'cocinar'; }));
console.log('\n=== ' + pasadas + ' pasadas · ' + falladas + ' falladas ===');
process.exit(falladas ? 1 : 0);
