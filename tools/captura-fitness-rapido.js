// Captura visual del Modo rápido de Fitness (iPhone) para revisión humana.
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const wait = ms => new Promise(r => setTimeout(r, ms));
const port = 9357;
const rootReal = path.resolve(__dirname, '..');
const appDir = process.env.PP_APP_DIR || rootReal;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cap-'));
const exe = path.join(rootReal, 'node_modules', 'electron', 'dist', 'electron.exe');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
async function gt() { for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/list'); const l = await r.json(); const t = l.find(x => x.type === 'page' && x.webSocketDebuggerUrl); if (t) return t; } catch (e) {} await wait(500); } throw new Error('sin target'); }
function cn(url) { return new Promise((res, rej) => { const ws = new WebSocket(url); let id = 0; const p = new Map(); ws.onopen = () => { ws.sj = (m, pa) => new Promise((r2, j2) => { const mid = ++id; p.set(mid, { r2, j2 }); ws.send(JSON.stringify({ id: mid, method: m, params: pa || {} })); }); res(ws); }; ws.onerror = rej; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { const q = p.get(m.id); p.delete(m.id); m.error ? q.j2(new Error(JSON.stringify(m.error))) : q.r2(m); } }; }); }
(async () => {
  const child = spawn(exe, [appDir, '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { stdio: 'ignore' });
  const t = await gt(); const ws = await cn(t.webSocketDebuggerUrl);
  await ws.sj('Runtime.enable', {}); await ws.sj('Network.enable', {});
  await ws.sj('Network.setUserAgentOverride', { userAgent: UA });
  await ws.sj('Emulation.setDeviceMetricsOverride', { width: 393, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 393, screenHeight: 844 });
  const ev = async e => { const m = await ws.sj('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (m.result && m.result.exceptionDetails) return 'EXC:' + m.result.exceptionDetails.text; return m.result && m.result.result ? m.result.result.value : undefined; };
  for (let i = 0; i < 40; i++) { await wait(750); const ok = await ev("!!document.getElementById('edgeDrawer')"); if (ok === true) break; }
  await ev("state.onboarded=true;['loginScreen','onboardingModal','avisoSinCuentaBox','appTutorial','appUpdateBanner'].forEach(id=>{var el=document.getElementById(id);if(el)el.remove();});1");
  await ev(`(function(){var hoy=(typeof todayISO==='function')?todayISO():new Date().toISOString().slice(0,10);state.fitnessToday={date:hoy,ctx:{},adaptedOnlyToday:false,oneOff:false,plan:[{name:'Press plano con mancuernas',muscle:'pecho',sets:3,reps:'8-12',rest:90},{name:'Peso muerto rumano',muscle:'femoral',sets:3,reps:'8-12',rest:100},{name:'Lagartijas (push ups)',muscle:'pecho',sets:2,reps:'10-15',rest:60},{name:'Plancha',muscle:'core',sets:2,reps:'30-45s',rest:60}],checked:{},checkedDate:hoy,estado:{},sessionId:Date.now()};save(true);return 1;})()`);
  await ev(`openTab('💪 Ejercicio')`); await wait(1800);
  const shot = async (name) => { const r = await ws.sj('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(__dirname, 'pruebas', name), Buffer.from(r.result.data, 'base64')); console.log('captura: ' + name); };
  await shot('fitness-rapido-ej1.png');
  await ev(`f3ModoVistaSet('info')`); await wait(1000);
  await shot('fitness-informativo.png');
  try { await ev('window.close()'); } catch (e) {} await wait(800);
  try { child.kill(); } catch (e) {} await wait(400); try { child.kill('SIGKILL'); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
