# Qué datos envía (o planea enviar) el mapa — para ajustar el backend

Este documento es la contraparte de `REQUISITOS_BACKEND_MAPA.md`: mientras aquel explica qué le falta al backend, este explica **exactamente qué manda el frontend hoy, y qué está listo para mandar en cuanto el backend lo soporte**, con los payloads reales tal cual están implementados en el código (no aproximaciones). Es para que el encargado de backend pueda revisar campo por campo qué ajustes se necesitan.

Se divide en tres partes:

1. **Lo que el mapa ya envía hoy en producción.**
2. **Lo que el mapa ya tiene construido y listo para enviar, pero apagado hasta que backend lo soporte.**
3. **Lo que el mapa calcula pero todavía no envía a ningún lado** (por si backend quiere empezar a recibirlo).

---

## 1. Lo que el mapa ya envía hoy

### 1.1 Crear una ruta

```
POST /api/rutas/
```

Cuerpo exacto que se manda (`construirRutaBackend` en `src/services/rutasApi.ts`):

```json
{
  "nombre": "Ruta Centro",
  "descripcion": "Ruta principal de recoleccion",
  "camion_id": 2,
  "color": "#2563eb",
  "json_ruta": [
    { "latitud": 16.62345, "longitud": -93.09321 },
    { "latitud": 16.62410, "longitud": -93.09200 }
  ]
}
```

Notas:

- `json_ruta` es siempre un arreglo plano de `{ latitud, longitud }`, en el orden real de la ruta. Esta forma **no se debe cambiar** (confirmado que la app móvil del conductor ya la consume así).
- `camion_id` y `color` se mandan siempre, pero como la entidad `Ruta` real no los tiene, backend los descarta en silencio hoy. Esto es exactamente lo que se necesita que backend empiece a aceptar y guardar (ver `REQUISITOS_BACKEND_MAPA.md`, sección 2).
- `camion_id` es el id que el operador elige en el modal "Seleccione el camión" (hoy son valores fijos 1, 2 o 3 en el frontend, no vienen de `GET /api/camion/`).
- `color` es un string hexadecimal (`#rrggbb`), asignado automáticamente por camión (`utils/ColoresCamion.tsx`) si no se especifica otro.

### 1.2 Editar una ruta existente

```
PUT /api/rutas/{ruta_id}
```

Mismo cuerpo exacto que en 1.1 (se reconstruye completo desde los puntos actuales, no es un parche parcial).

### 1.3 Eliminar una ruta

```
DELETE /api/rutas/{ruta_id}
```

Sin cuerpo. El frontend no manda nada más; asume (sin confirmar todavía) que backend se encarga de los puntos asociados.

### 1.4 Listar rutas

```
GET /api/rutas/
GET /api/rutas/{ruta_id}
```

El frontend no manda cuerpo; lee `ruta_id`, `nombre`, `descripcion`, `json_ruta`, y (hoy sin efecto real) intenta leer `camion_id`/`color` de la respuesta. Si no vienen, el camión cae a `0` y el color se recalcula localmente.

### 1.5 Login

```
POST /api/empleados/login
{ "email": "...", "password": "..." }
```

Sin cambios pedidos aquí; se incluye solo por completitud. El frontend decodifica el JWT devuelto en `token` para obtener `user_id`, `role_id` (`rol_id` en el swagger) y `exp`.

---

## 2. Lo que el mapa ya tiene listo, pero apagado hasta que backend lo soporte

Estas dos cosas están completamente implementadas y probadas del lado del frontend (con pruebas automatizadas), pero no se activan porque el endpoint que necesitan no existe todavía o no está confirmado.

### 2.1 Sincronizar puntos de una ruta por lotes (`sync`)

```
POST /api/puntos-recoleccion/sync
```

Payload que ya arma el frontend (`construirPayloadSync` en `src/services/rutaBorradorService.ts`), listo para mandarse en cuanto se confirme que el endpoint existe:

```json
{
  "ruta_id": 10,
  "nuevos": [
    { "cp": "3", "lat": 16.6250, "lon": -93.0910, "orden": 3 }
  ],
  "actualizados": [
    { "punto_id": 45, "cp": "1", "lat": 16.6234, "lon": -93.0932, "orden": 1 }
  ],
  "eliminados": [47, 48]
}
```

Notas:

- `cp` se manda siempre como `string`, calculado con `String(orden)` — nunca un valor de `cp` guardado aparte que se pudiera desincronizar si el punto se reordena. Esto ya está corregido en el código (antes se mandaba como `number`).

- `nuevos`: puntos que el operador agregó en esta sesión de edición, todavía sin `punto_id` real.
- `actualizados`: puntos que ya existían (tienen `punto_id` real) y cambiaron de posición u orden.
- `eliminados`: `punto_id` reales que ya no están en la ruta.
- Este es el **formato propuesto por el frontend**, no un contrato ya acordado. Si backend construye este endpoint, hay que confirmar que espera exactamente esta forma (o ajustar el frontend a la forma real que backend defina — es fácil de cambiar, está en un solo lugar del código).
- Alternativa si backend no quiere construir un endpoint de batch: el frontend puede lograr el mismo resultado llamando varias veces a los endpoints individuales que ya existen y confirmamos que funcionan:

```
POST   /api/puntos-recoleccion/          (uno por cada punto en "nuevos", sin el campo cp o con el cp calculado)
PUT    /api/puntos-recoleccion/{id}      (uno por cada punto en "actualizados")
DELETE /api/puntos-recoleccion/{id}      (uno por cada id en "eliminados")
```

Cuerpo para cada punto individual (`PuntoRecoleccionRequest` en `src/services/puntosRecoleccionApi.ts`), ya implementado y listo:

```json
{ "cp": "1", "lat": 16.6234, "lon": -93.0932, "ruta_id": 10 }
```

`cp` ya se manda como `string` (`String(orden)`), coincidiendo con lo que define el swagger real en `PuntoRecoleccion`/`CreatePuntoRecoleccionRequest`. Al leer de vuelta, `backendToPuntoRuta` (`src/services/rutasApi.ts`) acepta `cp` como `string` o `number` por si acaso.

### 2.2 Asociar la ruta a un camión con color (una vez que backend lo soporte)

Ya cubierto en la sección 1.1 — no es un payload nuevo, es que backend empiece a aceptar y devolver los campos `camion_id` y `color` que el frontend ya manda hoy.

---

## 3. Lo que el mapa calcula pero todavía NO envía a ningún lado

Esto no es un pedido activo, es informativo: si backend quiere empezar a recibir/guardar esto en el futuro, aquí está la forma que ya existe internamente en el frontend.

### 3.1 Geometría oficial por calles

Se calcula en el navegador (`src/services/rutaVialService.ts`), consultando un servicio externo compatible con OSRM. Hoy es puramente una vista previa local; **no se manda a backend ni se guarda en ningún lado**. La forma que ya existe internamente, por si se quisiera persistir más adelante:

```json
{
  "puntos": [
    [16.62345, -93.09321],
    [16.62360, -93.09280],
    [16.62410, -93.09200]
  ],
  "distanciaMetros": 1234.5,
  "duracionSegundos": 210.3
}
```

Si backend quisiera guardar esto (por ejemplo, para que la app móvil dibuje la geometría real en vez de líneas rectas), necesitaría un campo nuevo y separado de `json_ruta` (que, como ya se explicó, no se puede tocar). Algo como `geometria_oficial` en `Ruta`, con esta misma forma o el formato GeoJSON estándar (`LineString`).

### 3.2 Estado de publicación de la ruta

Se maneja hoy solo en memoria del navegador (`src/models/rutaBorrador.ts`, campo `estadoPublicacion`), con los valores `BORRADOR`, `VALIDANDO`, `VALIDA`, `ERROR`, `PUBLICADA`. **No se manda a backend, se pierde al recargar la página.** Si backend quisiera manejar esto de verdad, necesitaría un campo de estado en `Ruta` y un endpoint (o el mismo `PUT`) que lo actualice, y decidir la regla de negocio de qué rutas puede ver la app móvil del conductor (probablemente solo las `PUBLICADA`).

---

## 4. Resumen para quien va a ajustar el backend

| Dato | ¿Se envía hoy? | ¿A dónde? | ¿Backend lo guarda hoy? |
|---|---|---|---|
| `nombre`, `descripcion`, `json_ruta` (arreglo de puntos) | Sí | `POST`/`PUT /api/rutas/` | Sí |
| `camion_id`, `color` | Sí | `POST`/`PUT /api/rutas/` | **No — se descarta en silencio** |
| Puntos individuales (`cp`, `lat`, `lon`, `ruta_id`) | No (implementado, sin usar) | `POST`/`PUT`/`DELETE /api/puntos-recoleccion/{id}` | Sí, si se llamara |
| Payload de sync por lotes | No (implementado, apagado) | `POST /api/puntos-recoleccion/sync` | No existe el endpoint |
| Geometría oficial por calles | No | — (no se manda a ningún lado) | No aplica |
| Estado de publicación de ruta | No | — (no se manda a ningún lado) | No aplica |
