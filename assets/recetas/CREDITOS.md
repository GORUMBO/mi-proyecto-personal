# Créditos de las fotografías del catálogo de recetas (muestra de 12)

Las imágenes de esta carpeta se descargaron de Wikimedia Commons y se
recortaron/re-dimensionaron localmente (tools/preparar-fotos-recetas.py).
Son recursos locales de la app (funcionan sin internet). Las licencias
requieren atribución; el crédito también se muestra dentro de la app al
abrir la receta.

| Receta | Archivo | Título original | Autor | Licencia | Fuente |
|---|---|---|---|---|---|
| Chilaquiles con huevo | chilaquiles.jpg | Chilaquiles Rojos.JPG | Carlos t | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Chilaquiles_Rojos.JPG |
| Huevos rancheros (porción grande · 400 kcal) | huevos-rancheros.jpg | Huevos rancheros - Pescadero.jpg | Daderot | CC0 | https://commons.wikimedia.org/wiki/File:Huevos_rancheros_-_Pescadero.jpg |
| Molletes caseros | molletes.jpg | Molletes mexicanos.jpg | Locker233 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Molletes_mexicanos.jpg |
| Quesadillas de pollo | quesadillas-pollo.jpg | Quesadillas with Pollo Asado.jpg | Mike Saechang | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Quesadillas_with_Pollo_Asado.jpg |
| Enchiladas económicas | enchiladas.jpg | Enchiladas con salsa roja.jpg | Dahyana Yasada R. R. | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Enchiladas_con_salsa_roja.jpg |
| Pozole rápido de pollo | pozole.jpg | Pozole, Mazatlán, 13 de marzo de 2023 02.jpg | El Nuevo Doge | CC0 | https://commons.wikimedia.org/wiki/File:Pozole,_Mazatlán,_13_de_marzo_de_2023_02.jpg |
| Sopa de fideo con pollo | sopa-fideo.jpg | Sopa de fideo.jpg | Wotancito | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Sopa_de_fideo.jpg |
| Guacamole clásico | guacamole.jpg | Guacamole IMGP1256.jpg | Nikodem Nijaki | CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:Guacamole_IMGP1256.jpg |
| Hotcakes de avena y plátano | hotcakes.jpg | Banana pancakes Gili Trawangan.JPG | Midori | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Banana_pancakes_Gili_Trawangan.JPG |
| Agua de Jamaica con piloncillo | agua-jamaica.jpg | A glass of hibiscus tea 01.jpg | claralieu | CC BY 2.0 | https://commons.wikimedia.org/wiki/File:A_glass_of_hibiscus_tea_01.jpg |
| Flan napolitano casero | flan.jpg | Homemade Flan.jpg | Cary Bass | CC BY-SA 2.5 | https://commons.wikimedia.org/wiki/File:Homemade_Flan.jpg |
| Elote en vaso (esquite) | elote-esquite.jpg | Esquites at Coyoacan neighborhood in Mexico City.jpg | Jj saezdeo | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Esquites_at_Coyoacan_neighborhood_in_Mexico_City.jpg |

## Cómo cambiar o agregar fotos

1. Coloca tu foto en esta carpeta con cualquier nombre .jpg (1200×900 se ve bien).
2. En `index.html`, dentro de `RECETA_FOTOS`, agrega la entrada de la receta:
   `'Nombre exacto de la receta':{img:'assets/recetas/tu-foto.jpg', fuente:'Autor · CC BY-SA 4.0', ilustrativa:false}`
   — el campo `img` se puede cambiar sin tocar el resto.
3. Si la foto no existe o no carga, la tarjeta simplemente no la muestra
   (queda como antes). Para una foto genérica pon `ilustrativa:true` y la
   app la marca con la etiqueta "Ilustrativa".
