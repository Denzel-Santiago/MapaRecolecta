# Qué necesita el módulo de Mapa (Mapa-Rec) de backend

Este documento resume, con evidencia concreta (revisando el swagger real en `/api/swagger/index.html` y el código actual del frontend), qué le falta al backend para que el Diseñador de rutas funcione de forma completa y confiable. No es un pedido especulativo: cada punto está confirmado contra el contrato real, no contra suposiciones.

Contexto para quien lo lea del lado de backend: el Diseñador permite crear/editar rutas de recolección dibujando puntos sobre un mapa, asociadas a un camión. Hoy guarda la ruta contra `POST/PUT /api/rutas/` y consume `GET /api/rutas/` para listarlas.

---

## 1. Resumen ejecutivo

| # | Qué falta o está mal | Urgencia | Bloquea hoy |
|---|---|---|---|
| 1 | `Ruta` no tiene forma de asociarse a un camión (ni `camion_id` ni recurso equivalente) | **Alta** | Sí — bug activo, ver sección 2 |
| 2 | `Ruta` no tiene campo `color` | Media | Parcial (mismo bug que #1) |
| 3 | ~~`cp` es `string` en `PuntoRecoleccion`, el frontend lo trata como `number`~~ | — | **Ya corregido en frontend, no requiere nada de backend** |
| 4 | No se sabe si `DELETE /api/rutas/{id}` borra en cascada sus puntos de `puntos-recoleccion` | Media | No bloquea, pero hay que confirmarlo antes de depender de él |
| 5 | No existe `POST /api/puntos-recoleccion/sync` (guardado por lotes) | Baja | No — el frontend puede usar los endpoints individuales que sí existen |
| 6 | No existe endpoint de geometría vial (ruta real por calles) | Informativo | No — esto se resolvió del lado del frontend con OSRM, no es responsabilidad de backend |
| 7 | No existe un estado de publicación de ruta (`BORRADOR`/`VALIDA`/`PUBLICADA`) | Baja | No — es una función nueva, no algo que ya se prometió |
| 8 | Dos posibles bugs de documentación en el swagger | Baja | No, pero conviene revisarlos |
| 9 | El selector de camión del Diseñador está hardcodeado (Camión 1/2/3) en vez de usar `GET /api/camion/` | Media | No bloquea, pero es una limitación conocida |

Los puntos **1 y 2** son los únicos que de verdad requieren un cambio de backend para que el Diseñador funcione correctamente. El resto son mejoras, confirmaciones o cosas que ya se resuelven del lado del frontend.

---

## 2. El problema real y activo: la ruta no sabe de qué camión es

### Qué se encontró

La entidad `Ruta` en el swagger (`entities.Ruta`) solo tiene estos campos:

```json
{
  "ruta_id": "integer",
  "nombre": "string",
  "descripcion": "string",
  "json_ruta": "string",
  "eliminado": "boolean",
  "created_at": "string"
}
```

No hay `camion_id` ni `color`. Sin embargo, el frontend (`construirRutaBackend` en `rutasApi.ts`) sí manda esos dos campos al guardar. Como Go descarta en silencio las propiedades que no reconoce, **hoy esos dos campos se pierden al guardar**, y al leer la ruta de vuelta, el frontend no tiene forma de saber a qué camión pertenece (cae a un valor por defecto).

**Consecuencia práctica**: todo el Diseñador organiza y filtra rutas por camión (`obtenerRutaPorCamion`, el selector "Ver rutas", el orden del listado). Sin este campo, esa asociación se pierde en cuanto se recarga la página o se vuelve a consultar `GET /api/rutas/` desde otra sesión.

### Por qué no se puede resolver solo desde el frontend

`json_ruta` parecía la única salida (es una caja opaca para el backend, se guarda como string), pero se confirmó que la app móvil del conductor ya consume `json_ruta` esperando exactamente un arreglo plano de `{ "latitud": ..., "longitud": ... }`. Cambiar esa forma (aunque sea agregando campos extra a cada punto) arriesga romper un consumidor real ya en producción que no se puede verificar ni corregir desde este proyecto. Por eso esto sí necesita un cambio de backend.

### Qué se pide (dos formas posibles, cualquiera sirve)

**Opción A (más simple): agregar columnas a `Ruta`.**

```json
{
  "camion_id": "integer",
  "color": "string"
}
```

Expuestas en `entities.Ruta`, en `entities.CreateRutaRequest` (`POST /api/rutas/`) y devueltas en las respuestas de `GET /api/rutas/`, `GET /api/rutas/{id}` y `PUT /api/rutas/{id}`.

**Opción B: un recurso de asignación ruta↔camión**, análogo al que ya existe para camión↔chofer (`HistorialAsignacionCamion`, con `id_camion`/`id_chofer`/`fecha_asignacion`/`fecha_baja`). Por ejemplo:

```txt
POST /api/ruta-camion-asignacion/   { ruta_id, camion_id }
GET  /api/ruta-camion-asignacion/ruta/{ruta_id}
GET  /api/ruta-camion-asignacion/camion/{camion_id}
```

La opción A es menos trabajo y alcanza para lo que el Diseñador necesita hoy. La opción B tiene sentido si en algún momento un camión puede tener varias rutas o una ruta puede reasignarse de camión con historial (igual que ya se hace con chofer).

`color` puede ir como parte de la misma solución (columna en `Ruta`, u opcional dentro del recurso de asignación) — es solo para diferenciar visualmente las rutas en el mapa, no tiene ninguna otra lógica detrás.

---

## 3. `cp` como `string`, no `number` — YA CORREGIDO

`entities.PuntoRecoleccion` y `entities.CreatePuntoRecoleccionRequest` definen `cp` como `string`. El frontend lo trataba como `number` en varios lugares; esto ya se corrigió del lado del frontend, sin necesitar ningún cambio de backend:

- `puntoToBackend` (`src/services/puntosRecoleccionApi.ts`) manda `cp: String(orden)` siempre — la secuencia real y actual del punto en la ruta, nunca un valor de `cp` guardado aparte que se pudiera desincronizar si el punto se reordena.
- `construirPayloadSync` (`src/services/rutaBorradorService.ts`) hace lo mismo para el payload de sync (ver sección 5).
- `backendToPuntoRuta` (`src/services/rutasApi.ts`) ahora acepta `cp` como `string` o `number` al leer de vuelta, por compatibilidad.

Se incluye aquí solo para que quede documentado que ya no hay discrepancia de tipos entre frontend y backend en este campo.

---

## 4. Confirmar: ¿`DELETE /api/rutas/{id}` borra los puntos en cascada?

El swagger no trae descripción para `DELETE /api/rutas/{id}` ni para `DELETE /api/puntos-recoleccion/{id}`. Antes de que el frontend dependa de "elimino la ruta y asumo que sus puntos también desaparecen", hace falta que alguien de backend confirme el comportamiento real (¿cascada automática en la base de datos? ¿hay que borrar los puntos manualmente primero?). Si no hay cascada, el frontend necesitaría llamar primero a `GET /api/puntos-recoleccion/ruta/{rutaId}` y borrar cada uno antes de borrar la ruta.

---

## 5. Sync por lotes de puntos — no es un bloqueo, es una mejora opcional

El plan original contemplaba `POST /api/puntos-recoleccion/sync` (mandar de una sola vez los puntos nuevos/editados/eliminados de una ruta). **Ese endpoint no existe** en el swagger actual. No es necesario crearlo: el frontend puede lograr lo mismo llamando a los endpoints individuales que sí existen (`POST`, `PUT`, `DELETE` sobre `/api/puntos-recoleccion/{id}`) una vez por cada punto que cambió. Es más peticiones de red, pero funciona con lo que ya está construido. Si backend quiere ofrecer el batch más adelante por eficiencia, sería una mejora, no un requisito.

---

## 6. Geometría vial — no es responsabilidad de backend (por ahora)

El cálculo de la ruta real por calles (en vez de líneas rectas entre puntos) ya se resolvió enteramente del lado del frontend, hablando directo con un servicio de ruteo externo (compatible con la API de OSRM). **No se necesita ningún endpoint de backend para esto.** Se menciona aquí solo por transparencia: si backend prefiere centralizar ese cálculo más adelante (por ejemplo, para no depender de un servicio externo desde el navegador de cada usuario), sería una decisión de arquitectura a futuro, no un pendiente actual.

---

## 7. Estado de publicación de ruta — función nueva, no una promesa incumplida

El plan contempla que una ruta pueda pasar por estados (`BORRADOR` → `VALIDA` → `PUBLICADA`) antes de ser visible para la app móvil del conductor. Hoy esto **no existe en backend, y tampoco se está pidiendo con urgencia** — es una función a futuro. Si se decide implementarla, necesitaría un campo de estado en `Ruta` (o reusar el campo `eliminado` de forma más granular) y una regla clara de qué endpoint puede cambiar ese estado.

---

## 8. Posibles bugs de documentación en el swagger (revisar, no necesariamente arreglar)

Dos cosas llamaron la atención al revisar `doc.json` — probablemente son errores de copy-paste en las anotaciones de Go (`swag`), no del comportamiento real, pero vale la pena que alguien de backend los confirme:

- `PUT /api/rutas/{id}` tiene documentado como body `entities.UpdateEstadoCamionRequest` (que es para actualizar el estado de un camión, no una ruta).
- `GET /api/rutas/` y `GET /api/camion/` documentan ambos su respuesta 200 como `entities.EstadoCamionListResponse`.

Si el comportamiento real coincide con la documentación (y no es solo la anotación), esos dos endpoints no están haciendo lo que su nombre indica.

---

## 9. Selector de camión hardcodeado (limitación conocida del frontend, no un pedido a backend)

El modal de selección de camión del Diseñador muestra "Camión 1", "Camión 2", "Camión 3" fijos en el código, no viene de `GET /api/camion/`. Se documenta aquí porque, si se conecta a ese endpoint real más adelante, hay que tener en cuenta que `entities.Camion` no tiene un nombre simple como "Camión 1" — se identifica por `placa`, `modelo`, `tipo_camion_id` y `disponibilidad_id`. Habría que diseñar cómo se muestra eso en el selector (probablemente `placa` + `modelo`).

---

## 10. Lo que SÍ funciona hoy, confirmado (no hace falta tocarlo)

- `POST /api/rutas/` (crea ruta, requiere `nombre` y `json_ruta`), `GET /api/rutas/`, `GET /api/rutas/{id}`, `GET /api/rutas/activas`.
- `POST /api/puntos-recoleccion/`, `GET /api/puntos-recoleccion/ruta/{rutaId}`, `PUT /api/puntos-recoleccion/{id}`, `DELETE /api/puntos-recoleccion/{id}`.
- `POST /api/empleados/login` — devuelve `token` y `data` (con `rol_id`), consistente con lo que el frontend ya espera decodificar del JWT.
- La forma de `json_ruta` que consume la app móvil (`[{ "latitud": ..., "longitud": ... }]`) — confirmada, no se toca.

---

## 11. Prioridad sugerida para conversar con backend

1. **Sección 2 (camión + color en `Ruta`)** — esto es lo único que realmente bloquea que el Diseñador funcione bien hoy.
2. **Sección 4 (cascada al eliminar)** — rápido de confirmar, evita sorpresas.
3. **Sección 8 (bugs de documentación)** — rápido de revisar.
4. Todo lo demás (secciones 5, 6, 7, 9) puede esperar o resolverse sin tocar backend. La sección 3 (`cp`) ya no requiere nada — quedó resuelta del lado del frontend.
