/* Vista del catálogo existente. No escribe en historial, rutinas ni favoritos.
   Las claves legacy permanecen intactas; las correcciones son de resolución.
   Ningún medio de free-exercise-db tiene licencia individual verificada aquí. */
(function(root){'use strict';
const chest=[
 ['Dumbbell_Bench_Press','Press plano con mancuernas','Dumbbell bench press','press','Banco plano; pies apoyados.','Press mancuernas|Press plano mancuernas|Press de banca con mancuernas|Press de pecho acostado con mancuernas|Press acostado con mancuernas'],
 ['Incline_Dumbbell_Press','Press inclinado con mancuernas','Incline dumbbell press','press','Banco inclinado estable; espalda apoyada.','Press con mancuernas inclinado|Press inclinado mancuernas'],
 ['Decline_Dumbbell_Bench_Press','Press de banca con mancuernas declinado','Decline dumbbell bench press','press','Banco declinado con sujeción adecuada; pide ayuda para colocar y retirar las cargas.','Press declinado con mancuernas'],
 ['Dumbbell_Bench_Press_with_Neutral_Grip','Press de banca agarre neutro con mancuernas','Neutral-grip dumbbell bench press','press','Banco plano; palmas enfrentadas durante el movimiento.','Press neutro con mancuernas'],
 ['One_Arm_Dumbbell_Bench_Press','Press de banca con mancuernas a un brazo','Single-arm dumbbell bench press','press','Banco plano; una mancuerna; evita girar el tronco.','Press unilateral con mancuerna'],
 ['Dumbbell_Floor_Press','Press en el piso con mancuernas','Dumbbell floor press','press','Acostado en el suelo; rodillas flexionadas; apoya suavemente los brazos, sin golpearlos.','Press con mancuernas en el suelo'],
 ['Barbell_Bench_Press_-_Medium_Grip','Press banca con barra','Barbell bench press','press','Banco plano con soportes y topes de seguridad o ayuda de un compañero.','Press de banca|Press banca|Press de banca con barra|Press plano con barra'],
 ['Barbell_Incline_Bench_Press_-_Medium_Grip','Press inclinado con barra','Incline barbell bench press','press','Banco inclinado con soportes y topes de seguridad.','Press inclinado|Press banca inclinada|Press inclinado agarre medio con barra'],
 ['Decline_Barbell_Bench_Press','Press de banca con barra declinado','Decline barbell bench press','press','Banco declinado con sujeción y soportes de seguridad.','Press declinado|Press declinado con barra'],
 ['Smith_Machine_Bench_Press','Press de banca en máquina Smith','Smith machine bench press','press','Banco plano colocado bajo la guía; ajusta los topes antes de empezar.','Press plano en Smith'],
 ['Machine_Bench_Press','Press máquina pecho','Seated machine chest press','press','Ajusta asiento y respaldo para alinear los agarres con el pecho; sigue el diagrama de tu máquina.','Press de banca en máquina|Press de pecho sentado en máquina'],
 ['Butterfly','Aperturas en máquina (pec deck)','Pec deck fly','fly','Ajusta asiento y apoyos según el diagrama de tu máquina.','Aperturas en cable (peck deck)|Pec deck|Peck deck'],
 ['Dumbbell_Flyes','Aperturas con mancuernas','Dumbbell fly','fly','Banco plano; mancuernas sobre el pecho, codos ligeramente flexionados.','Aperturas|Aperturas planas con mancuernas'],
 ['Incline_Dumbbell_Flyes','Aperturas con mancuernas inclinado','Incline dumbbell fly','fly','Banco inclinado; espalda apoyada y codos ligeramente flexionados.','Aperturas inclinadas con mancuernas'],
 [null,'Cruce de poleas','Standing cable crossover','fly','De pie entre las poleas; postura estable y codos ligeramente flexionados.','Cruce de poleas de pie'],
 [null,'Press de pecho de pie con banda','Standing band chest press','press','Banda en buen estado, anclada detrás a la altura del pecho; postura estable.','Standing chest press with resistance band'],
 ['Pushups','Lagartijas (push ups)','Push-up','push','Manos en el suelo y cuerpo alineado, apoyado en manos y puntas de los pies.','Push ups|Push up normal|Lagartija|Lagartijas|Flexiones|Flexiones (push ups)|Flexiones convencionales'],
 [null,'Flexiones en rodillas','Bent-knee push-up','push','Rodillas apoyadas y línea continua desde rodillas hasta cabeza.','Flexiones con rodillas apoyadas|Knee push up'],
 [null,'Flexiones contra pared','Wall push-up','push','Manos sobre una pared firme; pies separados de ella y cuerpo alineado.','Wall push up'],
 [null,'Fondos asistidos','Assisted machine dip','dip','Máquina específica de fondos asistidos; ajusta la asistencia y sube siguiendo su diagrama.','Fondos en máquina asistida']
].map((r,i)=>({id:r[0],name:r[1],en:r[2],family:r[3],setup:r[4],aliases:r[5].split('|'),order:i,existing:![15,18].includes(i)}));
const blocked=['Remo en máquina','Remo pendlay','Remo agarre ancho','Dominada negativa','Remo invertido bajo una mesa','Máquina lateral','Pájaros con mancuernas','Band pull apart','Curl bíceps cable/barra','Curl 21s','Hollow hold','Hip thrust mancuerna','Hip thrust en el piso','Step up bajo','Zancada trasera','Sentadilla asistida a una pierna','Elevación en escalón','Elevación con botellas','Remo con mochila','Y-raise','Curl con banda','Pike push up','Flexiones en pica','Cruce con bandas','Aperturas con bandas','Lagartijas amplias','Fondos en banca con mancuernas','Fondos entre dos sillas'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function review(name){const n=norm(name);return chest.find(x=>[x.name,x.en,...x.aliases].some(a=>norm(a)===n))||null;}
const mediaAliases={"Press militar con barra":"Standing_Military_Press","Pullover con mancuerna":"Bent-Arm_Dumbbell_Pullover","Pullover en polea":"Straight-Arm_Pulldown","Elevaciones laterales con mancuernas":"Side_Lateral_Raise","Elevación frontal con mancuernas":"Front_Dumbbell_Raise","Curl alternado con mancuernas":"Dumbbell_Alternate_Bicep_Curl","Curl mancuerna alternado":"Dumbbell_Alternate_Bicep_Curl","Curl predicador en máquina":"Machine_Preacher_Curls","Curl en polea":"Standing_Biceps_Cable_Curl","Extensión de tríceps en cuerda":"Triceps_Pushdown_-_Rope_Attachment","Extensión con mancuerna sobre la cabeza":"Standing_Dumbbell_Triceps_Extension","Puente de glúteo a una pierna":"Single_Leg_Glute_Bridge","Crunch en polea":"Cable_Crunch","Crunch en el piso":"Crunches","Superman en el piso":"Superman","Curl inclinado con mancuernas":"Incline_Dumbbell_Curl","Dominadas":"Pullups","Arnold press con mancuernas":"Arnold_Dumbbell_Press","Puente de glúteo en el piso":"Butt_Lift_Bridge","Lagartijas inclinadas (pies arriba)":"Decline_Push-Up","Step up con mancuernas":"Dumbbell_Step_Ups"};
const addedMedia={"Cable_Crossover":{"id":"Cable_Crossover","en":"Cable Crossover","m":["chest"],"eq":"cable"},"Cross_Over_-_With_Bands":{"id":"Cross_Over_-_With_Bands","en":"Cross Over - With Bands","m":["chest"],"eq":"bands"},"Dumbbell_Lunges":{"id":"Dumbbell_Lunges","en":"Dumbbell Lunges","m":["quadriceps"],"eq":"dumbbell"},"Hyperextensions_Back_Extensions":{"id":"Hyperextensions_Back_Extensions","en":"Hyperextensions (Back Extensions)","m":["lower back"],"eq":"other"},"Band_Skull_Crusher":{"id":"Band_Skull_Crusher","en":"Band Skull Crusher","m":["triceps"],"eq":"bands"},"Speed_Band_Overhead_Triceps":{"id":"Speed_Band_Overhead_Triceps","en":"Speed Band Overhead Triceps","m":["triceps"],"eq":"bands"},"Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension":{"id":"Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension","en":"Standing Bent-Over One-Arm Dumbbell Triceps Extension","m":["triceps"],"eq":"dumbbell"},"WGER_377":{"id":"WGER_377","en":"Leg Raises, Lying","eq":"body only","m":["abdomen"],"visual":{"kind":"images","files":["assets/exercise-demos/WGER_377/wger-139.png","assets/exercise-demos/WGER_377/wger-140.png"],"author":"Everkinetic","source":"https://wger.de/api/v2/exerciseinfo/377/","license":"CC BY-SA 3.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/3.0/"}},"WGER_203":{"id":"WGER_203","en":"Dumbbell Goblet Squat","eq":"dumbbell","m":["cuadriceps"],"visual":{"kind":"images","files":["assets/exercise-demos/WGER_203/wger-328.jpeg"],"author":"philip (wger)","source":"https://wger.de/api/v2/exerciseinfo/203/","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}},"WGER_82":{"id":"WGER_82","en":"Bent-over Lateral Raises","eq":"dumbbell","m":["hombros"],"visual":{"kind":"video","files":["assets/exercise-demos/WGER_82/rear-delt.MOV"],"author":"Goulart","source":"https://wger.de/api/v2/exerciseinfo/82/","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/"}}};
const addedMediaNames={"Cruce de poleas":"Cable_Crossover","Cruce con bandas":"Cross_Over_-_With_Bands","Aperturas con bandas":"Cross_Over_-_With_Bands","Band pull apart":"Band_Pull_Apart","Remo inclinado con mancuernas":"Bent_Over_Two-Dumbbell_Row","Sentadilla búlgara con mancuernas":"Split_Squat_with_Dumbbells","Zancadas con mancuernas":"Dumbbell_Lunges","Hiperextensión en banco":"Hyperextensions_Back_Extensions","Elevación de piernas en banco":"Flat_Bench_Lying_Leg_Raise","Rompecraneos con mancuernas":"Lying_Dumbbell_Tricep_Extension","Rompecraneos con banda":"Band_Skull_Crusher","Pallof press en polea":"Pallof_Press","Lagartijas amplias":"Push-Up_Wide","Elevación frontal en polea":"Front_Cable_Raise","Zancadas con barra":"Barbell_Lunge","Zancadas caminando":"Bodyweight_Walking_Lunge","Curl femoral en máquina":"Lying_Leg_Curls","Pantorrilla de pie con mancuernas":"Standing_Dumbbell_Calf_Raise","Patada en cable":"One-Legged_Cable_Kickback","Extension sobre la cabeza con banda":"Speed_Band_Overhead_Triceps","Patada de triceps con mancuerna":"Standing_Bent-Over_One-Arm_Dumbbell_Triceps_Extension","Elevaciones laterales en polea":"Standing_Low-Pulley_Deltoid_Raise","Elevación de piernas en el piso":"WGER_377","Sentadilla goblet con mancuerna":"WGER_203","Pájaros con mancuernas":"WGER_82"};
function visual(id){return addedMedia[id]?.visual||null;}
function localMedia(id,k){if(visual(id))return visual(id).kind==='images'?(visual(id).files[k]||''):'';return addedMedia[id]&&[0,1].includes(k)?"assets/exercise-demos/"+id+"/"+k+".jpg":"";}
function resolve(name,map,lib){
 const added=Object.entries(addedMediaNames).find(([n])=>norm(n)===norm(name));
 if(added)return addedMedia[added[1]]||Object.values(map).find(x=>x.id===added[1])||null;
 const alias=Object.entries(mediaAliases).find(([n])=>norm(n)===norm(name));
 if(alias)return Object.values(map).find(x=>x.id===alias[1])||null;
 const r=review(name);if(r)return r.id?Object.values(map).find(x=>x.id===r.id)||null:null;
 if(blocked.some(x=>norm(x)===norm(name)))return null;
 // Exact names only: a similar name is never evidence of the same movement.
 const pair=Object.entries(map).find(([k,v])=>norm(k)===norm(name)||norm(v.en)===norm(name));
 if(pair)return pair[1];
 for(const v of Object.values(lib||{}))for(const variant of Object.values(v.var||{})){
  if(norm(variant.n)===norm(name))return null; // Unreviewed cross-equipment demo links are not trusted.
 }
 return null;
}
function catalog(map,lib){
 const out=new Map();
 for(const [name,v] of Object.entries(map)){
  if(review(name)||blocked.some(x=>norm(x)===norm(name)))continue;
  if(!out.has(v.id))out.set(v.id,{key:v.id,name,en:v.en,m:v.m,eq:v.eq,aliases:[],family:'Otros existentes'});
  out.get(v.id).aliases.push(name);
 }
 for(const r of chest.filter(x=>x.existing)){
  const v=r.id?Object.values(map).find(x=>x.id===r.id):null;
  const prior=r.id?out.get(r.id):null;
  out.set(r.id||'legacy:'+norm(r.name),{...r,key:r.id||'legacy:'+norm(r.name),m:['pecho'],eq:v?.eq||'',aliases:[...r.aliases,...(prior?.aliases||[])],family:{press:'Presses',fly:'Aperturas y cruces',push:'Flexiones',dip:'Fondos'}[r.family]});
 }
 // Keep all existing routine variants selectable, without manufacturing new exercises.
 for(const [id,v] of Object.entries(lib||{}))for(const [mode,x] of Object.entries(v.var||{})){
  const known=[...out.values()].some(e=>[e.name,e.en,...e.aliases].some(a=>norm(a)===norm(x.n)));
  if(!known)out.set('legacy:'+norm(x.n),{key:'legacy:'+norm(x.n),name:x.n,en:'',m:[v.m],eq:x.eq,aliases:[],family:'Otros existentes'});
 }
 return [...out.values()];
}
function search(entries,q,group){
 const groups={pecho:['pecho'],espalda:['espalda','dorsales','espalda media','espalda baja','espalda_baja','trapecio'],hombros:['hombros'],brazos:['biceps','triceps','antebrazos'],pierna:['pierna','cuadriceps','femoral','pantorrillas','pantorrilla','aductores','abductores'],abdomen:['abdomen','core'],gluteos:['gluteos','gluteo']};
 const tokens=norm(q).split(' ').filter(Boolean);
 return entries.filter(e=>(!group||(groups[group]||[group]).some(m=>e.m.some(x=>norm(x)===norm(m))))&&tokens.every(t=>norm([e.name,e.en,...e.aliases].join(' ')).includes(t))).sort((a,b)=>(a.order??999)-(b.order??999)||a.name.localeCompare(b.name,'es'));
}
function instructions(name,lib){
 const r=review(name);
 if(r){const steps={press:['Sujeta firmemente la carga y mantén muñecas alineadas.','Empuja de forma controlada, sin perder el apoyo ni girar el tronco.','Regresa despacio al rango que puedas controlar sin dolor; no rebotes.'],fly:['Mantén una ligera flexión de codos durante todo el recorrido.','Acerca los brazos en arco frente al pecho, sin convertirlo en un press.','Abre lentamente sin forzar el hombro ni llevar los brazos excesivamente atrás.'],push:['Mantén abdomen y glúteos firmes, sin hundir la cintura.','Flexiona los codos y acerca el pecho al apoyo de forma controlada.','Empuja para regresar manteniendo la alineación del cuerpo.'],dip:['Mantén control sobre el apoyo de asistencia.','Flexiona los codos sin forzar profundidad ni adelantar los hombros bruscamente.','Empuja para volver sin impulso; más asistencia reduce la carga efectiva.']};return {setup:r.setup,steps:steps[r.family],related:chest.filter(x=>x.existing&&x.family===r.family&&x!==r).map(x=>x.name)};}
 for(const v of Object.values(lib||{}))if(norm(v.n)===norm(name))return {setup:'',steps:[v.ins],related:[]};
 return {setup:'',steps:['Instrucciones específicas pendientes de revisión. No se muestra otra variante como sustituto.'],related:[]};
}
const api={chest,norm,review,resolve,catalog,search,instructions,localMedia,visual,mediaVerified:()=>false};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FitnessExerciseCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
