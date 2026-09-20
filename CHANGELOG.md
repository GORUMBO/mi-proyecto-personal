# CHANGELOG — Mi Proyecto Personal

## v1.195.3 (2026-09-19)

**Distribución predeterminada reparada, editor de apariencia estable y contraste accesible en modales.**

- **Distribución predeterminada limpia** por dispositivo: logo, nombre y subtítulo en la primera fila, navegación debajo, Rápido y Puente Cloudflare separados y dentro del viewport; validación al cargar con aviso "Tu distribución anterior no cabe correctamente en esta pantalla." y opciones Reparar automáticamente / Restaurar diseño predeterminado / Conservar y editar.
- **Modales siempre legibles**: tokens propios (superficie, controles, texto, borde, foco, overlay) con contraste WCAG AA en los 6 temas y 4 modos; Colores y tema reorganizado en tarjetas compactas.
- **Navegación y botones en tarjetas claras** (asa de arrastre, miniatura, Mostrar Sí/No, Tamaño, Forma, colores con etiqueta, Bloquear, Subir/Bajar, Restaurar) con visibilidad unificada que se respeta al guardar, recargar y cambiar de modo.
- **Selección múltiple real** (Ctrl/Cmd+clic, Shift+clic, rectángulo, pulsación larga táctil) con acciones de grupo; los campos de texto conservan el foco al escribir; la barra inferior del iPhone abre cada sección desde arriba.


## v1.195.2 (2026-09-19)

**Fondo de pantalla personalizado + navegación móvil.**

- **Fondo de pantalla personalizado**: elige una imagen o toma una foto con vista previa **inmediata**; ajuste (cubrir/contener/repetir), posición, brillo, oscurecimiento, desenfoque y transparencia; alcance a toda la app o solo al modo activo. Se administra desde Perfil → Cambiar fondo y desde Ajustes → Apariencia (con miniatura, archivo y Quitar fondo).
- **Editor de fondo seguro**: hoja inferior con borrador propio — nada se guarda hasta Aplicar; Cancelar restaura el fondo anterior; Quitar vuelve al predeterminado.
- **Correcciones del fondo**: Elegir imagen / Tomar foto ahora son controles nativos (label con input anidado, antes un input desvinculado del DOM podía no abrir el selector); Quitar + Aplicar persiste la eliminación (antes el fondo reaparecía tras recargar).
- **Navegación móvil (teléfono)**: barra inferior con los botones del modo activo, pastilla del modo y menú Más; Windows queda exactamente igual.
- **Fitness móvil**: una tarjeta de ejercicio expandida a la vez con "Siguiente ejercicio"; la posición de Ejercicio se conserva al volver.
- **Detalles móviles**: campos con letra 16 px (sin zoom automático de iOS), botones táctiles de al menos 44 px, e idioma de la app en español por defecto.

## v1.195.1 (2026-09-19)

**Fitness: rutinas semanales, editor y demostraciones estabilizados.**

- **Editor de rutinas corregido**: carga la rutina exacta por su ID estable (sin mezclar con otras), los días seleccionados aparecen marcados en verde con ✓ (descanso en los demás) y todos los campos muestran los valores guardados. Ahora es un **modal fijo** con borrador propio: no desaparece ni se reconstruye al editar; Guardar/Cancelar/X/Escape no mezclan rutinas ni crean duplicados.
- **Rutina semanal y descanso corregidos**: el bloque "Entrenamiento de hoy" distingue entrenamiento, descanso programado (con próxima sesión real), "Solo hoy", sin rutina activa y día visto — sin mensajes automáticos incorrectos ni rutinas automáticas en días libres.
- **Pantalla de Fitness simplificada**: "Mi semana" muestra solo barra, resumen y botones; la lista completa de ejercicios aparece una sola vez.
- **Progreso visual de ejercicios**: tarjetas con estados Pendiente/En progreso/Completado/Omitido (color + icono + texto), círculos de series grandes, leyenda y barra de progreso real por series.
- **Medios grandes conservados**: demostración (fotos reales o animación) dentro de cada tarjeta con reproducir/pausar/velocidad/pantalla completa; fallback claro cuando no existe demo.
- **Búsquedas de ejercicios**: ▶ Buscar en YouTube y 🌐 Buscar en Google con el nombre exacto en español (e inglés si existe) + "técnica correcta español".
- **Persistencia**: nombre de rutina, días, configuración, progreso de series, peso/reps y la rutina semanal fijada se conservan al cerrar, abrir y recargar; la selección de día no se arrastra al día siguiente.

## v1.195.0 (2026-09-09)

- Mis tickets en Comer → Lista de compra (ubicación única), lista de compra persistente, gasto único en Dinero.

## v1.194.0

- Entrada de tickets por bot de Telegram con OCR local gratis.

## v1.193.1

- Fix "Completar mi día" en iPhone (Volver + recetas).
