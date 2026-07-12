const CACHE='mi-proyecto-v46-4-3';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Permite que la app aplique la actualización al instante (botón "Actualizar").
self.addEventListener('message',e=>{ if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch',e=>{
  const url=e.request.url;
  // NUNCA interceptar ni cachear peticiones a Supabase (auth/rest/storage): deben ir siempre a la red en vivo.
  if(/supabase\.(co|in)\//.test(url)||/\/auth\/v1\/|\/rest\/v1\/|\/storage\/v1\//.test(url))return; // pasa directo a la red
  // version.json siempre desde la red (para detectar versiones nuevas sin cache).
  if(/version\.json(\?|$)/.test(url))return;
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{let copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
