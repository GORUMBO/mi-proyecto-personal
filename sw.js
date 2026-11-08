const CACHE='mi-proyecto-v1-206-0';
const FILES=['./','./index.html',
 './assets/recetas/agua-jamaica.jpg',
 './assets/recetas/chilaquiles.jpg',
 './assets/recetas/elote-esquite.jpg',
 './assets/recetas/enchiladas.jpg',
 './assets/recetas/flan.jpg',
 './assets/recetas/guacamole.jpg',
 './assets/recetas/hotcakes.jpg',
 './assets/recetas/huevos-rancheros.jpg',
 './assets/recetas/molletes.jpg',
 './assets/recetas/pozole.jpg',
 './assets/recetas/quesadillas-pollo.jpg',
 './assets/recetas/sopa-fideo.jpg',
 './assets/alimentos/aceite.jpg',
 './assets/alimentos/acelga.jpg',
 './assets/alimentos/aguacate.jpg',
 './assets/alimentos/ajo.jpg',
 './assets/alimentos/arandano.jpg',
 './assets/alimentos/arroz.jpg',
 './assets/alimentos/atun.jpg',
 './assets/alimentos/avena.jpg',
 './assets/alimentos/azucar.jpg',
 './assets/alimentos/betabel.jpg',
 './assets/alimentos/bistec.jpg',
 './assets/alimentos/brocoli.jpg',
 './assets/alimentos/brotes-soya.jpg',
 './assets/alimentos/cacao.jpg',
 './assets/alimentos/calabacita.jpg',
 './assets/alimentos/calabaza.jpg',
 './assets/alimentos/camaron.jpg',
 './assets/alimentos/camote.jpg',
 './assets/alimentos/carne-molida.jpg',
 './assets/alimentos/cebolla.jpg',
 './assets/alimentos/cerdo.jpg',
 './assets/alimentos/cereal.jpg',
 './assets/alimentos/champinones.jpg',
 './assets/alimentos/chayote.jpg',
 './assets/alimentos/chicharos.jpg',
 './assets/alimentos/chipotle.jpg',
 './assets/alimentos/cilantro.jpg',
 './assets/alimentos/coliflor.jpg',
 './assets/alimentos/crema.jpg',
 './assets/alimentos/durazno.jpg',
 './assets/alimentos/ejotes.jpg',
 './assets/alimentos/elote.jpg',
 './assets/alimentos/esparragos.jpg',
 './assets/alimentos/espinaca.jpg',
 './assets/alimentos/fideo.jpg',
 './assets/alimentos/frambuesa.jpg',
 './assets/alimentos/fresa.jpg',
 './assets/alimentos/frijol.jpg',
 './assets/alimentos/frijoles-negros.jpg',
 './assets/alimentos/garbanzos.jpg',
 './assets/alimentos/guajillo.jpg',
 './assets/alimentos/huevo.jpg',
 './assets/alimentos/jalapeno.jpg',
 './assets/alimentos/jamon.jpg',
 './assets/alimentos/jicama.jpg',
 './assets/alimentos/jitomate.jpg',
 './assets/alimentos/kale.jpg',
 './assets/alimentos/kiwi.jpg',
 './assets/alimentos/leche.jpg',
 './assets/alimentos/lechuga.jpg',
 './assets/alimentos/lentejas.jpg',
 './assets/alimentos/lima.jpg',
 './assets/alimentos/limon.jpg',
 './assets/alimentos/lomo-cerdo.jpg',
 './assets/alimentos/mango.jpg',
 './assets/alimentos/mangonada.jpg',
 './assets/alimentos/mantequilla.jpg',
 './assets/alimentos/manzana.jpg',
 './assets/alimentos/maracuya.jpg',
 './assets/alimentos/mayonesa.jpg',
 './assets/alimentos/melon.jpg',
 './assets/alimentos/miel.jpg',
 './assets/alimentos/morita.jpg',
 './assets/alimentos/naranja.jpg',
 './assets/alimentos/nopal.jpg',
 './assets/alimentos/palomitas.jpg',
 './assets/alimentos/pan.jpg',
 './assets/alimentos/papa.jpg',
 './assets/alimentos/papaya.jpg',
 './assets/alimentos/pasilla.jpg',
 './assets/alimentos/pasta.jpg',
 './assets/alimentos/pechuga-pollo.jpg',
 './assets/alimentos/pepino.jpg',
 './assets/alimentos/pera.jpg',
 './assets/alimentos/pimiento.jpg',
 './assets/alimentos/pina.jpg',
 './assets/alimentos/platano.jpg',
 './assets/alimentos/pollo.jpg',
 './assets/alimentos/salchicha.jpg',
 './assets/alimentos/salmon.jpg',
 './assets/alimentos/sandia.jpg',
 './assets/alimentos/serrano.jpg',
 './assets/alimentos/taro.jpg',
 './assets/alimentos/tilapia.jpg',
 './assets/alimentos/tocino.jpg',
 './assets/alimentos/tomatillo.jpg',
 './assets/alimentos/tortilla.jpg',
 './assets/alimentos/totopos.jpg',
 './assets/alimentos/uvas.jpg',
 './assets/alimentos/yogurt.jpg',
 './assets/alimentos/zanahoria.jpg',
 './assets/tm6/thermomix-2014.jpg',
 './assets/tm6/tm6-vorwerk.jpg',
 './assets/cocina/tm6.jpg',
 './assets/cocina/horno.jpg',
 './assets/cocina/airfryer.jpg',
 './assets/cocina/sarten.jpg'];

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
  // OCR local (Tesseract.js): cachear para que funcione sin internet después
  // de la primera carga. Nunca intercepta Supabase ni version.json (invariante).
  var u=String(e.request.url||'');
  if(/cdn\.jsdelivr\.net\/npm\/tesseract\.js/.test(u)){
    e.respondWith(
      caches.open(CACHE).then(function(c){
        return c.match(e.request).then(function(hit){
          var p=fetch(e.request).then(function(r){
            if(r&&r.status===200){var cp=r.clone();c.put(e.request,cp);}
            return r;
          }).catch(function(){return hit;});
          return hit||p;
        });
      })
    );
    return;
  }
  const url=e.request.url;
  // NUNCA interceptar ni cachear peticiones a Supabase (auth/rest/storage): deben ir siempre a la red en vivo.
  if(/supabase\.(co|in)\//.test(url)||/\/auth\/v1\/|\/rest\/v1\/|\/storage\/v1\//.test(url)||/workers\.dev\//.test(url)||/\/sync\//.test(url))return; // pasa directo a la red (sync NUNCA se cachea)
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
