// Diagnóstico de ancho: lanza la app en Electron con CDP y mide
// scrollWidth vs innerWidth en cada ancho objetivo, listando los
// elementos que se salen del viewport (causa real de "pantalla ancha").
// Uso: node tools/diag-anchos.js [puerto]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));

const port = Number(process.argv[2] || 9336);
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-diag-'));

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
  const child = spawn(exe, [root, '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { stdio: 'ignore', detached: false });
  console.log('Electron lanzado (pid ' + child.pid + ', puerto ' + port + ')');
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
  // Preparar estado: saltar onboarding/overlays sin tocar datos reales
  await ev(`(()=>{try{state.onboarded=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});return 1;})()`);

  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const anchos = [320, 375, 390, 393, 402, 430, 768, 1280];
  for (const w of anchos) {
    const mobile = w < 768;
    await ws.sendJson('Emulation.setDeviceMetricsOverride', {
      width: w, height: 844, deviceScaleFactor: 3, mobile: mobile,
      screenWidth: w, screenHeight: 844,
      ...(mobile ? { userAgent: UA } : { userAgent: '' })
    });
    await wait(1200);
    const r = await ev(`(()=>{
      var vw=window.innerWidth;
      var doc=document.documentElement, body=document.body;
      var out={vw:vw, docSW:doc.scrollWidth, bodySW:body.scrollWidth, hh:0, offenders:[], headerW:0};
      var hdr=document.querySelector('header'); if(hdr)out.headerW=hdr.getBoundingClientRect().width;
      var all=document.querySelectorAll('body *');
      for(var i=0;i<all.length;i++){
        var el=all[i];
        try{
          var r=el.getBoundingClientRect();
          if(r.width===0)continue;
          var vis=!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
          if(!vis)continue;
          if(r.right>vw+1||r.left<-1){
            var tag=el.tagName.toLowerCase(), id=el.id?'#'+el.id:'', cls=(typeof el.className==='string'&&el.className)?('.'+String(el.className).split(' ').slice(0,2).join('.')):'';
            var off=Math.max(r.right-vw,0);
            if(off>3 && out.offenders.length<12) out.offenders.push(tag+id+cls+' L'+Math.round(r.left)+' R'+Math.round(r.right)+' +'+Math.round(off));
          }
        }catch(e){}
      }
      return out;
    })()`);
    console.log('\n== ' + w + 'px (mobile:' + mobile + ') ==');
    console.log('  innerWidth=' + r.vw + ' doc.scrollWidth=' + r.docSW + ' body.scrollWidth=' + r.bodySW + ' headerW=' + r.headerW);
    if (r.docSW > r.vw + 1) console.log('  DESBORDA +' + (r.docSW - r.vw));
    else console.log('  OK sin scroll horizontal');
    if (r.offenders.length) { console.log('  Fuera del viewport:'); r.offenders.forEach(o => console.log('    ' + o)); }
  }

  // Cierre limpio: dejar que guarde y salir sin forzar
  try { await ev(`setTimeout(function(){try{require('electron')}catch(e){window.close();}},100)`); } catch (e) {}
  await wait(1500);
  try { child.kill(); } catch (e) {}
  await wait(500);
  try { child.kill('SIGKILL'); } catch (e) {}
  console.log('\nListo.');
  process.exit(0);
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
