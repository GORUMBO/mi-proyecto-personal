// ============================================================
// PRUEBAS — Fotos de alimentos en Comer (guía de verduras, al
// horno y Nevera). Reglas: el emoji actual es el FALLBACK; donde
// no hay foto confiable se conserva. Nada de fotos equivocadas:
// el mapa es por clave normalizada con sinónimos explícitos.
// Uso: node tests/alimentos-fotos.test.js
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

/* ---------- 1. Mapa y archivos ---------- */
const mMapa = HTML.match(/const ALIMENTO_FOTOS=\{\s*([\s\S]*?)\};\s*function alimentoKey/);
if (!mMapa) throw new Error('No se encontró ALIMENTO_FOTOS');
let ALIMENTO_FOTOS = {};
try { ALIMENTO_FOTOS = vm.runInNewContext('({' + mMapa[1] + '})'); } catch (e) { ALIMENTO_FOTOS = {}; }
const claves = Object.keys(ALIMENTO_FOTOS);
t('ALIMENTO_FOTOS generado con entradas (≥60)', claves.length >= 60, String(claves.length));
t('al menos 50 fotos distintas (los sinónimos comparten foto)', new Set(claves.map(k => ALIMENTO_FOTOS[k].img)).size >= 50, String(new Set(claves.map(k => ALIMENTO_FOTOS[k].img)).size));
t('todas con fuente/atribución', claves.every(k => !!ALIMENTO_FOTOS[k].fuente));
claves.forEach(k => {
  const p = path.join(__dirname, '..', ALIMENTO_FOTOS[k].img);
  if (!fs.existsSync(p)) { t('archivo existe: ' + k, false, ALIMENTO_FOTOS[k].img); return; }
  const buf = fs.readFileSync(p);
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) t('JPEG válida: ' + k, false);
  else if (buf.length < 8 * 1024) t('peso razonable: ' + k, false, (buf.length / 1024).toFixed(0) + ' KB');
});
t('créditos de alimentos presentes', /Créditos de las fotografías de alimentos/.test(fs.readFileSync(path.join(__dirname, '..', 'assets', 'alimentos', 'CREDITOS.md'), 'utf8')));

/* ---------- 2. Normalización y sinónimos ---------- */
const ctx = { ALIMENTO_FOTOS };
ctx.alimentoKey = vm.runInNewContext('(' + extractFunc('alimentoKey') + ')', ctx);
const alimentoKey = ctx.alimentoKey;
const alimentoFoto = vm.runInNewContext('(' + extractFunc('alimentoFoto') + ')', ctx);
t('normaliza acentos y mayúsculas', alimentoKey('Zanahoria') === 'zanahoria' && alimentoKey('FRÍJOL') === 'frijol');
t('quita paréntesis', alimentoKey('Papa (en gajos)') === 'papa');
t('quita cantidades y palabras vacías', alimentoKey('Leche 2%') === 'leche' && alimentoKey('1 taza de arroz') === 'arroz');
t('sinónimo: leche 2% → foto de leche', !!alimentoFoto('leche 2%'));
t('sinónimo: pollo rostizado → foto de pollo', !!alimentoFoto('pollo rostizado'));
t('sin foto → null (no inventa)', alimentoFoto('producto inventado xyz') === null);

/* ---------- 3. Cobertura de las listas reales de la app ---------- */
function listaNombres(txt) {
  const m = txt.match(/const VEGGIES=\[([\s\S]*?)\];\n/);
  if (!m) return [];
  const nombres = [];
  const re = /\{n:'([^']+)'/g;
  let x; while ((x = re.exec(m[1]))) nombres.push(x[1]);
  return nombres;
}
const mQuick = HTML.match(/(?:var|const) quickFoods=\[([^\]]+)\]/);
const quick = mQuick ? vm.runInNewContext('(' + mQuick[0].slice(mQuick[0].indexOf('=') + 1) + ')') : [];
const mVeg = listaNombres(HTML);
const mOven = HTML.match(/const OVEN=\[([\s\S]*?)\];\n/);
const oven = [];
if (mOven) { const re = /\{n:'([^']+)'/g; let x; while ((x = re.exec(mOven[1]))) oven.push(x[1]); }
const mFridge = HTML.match(/const fridgeCats=\{([\s\S]*?)\};/);
const fridge = [];
if (mFridge) { const re = /'([^']+)'/g; let x; while ((x = re.exec(mFridge[1]))) fridge.push(x[1]); }
function cobertura(lista, label, min) {
  const con = lista.filter(n => alimentoFoto(n)).length;
  const pct = lista.length ? Math.round(100 * con / lista.length) : 0;
  t(label + ': cobertura con foto (' + con + '/' + lista.length + ')', pct >= min, pct + '%');
}
cobertura(mVeg, 'verduras (guía)', 50);
cobertura(oven, 'al horno (guía)', 50);
cobertura(quick, 'accesos rápidos de Nevera', 50);
cobertura(fridge, 'catálogo de Nevera', 40);

/* ---------- 4. Cableado de UI ---------- */
const renderVeggiesSrc = extractFunc('renderVeggies');
const renderHornoSrc = extractFunc('renderHorno');
t('guía de verduras usa fotos con fallback emoji', /alimentoFotoHTML\(v\.n,'l'\)/.test(renderVeggiesSrc));
t('guía al horno usa fotos con fallback emoji', /alimentoFotoHTML\(o\.n,'l'\)/.test(renderHornoSrc));
t('Nevera: accesos rápidos con foto', /\$\{alimentoFotoHTML\(x,'s'\)\}/.test(HTML));
t('Nevera: categorías completas con foto', /arr\.map\(x=>`<button class="pill pick fridge-item"[\s\S]*?alimentoFotoHTML\(x,'s'\)/.test(HTML));
t('calculadora de alimentos usa foto', /calc-food-icon">\$\{alimentoFotoHTML\(f\[0\],'m'\)\}/.test(HTML));
t('créditos dentro de la app (guía verduras + horno + Nevera)', (HTML.match(/alimentosCreditosHTML\(\)/g) || []).length >= 3, String((HTML.match(/alimentosCreditosHTML\(\)/g) || []).length));
t('fallback emoji intacto en el helper', /if\(!f\)return '<span class="alim-foto alim-'\+tam\+'"><span class="alim-emoji">'\+emoji\+'<\/span><\/span>'/.test(HTML));

/* ---------- Resumen ---------- */
console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
if (falladas > 0) process.exit(1);
