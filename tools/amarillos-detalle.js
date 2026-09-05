// Lista los pasos 🟡 con datos en otros pasos de la MISMA receta.
const fs = require('fs');
const path = require('path');
const rep = JSON.parse(fs.readFileSync(path.join(__dirname, 'auditoria-report.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'recetas-dump.json'), 'utf8'));
const porIdx = {};
dump.forEach(r => { porIdx[r.i] = r; });

let n = 0;
rep.pasosAmarillos.filter(x => x.conDatos.length).forEach(x => {
  const r = porIdx[x.idx];
  n++;
  console.log('--- ' + n + '. [' + x.idx + '] ' + x.receta + ' | tipo=' + x.tipo + ' | temp=' + (r && r.temp ? r.temp : '-'));
  console.log('    paso ' + x.paso + ' 🟡: ' + x.texto);
  x.conDatos.forEach(d => console.log('       dato en paso ' + d.paso + ': ' + d.texto));
});
console.log('TOTAL con datos:', n);
