// Diagnóstico por pestaña: mide scrollWidth en CADA pestaña de la app
// a ancho móvil (393 y 430) para encontrar la causa real del ancho extra.
// Uso: node tools/diag-tabs.js [puerto] [ancho1,ancho2,...]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));

const port = Number(process.argv[2] || 9337);
const widthsArg = (process.argv[3] || '393,430').split(',').map(Number).filter(Boolean);
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-diag-tabs-'));

async function getTarget() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/list');
      const list = await res.json();
      const t = list.find(x => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) {}
    await wait(500);
  }
  throw new Error('sin target CDP');
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

async function main() {
  const exe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const child = spawn(exe, [root, '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { stdio: 'ignore' });
  const target = await getTarget();
  const ws = await connect(target.webSocketDebuggerUrl);
  await ws.sendJson('Runtime.enable', {});
  await ws.sendJson('Page.enable', {});
  const ev = async (e) => {
    const m = await ws.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (m.result && m.result.exceptionDetails) return 'EXC:' + (m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text);
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  await wait(5000);
  await ev(`(()=>{try{state.onboarded=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1;})()`);

  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const widths = widthsArg;
  for (const w of widths) {
    const mobile = w < 768;
    await ws.sendJson('Emulation.setDeviceMetricsOverride', {
      width: w, height: 844, deviceScaleFactor: 3, mobile: mobile,
      screenWidth: w, screenHeight: 844, userAgent: mobile ? UA : ''
    });
    await wait(800);
    console.log('\n======== ' + w + 'px ========');
    for (const tab of ['🏠 Inicio','👤 Perfil','🍽️ Recetas','🥗 Nevera','💪 Ejercicio','⚖️ Peso','🚶 Caminata','🍱 Contador','💳 Gastos','💰 Presupuesto','🛒 Precios','🚗 Vehículos','🏡 Casa','🌺 Ahorro','👕 Ropa','🧴 Piel','❤️ Ligar','📊 Base datos','🧤 Trabajo','🤖 Thermomix TM5','🎯 Metas','🌎 Región','💸 Remesas','🗣️ Inglés','🔧 Aparatos']) {
      const r = await ev(`(()=>{
        try{openTab(${JSON.stringify(tab)});}catch(e){return {err:String(e)};}
        return new Promise(function(res){setTimeout(function(){
          var vw=window.innerWidth, doc=document.documentElement;
          var out={tab:${JSON.stringify(tab)},vw:vw,docSW:doc.scrollWidth,off:[]};
          if(doc.scrollWidth>vw+1){
            var all=document.querySelectorAll('#app *');
            for(var i=0;i<all.length;i++){
              var el=all[i];
              try{
                var r=el.getBoundingClientRect();
                if(r.width===0||r.right<=vw+2)continue;
                var tag=el.tagName.toLowerCase(), id=el.id?'#'+el.id:'', cls=(typeof el.className==='string'&&el.className)?('.'+String(el.className).split(' ').slice(0,2).join('.')):'';
                if(out.off.length<6)out.off.push(tag+id+cls+' L'+Math.round(r.left)+' R'+Math.round(r.right));
              }catch(e){}
            }
          }
          res(out);
        },500);});
      })()`);
      if (!r || r.err) { console.log('  ' + tab + ' ERROR ' + (r && r.err)); continue; }
      const ok = r.docSW <= r.vw + 1;
      console.log('  ' + (ok ? 'OK ' : 'OVERFLOW +' + (r.docSW - r.vw) + ' ') + tab + (r.off.length ? ' → ' + r.off.join(' | ') : ''));
    }
  }

  await wait(800);
  try { child.kill(); } catch (e) {}
  await wait(500);
  try { child.kill('SIGKILL'); } catch (e) {}
  console.log('\nListo.');
  process.exit(0);
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
