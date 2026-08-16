const CACHE='mi-proyecto-v1-187-27';
const FILES=['./','./index.html'];

// Descarga con límite de tiempo. Sin esto, un corte de red a media descarga
// dejaba al service worker NUEVO eternamente en 'installing': nunca llegaba a
// 'waiting', nunca se activaba y la app quedaba atascada en "Casi listo…".
// Con timeout, la instalación SIEMPRE termina (los archivos que falten se
// vuelven a bajar en segundo plano con stale-while-revalidate).
function fetchT(url,ms){
  return new Promise(function(resolve,reject){
    var timer=setTimeout(function(){reject(new Error('timeout '+url));},ms||15000);
    fetch(url,{cache:'no-store'}).then(
      function(r){clearTimeout(timer);resolve(r);},
      function(e){clearTimeout(timer);reject(e);}
    );
  });
}

self.addEventListener('install',function(e){
  e.waitUntil((async function(){
    try{
      var c=await caches.open(CACHE);
      await Promise.all(FILES.map(function(f){
        // Un archivo que falle (o tarde) NO bloquea la instalación: se ignora
        // y el fetch handler lo reintenta en segundo plano al usarlo.
        return fetchT(f).then(function(r){
          if(r&&r.ok){try{return c.put(f,r);}catch(err){return null;}}
          return null;
        }).catch(function(){return null;});
      }));
    }catch(err){}
    // Pase lo que pase, activa la versión nueva (skipWaiting): así la app
    // recarga UNA sola vez con la actualización en vez de quedarse en la vieja.
    return self.skipWaiting();
  })());
});

self.addEventListener('activate',function(e){
  e.waitUntil((async function(){
    var keys=await caches.keys();
    var viejos=keys.filter(function(k){return k!==CACHE;}).sort();
    // Conserva el caché de la versión ANTERIOR (el más reciente de los viejos)
    // como respaldo sin conexión; borra los más antiguos.
    var borrar=viejos.slice(0,Math.max(0,viejos.length-1));
    await Promise.all(borrar.map(function(k){return caches.delete(k);}));
    return self.clients.claim();
  })());
});

// Permite que la app aplique la actualización al instante (botón "Actualizar").
self.addEventListener('message',function(e){
  if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',function(e){
  const url=e.request.url;
  // NUNCA interceptar ni cachear peticiones a Supabase (auth/rest/storage): deben ir siempre a la red en vivo.
  if(/supabase\.(co|in)\//.test(url)||/\/auth\/v1\/|\/rest\/v1\/|\/storage\/v1\//.test(url))return; // pasa directo a la red
  // version.json siempre desde la red (para detectar versiones nuevas sin cache).
  if(/version\.json(\?|$)/.test(url))return;
  if(e.request.method!=='GET')return;
  // Stale-while-revalidate: responde AL INSTANTE desde la caché (app rápida) y actualiza en segundo plano.
  // Antes era network-first: bajaba ~2.5MB en cada carga antes de mostrar nada (lento en el teléfono).
  // Las versiones nuevas se siguen detectando con version.json (siempre red) + el aviso de "Actualizar".
  e.respondWith(
    caches.match(e.request).then(function(cached){
      const fromNet=fetch(e.request).then(function(r){
        if(r&&r.status===200){let copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy);});}
        return r;
      }).catch(function(){return cached||caches.match('./index.html');}); // sin red: app offline desde cualquier caché disponible
      return cached||fromNet;
    })
  );
});
