# CHANGELOG — Mi Proyecto Personal

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
