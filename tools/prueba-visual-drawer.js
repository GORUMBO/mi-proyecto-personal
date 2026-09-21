// Capturas visuales del drawer y del responsive para revisión humana.
// Uso: node tools/prueba-visual-drawer.js [puerto]
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const wait = ms => new Promise(r => setTimeout(r, ms));

const port = Number(process.argv[2] || 9343);
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-vis-'));

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
  await ws.sendJson('Network.enable', {});
  const ev = async (e) => {
    const m = await ws.sendJson('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (m.result && m.result.exceptionDetails) return 'EXC:' + (m.result.exceptionDetails.exception ? m.result.exceptionDetails.exception.description : m.result.exceptionDetails.text);
    return m.result && m.result.result ? m.result.result.value : undefined;
  };
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const shot = async (name) => {
    const r = await ws.sendJson('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(root, 'tools', 'pruebas', name), Buffer.from(r.result.data, 'base64'));
    console.log('captura: ' + name);
  };
  await ws.sendJson('Network.setUserAgentOverride', { userAgent: UA });
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 393, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 393, screenHeight: 844 });
  await ws.sendJson('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(6500);
  await ev(`(()=>{try{state.onboarded=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});try{f3DrawerSync();}catch(e){}window.scrollTo(0,0);return 1;})()`);
  await ev(`showGroup('comer',false)`);
  await wait(600);
  await shot('drawer-movil-cerrado-393.png');
  await ev(`f3DrawerAbrir('izq')`);
  await wait(600);
  await shot('drawer-movil-abierto-393.png');
  await ev(`f3DrawerCerrar();`);
  // desktop
  await ws.sendJson('Network.setUserAgentOverride', { userAgent: '' });
  await ws.sendJson('Emulation.setDeviceMetricsOverride', { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false, screenWidth: 1280, screenHeight: 820 });
  await ws.sendJson('Page.reload', { ignoreCache: true });
  await wait(6500);
  await ev(`(()=>{try{state.onboarded=true;state.uiSettings=state.uiSettings||{};state.uiSettings.tutorialDone=true;}catch(e){}['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(function(id){var el=document.getElementById(id);if(el)el.remove();});window.scrollTo(0,0);return 1;})()`);
  await shot('drawer-escritorio-1280.png');
  await wait(400);
  try { child.kill(); } catch (e) {}
  await wait(500);
  try { child.kill('SIGKILL'); } catch (e) {}
  console.log('Listo.');
  process.exit(0);
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
