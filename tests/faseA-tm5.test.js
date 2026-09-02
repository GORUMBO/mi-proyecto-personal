// ============================================================
// PRUEBAS TM5 — clasificación 🟢 completa / 🟡 asistida /
// ⚪ sin adaptación / 🔴 revisar. NO inventa parámetros.
// Uso: node tests/faseA-tm5.test.js
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
function extractVar(name) {
  const m = HTML.match(new RegExp('var ' + name + '=[^;\\n]+;'));
  if (!m) throw new Error('No se encontró ' + name);
  return vm.runInNewContext('(' + m[0].replace(new RegExp('^var ' + name + '='), '').replace(/;$/, '') + ')');
}

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

const NOMBRES = ['recetaPasoTM5', 'recetaPasoTM5Parametros', 'recetaClasificarTM5', 'recetaTM5TextoCorto', 'recetaTM5ListaHTML', 'recetaTiempoPaso'];
function sandbox() {
  const sb = {
    safeText: function (x) { return String(x == null ? '' : x); },
    RECETA_TM5_EXTERNO: extractVar('RECETA_TM5_EXTERNO'),
    RECETA_TM5_ACCION: extractVar('RECETA_TM5_ACCION'),
    RECETA_TM5_COCCION: extractVar('RECETA_TM5_COCCION')
  };
  NOMBRES.forEach(n => { sb[n] = vm.runInNewContext('(' + extractFunc(n) + ')', sb); });
  sb.globalThis = sb;
  return sb;
}
const sb = sandbox();

console.log('== 1 · Clasificación por paso ==');
(function () {
  t('licuar → tm5', sb.recetaPasoTM5('Licua todo 30 seg.') === 'tm5');
  t('freír → externo', sb.recetaPasoTM5('Fríe las tortillas 2 min hasta dorar.') === 'externo');
  t('hornear → externo', sb.recetaPasoTM5('Precalienta el horno a 200°C.') === 'externo');
  t('cocinar con tiempo+temperatura → tm5', sb.recetaPasoTM5('Cocina la salsa a 100°C, 10 min.') === 'tm5');
  t('neutro (corta/sirve)', sb.recetaPasoTM5('Corta las papas en cubos.') === 'neutro');
})();

console.log('== 2 · Clasificación de recetas ==');
(function () {
  const SALSA = { name: 'Salsa verde cocida', method: 'estufa', steps: ['Licua 6 tomatillos 30 seg.', 'Cocina la salsa a 100°C, 5 min.'] };
  t('salsa → 🟢 TM5 completa', sb.recetaClasificarTM5(SALSA).nivel === '🟢');
  const LICUADO = { name: 'Licuado', method: 'licuadora', steps: ['Licua todo 40 seg.'] };
  t('licuado → 🟢 completa', sb.recetaClasificarTM5(LICUADO).nivel === '🟢');
  const HORNO = { name: 'Galletas', method: 'horno', steps: ['Precalienta el horno a 180°C.', 'Hornea 22 min.'] };
  t('horno → ⚪ sin adaptación', sb.recetaClasificarTM5(HORNO).nivel === '⚪');
  const FRITURA = { name: 'Papas fritas', method: 'freidora', steps: ['Fríe las papas 5 min.', 'Sirve.'] };
  t('fritura → ⚪ sin adaptación', sb.recetaClasificarTM5(FRITURA).nivel === '⚪');
  const HIBRIDA = { name: 'Chilaquiles', method: 'estufa', steps: ['Fríe las tortillas 2 min.', 'Licua los tomates 30 seg.', 'Cocina la salsa 5 min a 100°C.', 'Incorpora huevos.', 'Sirve.'] };
  const cH = sb.recetaClasificarTM5(HIBRIDA);
  t('híbrida → 🟡 asistida', cH.nivel === '🟡');
  t('híbrida conserva pasos externos (en lista)', sb.recetaTM5ListaHTML(HIBRIDA, cH).includes('FUERA DE TM5') && sb.recetaTM5ListaHTML(HIBRIDA, cH).includes('Fríe las tortillas'));
  const TM5_INCOMPLETA = { name: 'TM5 masa para tortillas', method: 'TM5', steps: ['Amasa la harina.', 'Deja reposar.'] };
  t('TM5 sin parámetros → 🔴 revisar', sb.recetaClasificarTM5(TM5_INCOMPLETA).nivel === '🔴');
  const TM5_OK = { name: 'Arroz TM5', method: 'TM5', steps: ['Cocina el arroz: 100°C, 18 min, vel 1 con mariposa.'] };
  t('TM5 con parámetros → 🟢', sb.recetaClasificarTM5(TM5_OK).nivel === '🟢');
})();

console.log('== 3 · No inventa parámetros ==');
(function () {
  const t1 = sb.recetaPasoTM5Parametros('Licua todo.');
  t('paso sin parámetros → nota honesta', t1.tiene === false && t1.nota.includes('no incluye parámetros suficientes'));
  const t2 = sb.recetaPasoTM5Parametros('Licua todo: vel 7, 30 seg.');
  t('paso con parámetros → sin nota', t2.tiene === true && t2.nota === '');
})();

console.log('== 4 · 7 ejemplos obligatorios ==');
(function () {
  const CHILAQUILES = { name: 'Chilaquiles con huevo', method: 'estufa', steps: ['Calienta aceite en sartén.', 'Fríe tortillas 2 min.', 'Baja a fuego MEDIO (160°C), agrega salsa verde o roja.', 'Incorpora 2 huevos.', 'Sirve con crema, queso y cebolla.'] };
  t('1. Chilaquiles → 🟡 asistida', sb.recetaClasificarTM5(CHILAQUILES).nivel === '🟡');
  const SALSA_V_C = { name: 'Salsa verde cocida', method: 'estufa', steps: ['Hierve 6 tomatillos 8 min hasta cambiar color.', 'Escurre y licua con cebolla, ajo, cilantro, sal.', 'Sofríe en cazuela a fuego MEDIO (160°C) 3 min.'] };
  t('2. Salsa verde cocida → 🟢 completa (hervir+licuar+sofreír suave son capacidades TM5)', sb.recetaClasificarTM5(SALSA_V_C).nivel === '🟢');
  const LICUADO = { name: 'Licuado de fresa', method: 'licuadora', steps: ['Licua todo 40 seg.'] };
  t('3. Licuado → 🟢 completa', sb.recetaClasificarTM5(LICUADO).nivel === '🟢');
  const SOPA = { name: 'Crema de elote', method: 'estufa', steps: ['Licua 3 elotes 30 seg.', 'Cocina a 90°C, 20 min, vel 1.', 'Sazona.'] };
  t('4. Sopa/crema → 🟢 completa', sb.recetaClasificarTM5(SOPA).nivel === '🟢');
  const HORNO = { name: 'Pollo al horno', method: 'horno', steps: ['Precalienta el horno a 200°C.', 'Hornea 30 min.'] };
  t('5. Horno → ⚪ sin adaptación', sb.recetaClasificarTM5(HORNO).nivel === '⚪');
  const SARTEN = { name: 'Bistec encebollado', method: 'sarten', steps: ['Sella el bistec 3 min por lado.', 'Sirve.'] };
  t('6. Sartén (sellar) → ⚪ sin adaptación', sb.recetaClasificarTM5(SARTEN).nivel === '⚪');
  const MASA = { name: 'TM5 masa para tortillas', method: 'TM5', steps: ['Amasa la harina.', 'Deja reposar.'] };
  const cM = sb.recetaClasificarTM5(MASA);
  t('7. TM5 masa → 🔴 revisar con razón', cM.nivel === '🔴' && cM.razon.includes('sin parámetros'));
})();

console.log('== 5 · Textos claros de clasificación ==');
(function () {
  const c1 = sb.recetaClasificarTM5({ name: 'X', method: 'licuadora', steps: ['Licua todo 40 seg.'] });
  t('🟢 texto simple', sb.recetaTM5TextoCorto(c1).includes('puedes hacer toda esta receta'));
  const c2 = sb.recetaClasificarTM5({ name: 'Y', method: 'estufa', steps: ['Fríe 2 min.', 'Licua 30 seg.'] });
  t('🟡 texto con conteo', sb.recetaTM5TextoCorto(c2).includes('te ayuda con 1 de 2 pasos'));
  const c3 = sb.recetaClasificarTM5({ name: 'Z', method: 'horno', steps: ['Hornea 20 min.'] });
  t('⚪ texto honesto', sb.recetaTM5TextoCorto(c3).includes('no hay instrucciones TM5 suficientes'));
})();

console.log('===== RESULTADO: ' + pasadas + ' PASS / ' + falladas + ' FAIL =====');
if (falladas) process.exit(1);
