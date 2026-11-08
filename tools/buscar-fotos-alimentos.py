# -*- coding: utf-8 -*-
# Busca en Commons la foto de cada alimento (catálogo curado), V2:
# - guarda top-3 candidatos por alimento para revisión manual
# - bloquea títulos de cultivo/paisaje/personas (field, farm, paddy, coffee...)
# - reintenta los 429 con backoff largo; reanuda desde eleccion.json
# Uso: python tools/buscar-fotos-alimentos.py
import json, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
UA = {'User-Agent': 'MiProyectoPersonal/1.6 (offline app, single user)'}

CATALOGO = [
 ('papa','Papa','potato'),('camote','Camote','sweet potato'),('zanahoria','Zanahoria','carrots vegetable'),
 ('betabel','Betabel (remolacha)','beetroot'),('brocoli','Brócoli','broccoli head'),('coliflor','Coliflor','cauliflower'),
 ('chayote','Chayote','chayote'),('calabacita','Calabacita (zucchini)','zucchini squash vegetable'),('calabaza','Calabaza','pumpkin fruit'),
 ('pimiento','Pimiento','bell pepper'),('cebolla','Cebolla','onions bulbs'),('ajo','Ajo','garlic'),
 ('jitomate','Jitomate','tomato'),('tomatillo','Tomate verde','tomatillo'),('jalapeno','Chile jalapeño','jalapeño'),
 ('serrano','Chile serrano','serrano chile peppers'),('pepino','Pepino','cucumber'),('ejotes','Ejotes','green beans'),
 ('chicharos','Chícharos','peas'),('elote','Elote','sweet corn cobs'),('champinones','Champiñones','mushroom champignon'),
 ('apio','Apio','celery stalks'),('rabano','Rábano','radishes'),('aguacate','Aguacate','avocado'),
 ('nopal','Nopal','nopal cactus'),('berenjena','Berenjena','aubergine eggplant'),('jicama','Jícama','jicama tuber'),
 ('esparragos','Espárragos','asparagus spears'),('espinaca','Espinaca','spinach leaves'),('lechuga','Lechuga','lettuce'),
 ('kale','Kale','kale leaves vegetable'),('repollo','Repollo','white cabbage head'),('acelga','Acelga','chard'),
 ('cilantro','Cilantro','coriander leaves'),('brotes-soya','Brotes de soya','bean sprouts'),('taro','Taro','taro root'),
 ('platano','Plátano','banana'),('manzana','Manzana','apple'),('naranja','Naranja','orange fruit'),
 ('fresa','Fresa','strawberry'),('mango','Mango','mango fruit'),('pina','Piña','pineapple fruit'),
 ('papaya','Papaya','papaya fruit'),('maracuya','Maracuyá','passion fruit'),('limon','Limón','lemon'),
 ('lima','Lima','lime fruit'),('uvas','Uvas','grapes'),('sandia','Sandía','watermelon'),
 ('melon','Melón','cantaloupe fruit'),('kiwi','Kiwi','kiwi fruit'),('durazno','Durazno','peach fruit'),
 ('pera','Pera','pear'),('frambuesa','Frambuesa','raspberry'),('arandano','Arándano','blueberries'),
 ('pollo','Pollo','chicken meat'),('pechuga-pollo','Pechuga de pollo','raw chicken breast'),
 ('carne-molida','Carne molida','ground beef'),('bistec','Bistec','beef steak'),
 ('cerdo','Cerdo','pork meat'),('lomo-cerdo','Lomo de cerdo','pork tenderloin'),('tocino','Tocino','bacon'),
 ('jamon','Jamón','ham meat sliced'),('salchicha','Salchicha','sausage'),('huevo','Huevo','chicken eggs'),
 ('atun','Atún','tuna fish'),('salmon','Salmón','salmon'),('tilapia','Tilapia','tilapia'),
 ('camaron','Camarón','shrimp'),
 ('arroz','Arroz','cooked rice bowl'),('avena','Avena','rolled oats'),('pasta','Pasta','spaghetti pasta dry'),
 ('fideo','Fideo','noodles'),('pan','Pan','loaf of bread bakery'),('tortilla','Tortilla','tortilla flatbread'),
 ('totopos','Totopos','tortilla chips'),('cereal','Cereal','breakfast cereal'),
 ('frijol','Frijol','cooked beans'),('lentejas','Lentejas','lentils'),('garbanzos','Garbanzos','chickpeas'),
 ('frijoles-negros','Frijoles negros','black beans'),('habas','Habas','broad beans fava'),
 ('leche','Leche','milk glass'),('yogurt','Yogurt','yogurt'),('queso','Queso','cheese block gouda'),
 ('mantequilla','Mantequilla','butter sticks'),('crema','Crema','sour cream'),('aceite','Aceite','olive oil bottle'),
 ('miel','Miel','honey jar'),('azucar','Azúcar','sugar'),('mayonesa','Mayonesa','mayonnaise'),
 ('cafe','Café','roasted coffee beans closeup'),('cacao','Cacao','cocoa powder'),
]

# Títulos que NO representan el alimento comestible (cultivo, paisaje, gente, recetas)
BLOQUEAR = re.compile(
    r'field|farm|paddy|plantation|growing|seedling|harvest|cultivat|tree\b|plant\b|flower|blossom|orchard|'
    r'women|men\b|people|chef|cooking|making|preparing|grinding|market\b|shop\b|street|soup|salad|dish|plate|'
    r'sandwich|burger|pizza|sauce\b|coffee|tea\b|cake|breads? of|rice fields|terraces?', re.I)

def norm(s):
    s = s.lower()
    s = s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u').replace('ñ','n')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def api(q, intentos=4):
    url = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch='
           + urllib.parse.quote(q + ' filetype:bitmap') + '&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=640')
    for k in range(intentos):
        try:
            req = urllib.request.Request(url, headers=UA)
            d = json.load(urllib.request.urlopen(req, timeout=40))
            out = []
            for p in (d.get('query', {}).get('pages') or {}).values():
                ii = (p.get('imageinfo') or [{}])[0]
                em = ii.get('extmetadata') or {}
                out.append({'title': p.get('title'), 'w': ii.get('width'), 'h': ii.get('height'),
                            'mime': ii.get('mime'), 'lic': em.get('LicenseShortName', {}).get('value', '?'),
                            'thumb': ii.get('thumburl'), 'url': ii.get('url')})
            return out
        except Exception as e:
            print('  429/err (%s) intento %d' % (q[:20], k + 1))
            time.sleep(8 + 4 * k)
    return None

def puntuar(r, termino, t0):
    tit = norm(os.path.splitext(r['title'].replace('File:', ''))[0])
    if BLOQUEAR.search(r['title']): return -10
    tq = norm(termino)
    p = 0
    # coincidencia por PALABRA (no subcadena): evita coffee beans ↔ beans
    palabras = set(t0.split()) | set(tq.split())
    tp = set(tit.split())
    comun = palabras & tp
    if comun: p = 2 + min(2, len(comun))
    else: return -10
    lic = r['lic'] or ''
    if 'CC0' in lic or 'Public domain' in lic: p += 2
    elif 'CC BY' in lic and 'SA' not in lic: p += 1
    if (r['w'] or 0) < 500: p -= 1
    return p

seleccion = {}
try:
    seleccion = json.load(open('tools/alimentos-eleccion.json', encoding='utf-8'))
except Exception:
    pass
candidatos = {}
try:
    candidatos = json.load(open('tools/alimentos-candidatos.json', encoding='utf-8'))
except Exception:
    pass

pendientes = [c for c in CATALOGO if c[0] not in seleccion]
print('pendientes:', len(pendientes))
for slug, nombre, termino in pendientes:
    t0 = norm(nombre)
    res = api(termino)
    if res is None:
        print('--- %-14s sin respuesta (queda emoji)' % slug)
        time.sleep(4); continue
    puntuados = sorted([(puntuar(r, termino, t0), r) for r in res if r['mime'] == 'image/jpeg'],
                       key=lambda x: -x[0])
    buenos = [(p, r) for p, r in puntuados if p >= 3]
    candidatos[slug] = [{'title': r['title'], 'lic': r['lic'], 'thumb': r['thumb'], 'w': r['w'], 'p': p}
                        for p, r in puntuados[:3]]
    if buenos:
        p, r = buenos[0]
        seleccion[slug] = {'nombre': nombre, 'termino': termino, 'title': r['title'],
                           'lic': r['lic'], 'thumb': r['thumb'], 'url': r['url'],
                           'w': r['w'], 'h': r['h'], 'puntaje': p}
        print('OK  %-14s → %s | %s | %s' % (slug, r['title'][:58], r['lic'], r['w']))
    else:
        print('--- %-14s sin candidato confiable (queda emoji)' % slug)
    time.sleep(2.5)

json.dump(seleccion, open('tools/alimentos-eleccion.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(candidatos, open('tools/alimentos-candidatos.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\nSeleccionados: %d de %d' % (len(seleccion), len(CATALOGO)))
