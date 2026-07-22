# PLAN_DE_SEGUIMIENTO

Nota de coordinacion:

El proyecto ahora cuenta con un plan complementario obligatorio para adaptar el modulo al plan proporcionado por el administrador:

```txt
PLAN_ADAPTACION_ADMIN.md
```

Ese documento no reemplaza este plan. Lo complementa y debe revisarse antes de implementar cambios relacionados con modo borrador, sincronizacion por lotes, geometria vial, `json_ruta` oficial o publicacion de rutas para la app movil.

El contrato real de backend ya fue confirmado por revision directa del codigo fuente (`gin-backend`), en dos rondas: 2026-07-19 (primera revision) y 2026-07-19 (segunda revision, tras una actualizacion del equipo de backend). Ver seccion 14 para el detalle completo y vigente. Las secciones 5 y 6 de este documento ya reflejan ese contrato confirmado.

## 1. Objetivo actual

Actualizar el modulo de mapa para que soporte varias rutas independientes, asociadas a camiones, con colores propios, control por capas y persistencia real en backend.

Aunque el proyecto ya renderiza el mapa con Leaflet y tiles de OpenStreetMap, se tomara como objetivo tecnico dejar toda la logica del modulo preparada alrededor de OpenStreetMap y su ecosistema. Esto significa que las rutas, puntos, capas, validaciones, futuras busquedas y calculos de trayecto deben trabajar con coordenadas reales compatibles con OSM, sin depender de estructuras propietarias de otro proveedor de mapas.

El comportamiento esperado es:

- Crear una ruta para un camion especifico.
- Mantener esa ruta guardada hasta que el usuario decida editarla o eliminarla.
- Crear rutas para otros camiones sin afectar la ruta anterior.
- Ver una ruta especifica, por ejemplo la del Camion 1 o Camion 2.
- Ver todas las rutas disponibles cuando el usuario lo requiera.
- Editar y eliminar rutas reflejando los cambios en backend.
- Evitar que una ruta desaparezca solo por cambiar de camion, vista o filtro.

## 1.1 Migracion y adaptacion completa a OpenStreetMap

### Estado actual

El frontend ya usa OpenStreetMap como proveedor visual de tiles mediante `react-leaflet`:

```tsx
<TileLayer
  attribution="&copy; OpenStreetMap contributors"
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
/>
```

Esto significa que el cambio no parte desde cero. La tarea pendiente es ordenar la arquitectura para que todo el modulo de mapas sea facil de mantener, extender y conectar con servicios compatibles con OpenStreetMap.

### Objetivo de la adaptacion

El mapa debe funcionar sobre una base clara:

- Leaflet como motor de visualizacion.
- OpenStreetMap como proveedor de tiles.
- Coordenadas reales `[latitud, longitud]` como modelo interno.
- Rutas y puntos guardados como datos geograficos, no como imagenes ni trazos visuales.
- Servicios separados para ruta base, puntos de recoleccion, relacion ruta-camion y futuras funciones geograficas.

### Cambios recomendados para facilitar rutas y puntos

1. Centralizar la configuracion del mapa en `src/constants/mapa.ts`.
   - Centro inicial.
   - Limites de Suchiapa.
   - Zoom minimo y maximo.
   - URL de tiles OpenStreetMap.
   - Attribution.

2. Crear una capa de utilidades geograficas.
   Archivo sugerido:

   ```txt
   src/services/mapaGeoService.ts
   ```

   Responsabilidades:

   - Validar si un punto esta dentro de los limites permitidos.
   - Normalizar coordenadas.
   - Convertir entre coordenadas frontend y DTO backend.
   - Calcular distancias simples si se necesita.
   - Preparar la integracion futura con ruteo por calles.

3. Separar rutas visuales de rutas persistidas.
   - La ruta visual es lo que Leaflet pinta.
   - La ruta persistida es lo que vive en backend.
   - La ruta en edicion debe estar separada de las rutas ya guardadas.

4. Preparar el mapa para multiples capas.
   `MapaDisenadorView` debe poder renderizar:

   - rutas guardadas visibles;
   - ruta actualmente en edicion;
   - puntos editables de la ruta activa;
   - puntos no editables de rutas solo visibles.

5. Mantener los puntos como entidades independientes.
   Cada punto de recoleccion debe tener:

   - identificador del backend;
   - orden o consecutivo;
   - latitud;
   - longitud;
   - `ruta_id`.

6. Preparar integracion futura con ruteo OSM.
   Si despues se requiere que la ruta siga calles reales, integrar un motor compatible con OpenStreetMap, por ejemplo:

   - OSRM;
   - GraphHopper;
   - Valhalla;
   - OpenRouteService.

   En ese caso, los puntos que seleccione el usuario serian paradas o checkpoints, y el servicio de ruteo devolveria la geometria real de la ruta por calles.

7. Preparar integracion futura con busqueda de lugares.
   Si despues se requiere buscar colonias, calles o puntos de referencia, se puede integrar Nominatim u otro servicio de geocodificacion compatible con OSM.

### Resultado esperado de esta adaptacion

Al terminar esta parte, el modulo debe quedar listo para:

- crear puntos de forma mas clara;
- editar puntos sin mezclar rutas;
- mostrar varias rutas a la vez;
- ocultar o mostrar rutas como capas;
- guardar rutas y puntos en backend;
- agregar en el futuro ruteo por calles sin reescribir toda la UI.

## 2. Diagnostico del estado actual

El proyecto ya cuenta con una base funcional:

- Vista de disenador de rutas con Leaflet.
- Seleccion de camion antes de crear ruta.
- Creacion de puntos por clic en el mapa.
- Edicion de puntos mediante marcadores arrastrables.
- Formulario para guardar datos de ruta.
- Vista de resumen de rutas.
- Vista de monitoreo.
- Proxy configurado para consumir backend mediante `/api`.

Sin embargo, el flujo actual todavia tiene limitaciones importantes:

- El servicio `rutasApi.ts` guarda y trae la ruta base, pero backend no persiste `camion_id`/`color`/`visible` dentro de `Ruta` (ver seccion 5). La relacion con el camion debe resolverse via `/api/ruta-camion`, todavia no integrado en frontend.
- No existe todavia un servicio frontend para la relacion ruta-camion (`rutaCamionApi.ts`).
- La persistencia de puntos individuales (`api/puntos-recoleccion`) ya tiene servicio, pero el guardado de puntos nuevos/editados/eliminados durante la edicion de una ruta no esta completamente integrado en el flujo de UI todavia.
- Al recargar la pagina se cargan las rutas desde backend, pero no sus puntos ni su asignacion de camion.

## 3. Archivos clave actuales

- `src/components/MapaDiseñador.tsx`: coordina seleccion de camion, guardado, edicion, eliminacion y vista del mapa.
- `src/components/MapaDiseñadorView.tsx`: renderiza Leaflet, marcadores y polilineas por capa.
- `src/components/ResumenRutas.tsx`: lista rutas disenadas con acciones de ver, editar y eliminar.
- `src/hooks/useRutaDiseñador.ts`: maneja puntos activos de la ruta en edicion.
- `src/hooks/useRutasDiseñadas.ts`: mantiene rutas en memoria, sincronizadas con `rutasApi.ts`.
- `src/services/rutasApi.ts`: adapta la ruta local a payload de backend, `GET/POST/PUT/DELETE /api/rutas/`.
- `src/services/puntosRecoleccionApi.ts`: CRUD de `api/puntos-recoleccion`.
- `src/services/rutaService.ts`: convierte coordenadas a puntos y crea el objeto local de ruta.
- `src/models/rutaDiseñada.ts`: define `RutaDiseñada`, `PuntoRuta` y helpers de coordenadas.
- `src/utils/ColoresCamion.tsx`: asigna colores por camion (calculado en frontend, backend no guarda `color`).
- `src/services/rutaCamionApi.ts`: **pendiente de crear**, para consumir el modulo real `/api/ruta-camion` (ver seccion 5 y `PLAN_ADAPTACION_ADMIN.md` seccion 6.1).

Nota: algunos nombres de archivo usan la letra ene con tilde en el proyecto real. En este documento se escriben sin acento cuando sea necesario para facilitar lectura y busqueda.

## 4. Problemas a resolver

### 4.1 Multiples rutas

Ya resuelto en frontend: cada ruta es una entidad independiente con sus propios puntos, color y estado de visibilidad, separada por `ruta_id`/`camion_id`.

### 4.2 Colores independientes

Ya resuelto: color calculado en frontend a partir de `camion_id` (backend no guarda `color`).

### 4.3 Capas y visibilidad

Ya resuelto: selector de "todas las rutas" o "una ruta especifica", con filtro de rutas visibles.

### 4.4 Persistencia real en backend

Estado real confirmado (ver seccion 5 para el detalle):

- Ruta base: `POST/GET/PUT/DELETE /api/rutas/` — implementado y funcionando, pero sin `camion_id`/`color`/`visible` en backend.
- Relacion ruta-camion: `POST/GET/PUT/DELETE /api/ruta-camion/` — existe en backend, **falta integrarlo en frontend**.
- Puntos de recoleccion: `POST/GET/PUT/DELETE /api/puntos-recoleccion` — servicio ya creado en frontend, falta terminar de integrarlo en el flujo de guardado/edicion de la UI.
- Eliminacion en cascada de puntos al eliminar una ruta: no existe en backend: el frontend debe eliminar los puntos de una ruta explicitamente antes o despues de eliminar la ruta.

### 4.5 Separacion entre ruta y puntos

El flujo correcto, ya soportado por los servicios existentes:

1. Enviar la ruta base a `POST /api/rutas/`.
2. Obtener el `ruta_id` devuelto por backend.
3. Enviar la asignacion de camion a `POST /api/ruta-camion/` con ese `ruta_id`.
4. Enviar cada punto a `POST /api/puntos-recoleccion` usando ese `ruta_id`.
5. Guardar el identificador de cada punto para poder editarlo o eliminarlo despues.

## 5. Contrato confirmado con backend

Contrato real verificado por revision directa del codigo fuente de `gin-backend` (ver seccion 14 para el detalle completo).

```txt
GET    /api/rutas/
GET    /api/rutas/:id
POST   /api/rutas/
PUT    /api/rutas/:id
DELETE /api/rutas/:id
GET    /api/rutas/activas

GET    /api/ruta-camion/
GET    /api/ruta-camion/:id
GET    /api/ruta-camion/camion/:camion_id
GET    /api/ruta-camion/ruta/:ruta_id
GET    /api/ruta-camion/exists/:id
POST   /api/ruta-camion/
PUT    /api/ruta-camion/:id
DELETE /api/ruta-camion/:id

GET    /api/puntos-recoleccion
GET    /api/puntos-recoleccion/:id
GET    /api/puntos-recoleccion/ruta/:rutaId
POST   /api/puntos-recoleccion
PUT    /api/puntos-recoleccion/:id
DELETE /api/puntos-recoleccion/:id
```

Payload real para crear o actualizar la ruta base (backend solo acepta estos campos; cualquier otro se ignora):

```json
{
  "nombre": "Ruta Centro",
  "descripcion": "Ruta principal de recoleccion",
  "json_ruta": [{ "latitud": 16.62345, "longitud": -93.09321 }]
}
```

`camion_id` y `color` **no** van en este payload. `color` se calcula en frontend. `camion_id` se guarda y consulta por separado:

```json
{
  "ruta_id": 10,
  "camion_id": 1,
  "fecha": "2026-07-19"
}
```

enviado a `POST /api/ruta-camion/`.

Payload real para cada punto, enviado a `POST /api/puntos-recoleccion` una vez que se tiene el `ruta_id`:

```json
{
  "cp": "1",
  "lat": 16.62345,
  "lon": -93.09321,
  "ruta_id": 10
}
```

Advertencias confirmadas sobre este payload (ver seccion 14 para el detalle):

- `cp` debe enviarse como **string**, no numero: el backend lo tipa como `string` y lo guarda en la columna `direccion`.
- `lat`/`lon` no se guardan en Postgres, solo se cachean en Redis: existe riesgo real de perdida de coordenadas si Redis pierde datos.
- La tabla `punto_recoleccion` ya tiene columna `orden`, pero el codigo Go todavia no la lee ni la escribe: no enviar `orden` esperando que backend lo persista todavia.

## 6. Modelo frontend propuesto

Actualizar el modelo interno de ruta para soportar capas y persistencia:

```ts
export interface RutaDiseñada {
  ruta_id: number | null;
  camion_id: number | null; // resuelto via rutaCamionApi, no viene embebido en /api/rutas/
  nombre: string;
  descripcion: string;
  color: string; // calculado en frontend a partir de camion_id
  visible: boolean;
  puntos: PuntoRuta[];
}
```

Actualizar tambien el modelo de punto para guardar el identificador real del backend:

```ts
export interface PuntoRuta {
  punto_id: number | null;
  cp: string; // string, no numero: asi lo espera el backend
  orden: number; // se mantiene en frontend; backend todavia no lo persiste
  lat: number;
  lon: number;
}
```

Notas:

- `cp` debe mapearse como string al enviarse a `api/puntos-recoleccion`, aunque internamente se use para ordenar.
- `orden` puede mantenerse en frontend mientras backend no lo persista; no depender de que sobreviva a un recargue completo hasta que backend actualice `PuntoRecoleccion`/`PostgresPuntoRecoleccion.go`.
- `camion_id` debe resolverse cruzando con `/api/ruta-camion/ruta/:ruta_id`, no asumirse dentro de la respuesta de `GET /api/rutas/`.

Opcional para estado de sincronizacion:

```ts
type EstadoSincronizacion = "sincronizada" | "guardando" | "error";
```

Esto permitiria mostrar errores si backend falla al guardar, editar o eliminar.

## 7. Arquitectura propuesta por capas

### 7.1 Servicio de API

`src/services/rutasApi.ts` ya administra la ruta base:

```ts
listarRutas()
obtenerRuta(rutaId)
crearRuta(ruta)
actualizarRuta(ruta)
eliminarRuta(rutaId)
```

Responsabilidades:

- Convertir modelo frontend a DTO backend (solo `nombre`, `descripcion`, `json_ruta`).
- Convertir respuesta backend a `RutaDiseñada`.
- No depender de `json_ruta` para editar puntos individuales.
- Manejar errores de `apiRequest`.

`src/services/puntosRecoleccionApi.ts` ya administra los puntos:

```ts
listarPuntosPorRuta(rutaId)
crearPuntoRecoleccion(punto)
actualizarPuntoRecoleccion(punto)
eliminarPuntoRecoleccion(puntoId)
reemplazarPuntosDeRuta(rutaId, puntos)
```

**Pendiente de crear** `src/services/rutaCamionApi.ts` para administrar la relacion ruta-camion:

```ts
listarAsignaciones()
obtenerAsignacionPorId(id)
obtenerAsignacionPorRuta(rutaId)
obtenerAsignacionPorCamion(camionId)
crearAsignacion(rutaId, camionId, fecha)
actualizarAsignacion(id, rutaId, camionId, fecha)
eliminarAsignacion(id)
```

`reemplazarPuntosDeRuta` debe definirse con cuidado:

- Backend permite borrar solo por punto individual (`DELETE /api/puntos-recoleccion/:id`); no hay borrado masivo por `ruta_id`.
- Si se edita un solo punto, preferir `PUT /api/puntos-recoleccion/:id`.

### 7.2 Hook de rutas

`useRutasDiseñadas` ya coordina estado y backend para la ruta base:

```ts
rutasDiseñadas
rutasVisibles
rutaSeleccionadaId
modoVisualizacion
cargando
error
cargarRutas()
guardarRuta()
eliminarRuta()
obtenerRutaPorCamion()
seleccionarRuta()
verTodas()
```

Pendiente: integrar la carga de `camion_id` por ruta usando el futuro `rutaCamionApi.ts`, y la carga de puntos de cada ruta usando `puntosRecoleccionApi.listarPuntosPorRuta`.

Modos de visualizacion ya implementados:

```ts
type ModoVisualizacionRutas = "todas" | "una";
```

### 7.3 Vista de mapa por capas

`MapaDiseñadorView` ya recibe rutas visibles y renderiza una `Polyline` por ruta con color propio, mas marcadores editables para la ruta en edicion.

### 7.4 Menu desplegable de rutas

Ya implementado en `MapaDiseñador.tsx`: selector con "Todas las rutas" y una opcion por ruta (`Camion N - Nombre`).

## 8. Flujo de usuario propuesto

### 8.1 Crear ruta

1. Usuario entra al disenador.
2. Selecciona un camion.
3. Si el camion ya tiene ruta, se muestra la ruta existente y opciones de ver, editar o eliminar.
4. Si no tiene ruta, se permite dibujar una ruta nueva.
5. Usuario agrega puntos en el mapa.
6. Usuario finaliza ruta y llena formulario.
7. Frontend envia `POST /api/rutas/` (solo `nombre`, `descripcion`, `json_ruta`).
8. Backend responde con `ruta_id`.
9. Frontend envia `POST /api/ruta-camion/` con ese `ruta_id` y el `camion_id` seleccionado (pendiente de integrar).
10. Frontend envia cada punto a `POST /api/puntos-recoleccion` con `cp` (string), `lat`, `lon` y `ruta_id`.
11. Frontend guarda los ids devueltos por cada punto.
12. La ruta queda guardada, visible y asociada al camion.

### 8.2 Editar ruta

1. Usuario selecciona una ruta existente.
2. El mapa muestra solo esa ruta en modo edicion.
3. Usuario mueve puntos, agrega puntos o modifica formulario.
4. Si cambia nombre o descripcion, frontend envia `PUT /api/rutas/:id`.
5. Si cambia el camion asignado, frontend envia `PUT /api/ruta-camion/:id` (pendiente de integrar).
6. Si cambia un punto existente, frontend envia `PUT /api/puntos-recoleccion/:id`.
7. Si agrega un punto nuevo, frontend envia `POST /api/puntos-recoleccion` con el mismo `ruta_id`.
8. Si elimina un punto, frontend envia `DELETE /api/puntos-recoleccion/:id`.
9. La respuesta actualiza el estado local.
10. La ruta conserva su color (calculado en frontend) y camion.

### 8.3 Eliminar ruta

1. Usuario selecciona eliminar.
2. Se muestra confirmacion.
3. Frontend elimina los puntos asociados explicitamente (backend no tiene eliminacion en cascada).
4. Frontend elimina la asignacion en `/api/ruta-camion/:id` si existe (a confirmar si backend lo hace en cascada).
5. Frontend envia `DELETE /api/rutas/:id`.
6. Si backend confirma, se elimina del estado local.
7. Si estaba seleccionada, la vista cambia a todas o a ninguna ruta.

### 8.4 Ver rutas

1. Usuario abre el menu desplegable.
2. Puede seleccionar una ruta especifica.
3. Puede seleccionar todas las rutas.
4. Las rutas no seleccionadas no deben renderizarse cuando el modo sea una sola ruta.

## 9. Orden recomendado de implementacion

### 9.1 Base OpenStreetMap y arquitectura geografica — COMPLETADA

Toda esta base ya esta implementada: constantes centralizadas, `mapaGeoService.ts`, tipo `Coordenada`, separacion de ruta en edicion/guardadas/visibles, `MapaDiseñadorView` parametrizado.

### 9.2 Confirmado con backend y pendiente de integrar

1. ~~Confirmar contrato real del backend para rutas y camiones.~~ Completado, ver seccion 5 y 14.
2. ~~Definir si `camion_id` se guarda en tabla de rutas o en una relacion aparte.~~ Confirmado: relacion aparte, `ruta_camion`.
3. ~~Confirmar contrato real de `api/puntos-recoleccion`.~~ Completado, ver seccion 5 y 14.
4. ~~Confirmar si los puntos usan `cp`, `lat`, `lon`, `ruta_id` y si devuelven `punto_id`.~~ Confirmado, con advertencia de tipo (`cp` string) y persistencia (`lat`/`lon` solo en Redis).
5. ~~Crear `src/services/rutaCamionApi.ts` para el modulo `/api/ruta-camion`.~~ Completado.
6. ~~Ajustar `src/models/rutaDiseñada.ts` para que `camion_id` se resuelva via `rutaCamionApi`, no se espere embebido en `Ruta`.~~ Completado: `camion_id` ahora es `number | null` y se resuelve en `useRutasDiseñadas.cargarRutas`.
7. ~~Ajustar `puntosRecoleccionApi.ts`/`rutaService.ts` para enviar `cp` como string.~~ Completado: `PuntoRuta.cp` ahora es `string` en el modelo y en los adaptadores de `rutasApi.ts`/`puntosRecoleccionApi.ts`.
8. ~~Rehacer `useRutasDiseñadas` para cargar, por cada ruta, su asignacion de camion y sus puntos desde backend al iniciar.~~ Completado (`enriquecerRuta` en `useRutasDiseñadas.ts`).
9. ~~Implementar persistencia completa de puntos durante creacion y edicion de ruta.~~ Completado con `reemplazarPuntosDeRuta` (borra y recrea todos los puntos de la ruta en cada guardado; no hay diff parcial porque backend no lo soporta).
10. ~~Implementar eliminacion explicita de puntos y de la asignacion ruta-camion al eliminar una ruta.~~ Completado (best-effort en `useRutasDiseñadas.eliminarRuta`).
11. ~~Validar recarga de pagina: rutas, su camion asignado y sus puntos deben volver desde backend.~~ Implementado; falta la validacion manual/end-to-end contra un backend real corriendo (no se pudo ejecutar `npm run build`/levantar la app en este sandbox, ver seccion 14.5).
12. Validar que editar una ruta no afecte rutas de otros camiones.
13. Validar que eliminar una ruta no borre ni oculte rutas no relacionadas.

## 10. Validaciones obligatorias

Casos minimos a probar:

- Crear ruta para Camion 1.
- Crear ruta para Camion 2 con otro color.
- Ver solo Camion 1.
- Ver solo Camion 2.
- Ver todas las rutas.
- Editar Camion 1 sin modificar Camion 2.
- Eliminar Camion 1 sin afectar Camion 2.
- Recargar pagina y confirmar que las rutas, su camion asignado y sus puntos se cargan desde backend.
- Intentar crear ruta para un camion que ya tiene ruta y mostrar opcion clara de editar o reemplazar.
- Confirmar que `Limpiar` solo limpia la ruta en edicion, no elimina una ruta ya guardada.
- Confirmar que `cp` se envia como string y no provoca error de validacion en backend.

Comandos de validacion frontend:

```bash
npm run build
npm run lint
```

El build ejecuta TypeScript mediante `tsc -b`.

## 11. Riesgos tecnicos

- Las coordenadas `lat`/`lon` de los puntos solo se cachean en Redis, no se guardan en Postgres: riesgo real de perdida de datos si Redis se reinicia sin persistencia. Requiere cambio en backend, ver `REQUISITOS_BACKEND_PLAN_ADAPTACION_ADMIN.md`.
- ~~El tipo de `cp` (string en backend, numero en el codigo frontend actual)~~ — corregido: `PuntoRuta.cp` ahora es `string` en el modelo y en los adaptadores. Pendiente confirmar contra backend real que el binding ya no falle.
- La columna `orden` ya existe en la tabla `punto_recoleccion`, pero el backend no la usa: no asumir que se persiste hasta que backend lo confirme.
- Eliminar una ruta no elimina en cascada sus puntos ni su asignacion en `ruta_camion`: el frontend debe hacerlo explicitamente para evitar registros huerfanos.
- Dibujar muchas rutas con muchos puntos puede afectar rendimiento; conviene renderizar solo capas visibles.
- Hay riesgo de mezclar ruta en edicion con rutas visibles si no se separan estados.
- Si se usa `window.confirm` para todo, la experiencia puede sentirse limitada; a futuro conviene usar modales propios.

## 12. Checklist

- [x] Centralizar configuracion OpenStreetMap en `src/constants/mapa.ts`.
- [x] Agregar URL de tiles y attribution como constantes reutilizables.
- [x] Crear `src/services/mapaGeoService.ts`.
- [x] Mover validaciones de coordenadas al servicio geografico.
- [x] Normalizar conversiones entre coordenadas frontend y DTO backend.
- [x] Separar ruta en edicion, rutas guardadas y rutas visibles.
- [x] Preparar `MapaDiseñadorView` para multiples capas sobre OpenStreetMap.
- [x] Dejar documentada la integracion futura con OSRM, GraphHopper, Valhalla u OpenRouteService.
- [x] Confirmar endpoints reales disponibles en backend (dos rondas, ver seccion 14).
- [x] Confirmar si backend acepta y devuelve `camion_id` en `Ruta`. Confirmado: no. Se resuelve via `/api/ruta-camion`.
- [x] Confirmar formato exacto de respuesta de `GET /api/rutas/`. Confirmado: `{ ruta_id, nombre, descripcion, json_ruta, eliminado, created_at }`.
- [x] Confirmar formato exacto de `api/puntos-recoleccion`. Confirmado, ver seccion 14.
- [x] Confirmar si `api/puntos-recoleccion` recibe `cp`, `lat`, `lon`, `ruta_id`. Confirmado con advertencia: `cp` es string, `lat`/`lon` no persisten en Postgres.
- [x] Confirmar si `api/puntos-recoleccion` devuelve id del punto creado. Confirmado: devuelve `punto_id`.
- [x] Confirmar si existe relacion ruta-camion en backend. Confirmado: si, via modulo `/api/ruta-camion` (agregado en la segunda revision).
- [x] Actualizar modelo `RutaDiseñada`.
- [x] Actualizar modelo `PuntoRuta` con `punto_id`, `cp`, `lat` y `lon`.
- [x] Agregar color por camion/ruta (calculado en frontend).
- [x] Implementar `listarRutas` en `rutasApi.ts`.
- [x] Implementar `actualizarRuta` en `rutasApi.ts`.
- [x] Implementar `eliminarRuta` en `rutasApi.ts`.
- [x] Crear `puntosRecoleccionApi.ts`.
- [x] Implementar `listarPuntosPorRuta`.
- [x] Implementar `crearPuntoRecoleccion`.
- [x] Implementar `actualizarPuntoRecoleccion`.
- [x] Implementar `eliminarPuntoRecoleccion`.
- [x] Crear adaptadores frontend/backend.
- [x] Cargar rutas desde backend al abrir el mapa.
- [x] Crear `rutaCamionApi.ts` para `/api/ruta-camion`.
- [x] Cargar la asignacion de camion de cada ruta desde `/api/ruta-camion` al abrir el mapa.
- [x] Cargar puntos de cada ruta desde `api/puntos-recoleccion` al abrir el mapa (si no hay puntos persistidos todavia, se usa el fallback de `json_ruta`).
- [x] Persistir creacion de ruta contra `api/rutas`.
- [x] Enviar `cp` como string a `api/puntos-recoleccion` (corregido en el modelo `PuntoRuta` y los adaptadores).
- [x] Persistir creacion de puntos contra `api/puntos-recoleccion` (via `reemplazarPuntosDeRuta` al guardar la ruta en `MapaDiseñador.tsx`).
- [x] Persistir creacion de asignacion ruta-camion contra `api/ruta-camion`.
- [x] Persistir edicion de ruta contra `api/rutas`.
- [x] Persistir edicion de puntos contra `api/puntos-recoleccion`. Para una ruta ya existente (modo borrador, `PLAN_ADAPTACION_ADMIN.md` Fase 3) se usa `guardarPuntosBorrador`: crea solo los puntos nuevos y elimina solo los marcados, en vez de borrar y recrear todo. Para una ruta nueva se sigue usando `reemplazarPuntosDeRuta`.
- [x] Persistir edicion de asignacion ruta-camion contra `api/ruta-camion` (si cambia el camion).
- [x] Persistir eliminacion de puntos contra `api/puntos-recoleccion` (al eliminar una ruta, y como parte de `reemplazarPuntosDeRuta` al editar).
- [x] Persistir eliminacion de ruta contra `api/rutas`.
- [x] Persistir eliminacion de asignacion ruta-camion contra `api/ruta-camion` (best-effort al eliminar ruta).
- [x] Crear selector desplegable de rutas.
- [x] Agregar opcion "Todas las rutas".
- [x] Agregar opcion "Solo ruta seleccionada".
- [x] Renderizar multiples rutas como capas independientes.
- [x] Renderizar colores distintos por ruta.
- [x] Separar ruta en edicion de rutas visibles.
- [x] Ajustar `ResumenRutas` para acciones por ruta.
- [ ] Validar que una ruta no desaparezca al cambiar de camion.
- [ ] Validar que editar una ruta no afecte otras.
- [ ] Validar que eliminar una ruta solo borre la seleccionada.
- [ ] Actualizar README si cambia el flujo de uso.

## 13. Siguiente paso recomendado

Actualizado (2026-07-19, tras completar la integracion de `ruta-camion` y `puntos-recoleccion`):

Ya estan implementados: `rutaCamionApi.ts`, la correccion de tipo de `cp`, la carga de asignacion de camion y puntos por ruta al abrir el mapa, y la persistencia de creacion/edicion/eliminacion de puntos y de la asignacion ruta-camion durante el flujo de guardado/eliminacion de una ruta (ver checklist, seccion 12).

Verificado con `npx tsc -b` y `npx eslint .` (limpios en cada paso). No se pudo validar `npm run build` end-to-end por un problema de entorno del sandbox (falta el binario nativo `@rollup/rollup-linux-x64-gnu`), ni probar el flujo contra un backend real corriendo.

Pendiente real, no resuelto desde frontend:

- Validar manualmente (con la app corriendo contra el backend real) que `cp` como string no rompe el binding en `POST/PUT /api/puntos-recoleccion`.
- Confirmar que el patron "borrar todos los puntos y recrearlos" (`reemplazarPuntosDeRuta`) no genere problemas de rendimiento o de IDs cambiantes en uso real; el plan del administrador (`PLAN_ADAPTACION_ADMIN.md` Fase 1-3) propone un modelo de borrador con IDs temporales y deteccion de cambios que evitaria este borrar-y-recrear completo.

Actualizado (2026-07-20): `PLAN_ADAPTACION_ADMIN.md` ya completo en sus Fases 0 a 3 (contrato confirmado, modelos de borrador, servicio de borrador, integracion en UI). El patron de "borrar y recrear" ya fue reemplazado por deteccion de cambios fina (`guardarPuntosBorrador`) para rutas ya existentes. Pendiente real: prueba manual en vivo (agregar/mover/guardar/recargar contra un backend corriendo). Las Fases 4 a 7 de ese plan (sincronizacion por lotes, geometria vial, `json_ruta` oficial, publicacion) siguen bloqueadas y documentadas ahi mismo, cada una con la razon tecnica exacta por la que no se puede implementar con el backend actual.

## 14. Contrato real confirmado (backend `gin-backend`)

Revisado en modo solo lectura directamente sobre el codigo fuente, en dos rondas: 2026-07-19 (primera revision) y 2026-07-19 (segunda revision, tras actualizacion del equipo de backend). Esta seccion es la referencia autoritativa; reemplaza cualquier supuesto de las secciones anteriores del documento.

### 14.1 `api/rutas`

- Endpoints reales: `POST /api/rutas/`, `GET /api/rutas/`, `GET /api/rutas/:id`, `PUT /api/rutas/:id`, `DELETE /api/rutas/:id`, `GET /api/rutas/activas`.
- La entidad `Ruta` en backend solo tiene: `ruta_id`, `nombre`, `descripcion`, `json_ruta`, `eliminado`, `created_at`.
- No existe `camion_id`, `color` ni `visible` en la tabla `ruta` ni en la entidad Go. La tabla real usa `colonia_id` (no `camion_id`).
- Cuando el frontend envia `camion_id` y `color` en el payload de `POST/PUT /api/rutas/`, el backend los ignora silenciosamente.
- `DELETE /api/rutas/:id` hace soft delete solo en la tabla `ruta`. No elimina ni marca los `punto_recoleccion` asociados: quedan huerfanos.

### 14.2 `api/ruta-camion` (agregado en la segunda revision)

- Endpoints reales: `POST /api/ruta-camion/`, `GET /api/ruta-camion/`, `GET /api/ruta-camion/:id`, `GET /api/ruta-camion/camion/:camion_id`, `GET /api/ruta-camion/ruta/:ruta_id`, `GET /api/ruta-camion/exists/:id`, `PUT /api/ruta-camion/:id`, `DELETE /api/ruta-camion/:id`.
- Entidad `RutaCamion`: `ruta_camion_id`, `ruta_id`, `camion_id`, `fecha`, `created_at`, `eliminado`.
- Resuelve la relacion ruta-camion como recurso separado. El frontend debe cruzar `GET /api/rutas/` con `GET /api/ruta-camion/ruta/:ruta_id` para saber que camion tiene asignada cada ruta.
- Pendiente confirmar con backend: si eliminar una ruta o un camion marca automaticamente como eliminada la asignacion correspondiente, o si el frontend debe hacerlo explicitamente.

### 14.3 `api/puntos-recoleccion`

- Endpoints reales: `POST /api/puntos-recoleccion/`, `GET /api/puntos-recoleccion/`, `GET /api/puntos-recoleccion/:id`, `GET /api/puntos-recoleccion/ruta/:rutaId`, `PUT /api/puntos-recoleccion/:id`, `DELETE /api/puntos-recoleccion/:id`.
- La entidad `PuntoRecoleccion` en Go declara `punto_id`, `ruta_id`, `cp` (tipo `string`), `lat`, `lon`, `eliminado`, `created_at`.
- Riesgo de tipos: el frontend envia `cp` como numero; el backend lo espera como `string`. Puede fallar el binding JSON o guardar un valor inesperado.
- Riesgo critico de persistencia: el `INSERT`/`UPDATE` real en Postgres solo guarda `ruta_id` y el valor de `cp` (en la columna `direccion`). Las coordenadas `lat`/`lon` no se guardan en Postgres; solo se cachean en Redis bajo la llave `point:<punto_id>`. Si Redis pierde datos, las coordenadas de los puntos se pierden de forma permanente aunque el punto siga existiendo en la base de datos.
- `GET /ruta/:rutaId` y demas lecturas hidratan `lat`/`lon` leyendo Redis; si no hay dato en Redis, quedan en 0.
- Agregado en la segunda revision: la tabla `punto_recoleccion` ahora tiene columna `orden` (`DOUBLE PRECISION`), pero el codigo Go (`PuntoRecoleccion` entity y `PostgresPuntoRecoleccion.go`) no la usa todavia en ningun INSERT/UPDATE/SELECT. El esquema esta listo, el codigo pendiente.

### 14.4 Sobre `PLAN_ADAPTACION_ADMIN.md`

Confirmado en ambas revisiones que no existe en backend:

- `POST /api/puntos-recoleccion/sync`.
- Endpoint de calculo de geometria vial.
- `PATCH /api/rutas/:id/json-ruta` ni `/estado`.
- Ningun campo ni tabla de estado de publicacion (`BORRADOR`/`VALIDA`/`PUBLICADA`) para rutas.

Los modulos nuevos agregados en la segunda revision (Camion, EstadoCamion, TipoCamion, HistorialAsignacionCamion, telemetria, arribo) son para tracking operativo del camion en tiempo real; no aplican al modulo de mapa/disenador de rutas.

### 14.5 Implicacion practica

Las Fases 1 a 3 de `PLAN_ADAPTACION_ADMIN.md` (modelos de borrador, servicio de borrador, integracion en UI) avanzaron porque son logica de frontend que no depende de los endpoints faltantes. La Fase 1.5 de ese mismo plan (integrar `/api/ruta-camion`) tambien esta completa. Las Fases 4 a 7 (sync, geometria vial, `json_ruta` oficial, publicacion) siguen bloqueadas: cada una tiene, en `PLAN_ADAPTACION_ADMIN.md` seccion 11, la razon tecnica especifica (con evidencia del codigo fuente y de `docs/swagger.json`) por la que no existe el endpoint correspondiente en backend. Este agente no debe implementar esos endpoints en `gin-backend` sin autorizacion explicita, ya que las reglas del proyecto piden trabajar unicamente en `map-view`.
