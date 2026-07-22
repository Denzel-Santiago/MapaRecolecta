# Decisiones pendientes para que el Diseñador de rutas funcione bien

Este documento junta, en un solo lugar, todas las decisiones que dependen de ti (no de backend, no de código) para que el módulo de mapa quede completo. Cada una tiene la situación actual, las opciones reales, y mi recomendación.

---

## 1. Sync de puntos: ¿esperar el endpoint `/sync`, o usar ya los endpoints individuales?

**Situación actual:** la Fase 12 conecta `puntosRecoleccionApi.ts` pero solo intenta llamar a `POST /api/puntos-recoleccion/sync`, un endpoint que **no existe** en el backend real (confirmado contra el swagger). Está apagado detrás de `VITE_SYNC_PUNTOS_ENABLED=false` para no romper nada mientras tanto.

**Opciones:**

- **A — Esperar a que backend construya `/sync`.** No hay que tocar el frontend, pero el guardado de puntos individuales sigue sin funcionar hasta que eso exista (no hay fecha).
- **B (recomendada) — Reescribir el guardado para usar los endpoints individuales que ya existen y funcionan** (`POST`/`PUT`/`DELETE /api/puntos-recoleccion/{id}`), llamándolos uno por uno según lo que cambió en el borrador (`construirPayloadSync` ya calcula exactamente qué es nuevo/actualizado/eliminado — solo cambia a qué endpoint se manda cada grupo). Es más peticiones de red por guardado, pero funciona hoy mismo, sin depender de backend.

**Mi recomendación:** B. No hay razón para bloquear esto en un endpoint que no existe y no está planeado con fecha.

**Qué necesito de ti:** confirmar que reescriba la Fase 12 para usar B.

---

## 2. Mientras backend no acepta `camion_id`/`color`: ¿parche temporal con `localStorage`?

**Situación actual:** cada vez que se guarda o recarga una ruta, `camion_id` y `color` se pierden porque backend los descarta en silencio (sección 2 de `REQUISITOS_BACKEND_MAPA.md`). Hoy el frontend cae a un valor por defecto.

**Opciones:**

- **A — No hacer nada, esperar el cambio de backend.** Simple, pero el Diseñador sigue mostrando camión/color incorrectos entre sesiones hasta que backend lo resuelva.
- **B — Parche temporal: guardar `{ ruta_id: { camion_id, color } }` en `localStorage` del navegador**, y usarlo para "rellenar" lo que backend no devuelve. Arregla la experiencia en la misma computadora/navegador donde se guardó la ruta, pero no comparte esa información entre distintos operadores o dispositivos (cada quien vería su propia versión local).
- **C — Parche temporal más robusto: guardar esa información dentro de `descripcion`** (como un sufijo o tag oculto, ej. `[camion:2|color:#2563eb]` al final del texto), ya que `descripcion` sí persiste en backend y sí viaja entre dispositivos. Es un hack más invasivo (hay que parsear/limpiar ese tag en todos lados donde se muestra `descripcion`) pero resuelve el problema para todos los operadores, no solo uno.

**Mi recomendación:** si el cambio de backend (sección 2) va a tardar, C es más útil que B porque no depende de qué computadora usa el operador. Si backend lo va a resolver pronto, ninguno vale la pena — es trabajo desechable.

**Qué necesito de ti:** decidir si quieres un parche temporal (B o C) o si prefieres esperar el cambio real de backend sin parches.

---

## 3. Camión + color en `Ruta`: ¿pedirle a backend la Opción A o la Opción B?

**Situación actual:** ver sección 2 de `REQUISITOS_BACKEND_MAPA.md`. Es el único cambio de backend que de verdad bloquea algo hoy.

**Opciones (para pedirle a backend):**

- **A — Agregar columnas `camion_id`/`color` directo a `Ruta`.** Menos trabajo para backend, alcanza para lo que el Diseñador necesita hoy (una ruta = un camión, sin historial).
- **B — Un recurso nuevo de asignación ruta↔camión** (como ya existe para camión↔chofer), con historial de reasignaciones.

**Mi recomendación:** A, salvo que ya sepas que a futuro un camión va a necesitar varias rutas simultáneas o que las rutas se reasignen de camión con frecuencia y quieran quedar registradas.

**Qué necesito de ti:** con cuál opción te reúnes con backend, para que yo ajuste el frontend (`RutaDiseñada`, `rutasApi.ts`) a la forma que backend termine implementando.

---

## 4. Selector de camión: ¿seguir con la lista fija (1/2/3), o conectar a `GET /api/camion/`?

**Situación actual:** el modal "Seleccione el camión" muestra Camión 1/2/3 hardcodeado. `GET /api/camion/` sí existe y funciona, pero devuelve camiones identificados por `placa`/`modelo`/`tipo_camion_id`, no por un nombre simple.

**Opciones:**

- **A — Dejarlo como está.** Funciona mientras solo haya 3 camiones fijos y nadie los dé de baja ni agregue nuevos.
- **B — Conectar el selector a `GET /api/camion/` real**, mostrando algo como "Placa · Modelo" en vez de "Camión 1". Requiere decidir el formato de texto a mostrar.

**Mi recomendación:** B si la flotilla puede crecer o cambiar; si siempre van a ser exactamente esos 3 camiones fijos, A es suficiente y más simple.

**Qué necesito de ti:** confirmar si vale la pena conectar el selector ahora, y qué formato de texto prefieres para identificar cada camión (ej. solo placa, o placa + modelo).

---

## 5. `DELETE /api/rutas/{id}`: ¿esperar confirmación de backend, o borrar los puntos manualmente por las dudas?

**Situación actual:** no se sabe si eliminar una ruta borra en cascada sus puntos en `puntos-recoleccion`, o si quedan huérfanos.

**Opciones:**

- **A — Esperar a que alguien de backend confirme el comportamiento real** antes de tocar nada.
- **B — Ajustar el frontend ya mismo para borrar manualmente los puntos de la ruta antes de borrar la ruta** (llamando primero a `GET /api/puntos-recoleccion/ruta/{id}` y luego un `DELETE` por cada punto). Es seguro tanto si hay cascada como si no (en el peor caso, borra dos veces algo que ya no existe, lo cual normalmente no da error).

**Mi recomendación:** B — es una salvaguarda barata que no depende de esperar respuesta de nadie.

**Qué necesito de ti:** confirmar si quieres que lo implemente ya como salvaguarda, o prefieres esperar la confirmación de backend primero.

---

## 6. Geometría vial y estado de publicación: ¿vale la pena persistirlos en backend, o se quedan como están?

**Situación actual:** ambos ya funcionan completamente del lado del cliente (geometría por calles vía OSRM, estado de publicación en memoria) pero se pierden al recargar la página y no los ve nadie más que el operador que los generó.

**Opciones:**

- **A — Dejarlos como vista previa local.** No requiere nada de backend, pero un operador no puede ver el trabajo de otro, y la app móvil del conductor nunca ve ni la geometría real por calles ni si una ruta está "publicada" o todavía en borrador.
- **B — Pedir a backend que agregue los campos correspondientes** (`geometria_oficial` en `Ruta`, y un estado tipo `BORRADOR`/`VALIDA`/`PUBLICADA`) para que esto se comparta entre operadores y, en el caso del estado de publicación, controle qué rutas ve la app móvil.

**Mi recomendación:** no es urgente hoy, pero el estado de publicación (B) tiene más impacto real que la geometría vial (B), porque sin él la app móvil no tiene forma de distinguir una ruta terminada de un borrador a medio hacer.

**Qué necesito de ti:** decidir si quieres agregar esto a la lista de pedidos a backend ahora, o dejarlo para después.

---

## Resumen: lo que necesito que decidas

| # | Decisión | Depende de | Urgencia |
|---|---|---|---|
| 1 | Sync de puntos: reescribir a endpoints individuales (recomendado) | Solo tú | Alta — bloquea que se puedan guardar puntos individuales hoy |
| 2 | Parche temporal de `camion_id`/`color` (ninguno / `localStorage` / en `descripcion`) | Solo tú | Media — depende de qué tan rápido resuelva backend la sección 3 |
| 3 | Pedir a backend Opción A o B para `camion_id`/`color` en `Ruta` | Tú + backend | Alta — es el único bloqueo real de backend |
| 4 | Conectar selector de camión a `GET /api/camion/` | Solo tú | Baja |
| 5 | Borrar puntos manualmente al eliminar ruta, como salvaguarda | Solo tú | Media |
| 6 | Persistir geometría vial / estado de publicación en backend | Tú + backend | Baja |
