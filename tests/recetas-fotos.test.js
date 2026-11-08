// ============================================================
// PRUEBAS — Fotos del catálogo de recetas (muestra de 12).
// Reglas: no reconstruir el sistema de recetas; las fotos se
// agregan por NOMBRE EXACTO (mapa RECETA_FOTOS) y solo añaden
// campos foto/fotoFuente/fotoIlustrativa; nada de inventar
// recetas; filtro 📷 Con foto reutiliza el pipeline existente.
// Uso: node tests/recetas-fotos.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
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

let pasadas = 0, falladas = 0;
function t(label, ok, extra) {
  if (ok) { pasadas++; console.log('✓ ' + label + (extra ? ' · ' + extra : '')); }
  else { falladas++; console.log('✗ FALLA ' + label + (extra ? ' · ' + extra : '')); }
}

/* ---------- 1. Mapa RECETA_FOTOS ---------- */
const mFotos = HTML.match(/const RECETA_FOTOS=\{([\s\S]*?)\};\nfunction recetaFotosAplicar/);
if (!mFotos) throw new Error('No se encontró RECETA_FOTOS');
const RECETA_FOTOS = vm.runInNewContext('({' + mFotos[1] + '})');
const nombres = Object.keys(RECETA_FOTOS);
t('RECETA_FOTOS tiene la muestra de 12 recetas', nombres.length === 12, String(nombres.length));
t('imágenes únicas (sin duplicados)', new Set(nombres.map(n => RECETA_FOTOS[n].img)).size === 12);
t('todas con fuente/atribución', nombres.every(n => !!RECETA_FOTOS[n].fuente));
nombres.forEach(n => {
  const p = path.join(__dirname, '..', RECETA_FOTOS[n].img);
  t('archivo existe: ' + RECETA_FOTOS[n].img, fs.existsSync(p), n.slice(0, 40));
  if (fs.existsSync(p)) {
    const buf = fs.readFileSync(p);
    t('JPEG válida: ' + n.slice(0, 30), buf[0] === 0xFF && buf[1] === 0xD8, (buf.length / 1024).toFixed(0) + ' KB');
  }
});
t('créditos con las 12 filas', /assets\/recetas\//.test(fs.readFileSync(path.join(__dirname, '..', 'assets', 'recetas', 'CREDITOS.md'), 'utf8')));

/* ---------- 2. Los nombres existen REALMENTE en baseRecipes ---------- */
const { base } = buildBaseRecipes();
const noExisten = nombres.filter(n => !base.some(r => r.name === n));
t('los 12 nombres existen en el catálogo (no se inventan recetas)', noExisten.length === 0, noExisten.join(' | '));
const tipos = new Set(base.filter(r => nombres.includes(r.name)).map(r => r.type));
t('muestra de categorías distintas (≥6)', tipos.size >= 6, [...tipos].join(', '));

/* ---------- 3. Aplicación idempotente y no destructiva ---------- */
const ctx = { baseRecipes: JSON.parse(JSON.stringify(base)), window: {}, RECETA_FOTOS };
const recetaFotosAplicar = vm.runInNewContext('(' + extractFunc('recetaFotosAplicar') + ')', ctx);
const antes = JSON.stringify(ctx.baseRecipes);
recetaFotosAplicar();
recetaFotosAplicar(); // idempotente
const conFoto = ctx.baseRecipes.filter(r => r.foto);
t('aplica foto a exactamente 12 recetas', conFoto.length === 12, String(conFoto.length));
t('idempotente: aplicar dos veces no duplica nada', ctx.baseRecipes.filter(r => r.foto).length === 12);
const sinFoto = ctx.baseRecipes.filter(r => !r.foto);
t('no toca las recetas sin foto (campos nulos, datos intactos)', sinFoto.every(r => r.foto === undefined && r.fotoFuente === undefined && r.fotoIlustrativa === undefined));
const chila = ctx.baseRecipes.find(r => r.name === 'Chilaquiles con huevo');
t('los pasos/ingredientes siguen intactos tras aplicar', chila && Array.isArray(chila.steps) && chila.steps.length > 0 && !!chila.ingredients);

/* ---------- 4. Integración con renderRecipes / filtros ---------- */
const renderRecipesSrc = extractFunc('renderRecipes');
t('tarjeta incluye foto con fallback sin romper la tarjeta', /class="r2-foto'\+\(r\.fotoIlustrativa/.test(renderRecipesSrc) && /onerror="this\.parentElement\.remove\(\)"/.test(renderRecipesSrc));
t('tarjeta muestra método de cocción (píldora 🍳)', /r2-stat">🍳 \$\{safeText\(r\.method\)\}/.test(renderRecipesSrc));
t('filtro 📷 Con foto dentro del pipeline existente', /if\(window\._soloFoto\) arr=arr\.filter\(function\(r\)\{return !!r\.foto;\}\);/.test(renderRecipesSrc));
t('agrupado se desactiva con filtro activo (nunca "catálogo completo" falso)', /function recetaModoAgrupado\(tab,chip,s,sort,m,pf\)\{\s*if\(window\._soloFoto\)return false;/.test(HTML));
t('etiqueta honesta: "Con foto" en el contador', /function recetaFiltroDesc\(f,m,pf,s,tab,chip\)\{\s*if\(window\._soloFoto\)return 'Con foto';/.test(HTML));
t('botón 📷 Con foto en la barra de Recetas', /id="soloFotoBtn"[^>]*onclick="toggleSoloFoto\(\)"/.test(HTML));
t('recetaFotosAplicar se llama al renderizar la lista (defensivo, no rompe harnesses)', /function renderRecipes\(\)\{\s*let el=\$\('#recipes'\);if\(!el\)return;\s*try\{recetaFotosAplicar\(\);\}catch\(e\)\{\}/.test(HTML));

/* ---------- 5. Detalle con foto SIN alterar modos ---------- */
const detSrc = extractFunc('recetaDetalleHTML');
t('el detalle muestra la foto principal', /fotoDet='<div class="r-det-foto/.test(detSrc) && /return cab\+fotoDet\+meta\+recetaNutLine/.test(detSrc));
t('crédito visible dentro del detalle', /r-det-credito/.test(detSrc));
t('modos Rápido / Paso a paso / Completo intactos en el detalle', /recetaModo\(/.test(detSrc) && /'rapido'/.test(detSrc) && /'pasoapaso'/.test(detSrc) && /'completo'/.test(detSrc));
t('estilos .r2-foto presentes (responsive sin scroll horizontal)', /\.r2-foto\{[^}]*aspect-ratio:16\/10/.test(HTML) && /\.r-det-foto img\{[^}]*max-height:280px/.test(HTML));
t('contraste explícito de títulos y descripciones (claro y oscuro)', /\.recetas2 \.r2-name\{color:#12352a/.test(HTML) && /\.recetas2 \.r2-desc\{color:#44534b/.test(HTML) && /body\.dark \.recetas2 \.r2-name\{color:#e9f3ee/.test(HTML) && /body\.dark \.recetas2 \.r2-desc\{color:#c3d3cb/.test(HTML));
t('separación foto-texto: foto enmarcada con margen inferior', /\.r2-foto\{[^}]*border-radius:12px;margin-bottom:13px/.test(HTML));
t('separación de pills (estadísticas) y encabezado', /\.recetas2 \.r2-hd\{gap:12px/.test(HTML) && /\.recetas2 \.r2-stats\{gap:7px/.test(HTML) && /\.recetas2 \.r2-stat\{color:#12352a/.test(HTML));

/* ---------- Resumen ---------- */
console.log('\n' + pasadas + ' pasadas · ' + falladas + ' falladas');
if (falladas > 0) process.exit(1);
