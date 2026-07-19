# PLAN_DE_SEGUIMIENTO

Nota de coordinacion:

El proyecto ahora cuenta con un plan complementario obligatorio para adaptar el modulo al plan proporcionado por el administrador:

```txt
PLAN_ADAPTACION_ADMIN.md
```

Ese documento no reemplaza este plan. Lo complementa y debe revisarse antes de implementar cambios relacionados con modo borrador, sincronizacion por lotes, geometria vial, `json_ruta` oficial o publicacion de rutas para la app movil.

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
- Servicios separados para ruta base, puntos de recoleccion y futuras funciones geograficas.

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

- La vista del mapa dibuja principalmente una sola ruta activa.
- No existe un sistema de capas para mostrar u ocultar rutas.
- Las rutas no tienen un color independiente por camion o por ruta.
- El servicio `rutasApi.ts` solo guarda la ruta base con `POST /api/rutas/`.
- No existe todavia un servicio frontend para persistir cada punto en `api/puntos-recoleccion`.
- No existen llamadas frontend para listar, actualizar o eliminar rutas y puntos en backend.
- La eliminacion actual solo modifica estado local.
- La edicion actual no confirma un `PUT` o `PATCH` contra backend.
- Al recargar la pagina no hay carga inicial de rutas desde backend.
- La ruta se reemplaza por camion, pero no hay una experiencia clara para administrar historial o capas.

## 3. Archivos clave actuales

- `src/components/MapaDisenador.tsx`: coordina seleccion de camion, guardado, edicion, eliminacion y vista del mapa.
- `src/components/MapaDisenadorView.tsx`: renderiza Leaflet, marcadores y una polilinea activa.
- `src/components/ResumenRutas.tsx`: lista rutas disenadas con acciones de ver, editar y eliminar.
- `src/hooks/useRutaDisenador.ts`: maneja puntos activos de la ruta en edicion.
- `src/hooks/useRutasDisenadas.ts`: mantiene rutas en memoria local.
- `src/services/rutasApi.ts`: adapta la ruta local a payload de backend y realiza `POST /api/rutas/`.
- `src/services/puntosRecoleccionApi.ts`: servicio propuesto para crear, editar, listar y eliminar puntos de `api/puntos-recoleccion`.
- `src/services/rutaService.ts`: convierte coordenadas a puntos y crea el objeto local de ruta.
- `src/models/rutaDisenada.ts`: define `RutaDisenada`, `PuntoRuta` y helpers de coordenadas.
- `src/utils/ColoresCamion.tsx`: posible fuente para asignar colores por camion.

Nota: algunos nombres de archivo usan la letra ene con tilde en el proyecto real. En este documento se escriben sin acento cuando sea necesario para facilitar lectura y busqueda.

## 4. Problemas a resolver

### 4.1 Multiples rutas

Actualmente la experiencia esta pensada alrededor de una ruta activa. Se necesita que cada ruta sea una entidad independiente:

- Ruta de Camion 1.
- Ruta de Camion 2.
- Ruta de Camion 3.
- Etc.

Cada una debe conservar sus puntos, datos, color y estado sin mezclarse con las demas.

### 4.2 Colores independientes

Cada ruta debe mostrarse con un color propio para que no se confunda con otras rutas.

Regla recomendada:

- Usar color por `camion_id` si cada camion solo puede tener una ruta activa.
- Usar color por `ruta_id` si en el futuro un camion puede tener historial de varias rutas.

### 4.3 Capas y visibilidad

Debe existir un control de visualizacion:

- Ver todas las rutas.
- Ver solo la ruta de un camion.
- Ocultar rutas no seleccionadas.
- Mantener visible la ruta seleccionada mientras se edita.

El mapa no debe mezclar puntos de una ruta con otra.

### 4.4 Persistencia real en backend

Las acciones del usuario deben sincronizarse con backend:

- Crear ruta base: `POST /api/rutas/`.
- Crear puntos de la ruta: `POST /api/puntos-recoleccion`.
- Listar rutas: `GET /api/rutas/`.
- Listar puntos por ruta: `GET /api/puntos-recoleccion` filtrando por `ruta_id` si el backend lo permite.
- Editar ruta base: `PUT` o `PATCH /api/rutas/:id`.
- Editar puntos: `PUT` o `PATCH /api/puntos-recoleccion/:id`.
- Eliminar ruta: `DELETE /api/rutas/:id`.
- Eliminar puntos: `DELETE /api/puntos-recoleccion/:id`, o eliminacion en cascada desde backend al borrar una ruta.

El estado local debe reflejar la respuesta real del backend.

### 4.5 Separacion entre ruta y puntos

El mapa no debe enviar todos los puntos como parte definitiva de `api/rutas` si esos puntos necesitan editarse de forma individual. El flujo correcto sera:

1. Enviar la ruta base a `POST /api/rutas/`.
2. Obtener el `ruta_id` devuelto por backend.
3. Enviar cada punto a `POST /api/puntos-recoleccion` usando ese `ruta_id`.
4. Guardar el identificador de cada punto para poder editarlo o eliminarlo despues.

## 5. Contrato recomendado con backend

Antes de implementar la sincronizacion completa, confirmar que el backend soporte estos endpoints o acordar sus equivalentes:

```txt
GET    /api/rutas/
GET    /api/rutas/:id
POST   /api/rutas/
PUT    /api/rutas/:id
DELETE /api/rutas/:id

GET    /api/puntos-recoleccion
GET    /api/puntos-recoleccion/:id
POST   /api/puntos-recoleccion
PUT    /api/puntos-recoleccion/:id
DELETE /api/puntos-recoleccion/:id
```

Tambien confirmar si el backend ya acepta `camion_id`. Para este flujo es necesario que la ruta se relacione con un camion.

Payload recomendado para crear o actualizar la ruta base:

```json
{
  "nombre": "Ruta Centro",
  "descripcion": "Ruta principal de recoleccion",
  "camion_id": 1,
  "color": "#2563eb"
}
```

Si el backend no guarda `color`, el frontend puede calcularlo localmente a partir del camion.

Una vez creada la ruta, backend debe devolver el `ruta_id`. Con ese `ruta_id`, cada punto se envia a `api/puntos-recoleccion` como coordenada real:

```json
{
  "cp": 1,
  "lat": 16.62345,
  "lon": -93.09321,
  "ruta_id": 10
}
```

Significado recomendado:

- `cp`: consecutivo u orden del punto dentro de la ruta.
- `lat`: latitud real del punto.
- `lon`: longitud real del punto.
- `ruta_id`: identificador devuelto por `POST /api/rutas/`.

Si el backend usa otros nombres, por ejemplo `latitud` y `longitud`, crear un adaptador frontend para no contaminar el modelo interno.

## 6. Modelo frontend propuesto

Actualizar el modelo interno de ruta para soportar capas y persistencia:

```ts
export interface RutaDisenada {
  ruta_id: number | null;
  camion_id: number;
  nombre: string;
  descripcion: string;
  color: string;
  visible: boolean;
  puntos: PuntoRuta[];
}
```

Actualizar tambien el modelo de punto para guardar el identificador real del backend:

```ts
export interface PuntoRuta {
  punto_id: number | null;
  cp: number;
  orden: number;
  lat: number;
  lon: number;
}
```

Notas:

- `orden` puede mantenerse para el frontend si ya se usa internamente.
- `cp` debe mapearse al valor que espera `api/puntos-recoleccion`.
- Conviene normalizar a `lat` y `lon` en el modelo si el backend usara esos nombres.

Opcional para estado de sincronizacion:

```ts
type EstadoSincronizacion = "sincronizada" | "guardando" | "error";
```

Esto permitiria mostrar errores si backend falla al guardar, editar o eliminar.

## 7. Arquitectura propuesta por capas

### 7.1 Servicio de API

Ampliar `src/services/rutasApi.ts` para administrar la ruta base:

```ts
listarRutas()
obtenerRuta(rutaId)
crearRuta(ruta)
actualizarRuta(ruta)
eliminarRuta(rutaId)
```

Responsabilidades:

- Convertir modelo frontend a DTO backend.
- Convertir respuesta backend a `RutaDisenada`.
- No depender de `json_ruta` para editar puntos individuales.
- Manejar errores de `apiRequest`.

Crear `src/services/puntosRecoleccionApi.ts` para administrar los puntos:

```ts
listarPuntosPorRuta(rutaId)
crearPuntoRecoleccion(punto)
actualizarPuntoRecoleccion(punto)
eliminarPuntoRecoleccion(puntoId)
reemplazarPuntosDeRuta(rutaId, puntos)
```

DTO recomendado para crear puntos:

```ts
interface PuntoRecoleccionRequest {
  cp: number;
  lat: number;
  lon: number;
  ruta_id: number;
}
```

`reemplazarPuntosDeRuta` debe definirse con cuidado:

- Si backend permite eliminar puntos por `ruta_id`, borrar los puntos anteriores y recrearlos.
- Si backend solo permite borrar por punto individual, primero listar puntos existentes y eliminarlos uno por uno.
- Si se edita un solo punto, preferir `PUT/PATCH /api/puntos-recoleccion/:id`.

### 7.2 Hook de rutas

Rehacer o ampliar `useRutasDisenadas` para coordinar estado y backend:

```ts
rutas
rutaSeleccionadaId
modoVisualizacion
cargando
error
cargarRutas()
crearRuta()
actualizarRuta()
eliminarRuta()
seleccionarRuta()
verTodas()
verSoloRuta()
obtenerRutaPorCamion()
```

Modos de visualizacion recomendados:

```ts
type ModoVisualizacion = "todas" | "una";
```

### 7.3 Vista de mapa por capas

Actualizar `MapaDisenadorView` para recibir rutas visibles:

```ts
rutasVisibles: RutaDisenada[];
rutaEnEdicion?: RutaDisenada;
puntosEnEdicion: Coordenada[];
```

El mapa debe renderizar:

- Una `Polyline` por cada ruta visible.
- Color propio para cada ruta.
- Marcadores editables solo para la ruta en edicion.
- Marcadores no editables u opcionales para rutas visibles no editadas.

### 7.4 Menu desplegable de rutas

Crear o mejorar un control de seleccion:

```txt
Ver rutas:
[ Todas las rutas ]
[ Camion 1 - Ruta Centro ]
[ Camion 2 - Ruta Norte ]
[ Camion 3 - Ruta Sur ]
```

Comportamiento:

- `Todas las rutas`: muestra todas las capas.
- `Camion N`: muestra solo la ruta de ese camion.
- `Editar`: cambia a modo edicion y oculta las demas rutas.
- `Eliminar`: confirma y elimina en backend.

## 8. Flujo de usuario propuesto

### 8.1 Crear ruta

1. Usuario entra al disenador.
2. Selecciona un camion.
3. Si el camion ya tiene ruta, se muestra la ruta existente y opciones de ver, editar o eliminar.
4. Si no tiene ruta, se permite dibujar una ruta nueva.
5. Usuario agrega puntos en el mapa.
6. Usuario finaliza ruta y llena formulario.
7. Frontend envia `POST /api/rutas/`.
8. Backend responde con `ruta_id`.
9. Frontend envia cada punto a `POST /api/puntos-recoleccion` con `cp`, `lat`, `lon` y `ruta_id`.
10. Frontend guarda los ids devueltos por cada punto.
11. La ruta queda guardada, visible y asociada al camion.

### 8.2 Editar ruta

1. Usuario selecciona una ruta existente.
2. El mapa muestra solo esa ruta en modo edicion.
3. Usuario mueve puntos, agrega puntos o modifica formulario.
4. Si cambia nombre, descripcion, camion o color, frontend envia `PUT /api/rutas/:id` o `PATCH /api/rutas/:id`.
5. Si cambia un punto existente, frontend envia `PUT/PATCH /api/puntos-recoleccion/:id`.
6. Si agrega un punto nuevo, frontend envia `POST /api/puntos-recoleccion` con el mismo `ruta_id`.
7. Si elimina un punto, frontend envia `DELETE /api/puntos-recoleccion/:id`.
8. La respuesta actualiza el estado local.
9. La ruta conserva su color y camion.

### 8.3 Eliminar ruta

1. Usuario selecciona eliminar.
2. Se muestra confirmacion.
3. Frontend elimina los puntos asociados si backend no tiene eliminacion en cascada.
4. Frontend envia `DELETE /api/rutas/:id`.
5. Si backend confirma, se elimina del estado local.
6. Si estaba seleccionada, la vista cambia a todas o a ninguna ruta.

### 8.4 Ver rutas

1. Usuario abre el menu desplegable.
2. Puede seleccionar una ruta especifica.
3. Puede seleccionar todas las rutas.
4. Las rutas no seleccionadas no deben renderizarse cuando el modo sea una sola ruta.

## 9. Orden recomendado de implementacion

### 9.1 Base OpenStreetMap y arquitectura geografica

1. Centralizar URL de tiles, attribution, zoom, centro y limites en `src/constants/mapa.ts`.
2. Crear `src/services/mapaGeoService.ts` para concentrar validaciones y conversiones de coordenadas.
3. Mover o reutilizar ahi la validacion actual de limites de Suchiapa.
4. Revisar que todos los componentes usen el mismo tipo `Coordenada = [number, number]`.
5. Separar conceptualmente ruta en edicion, rutas guardadas y rutas visibles.
6. Ajustar `MapaDisenadorView` para recibir configuracion de mapa desde constantes, no valores duplicados.
7. Dejar preparado el modelo para una geometria futura generada por ruteo OSM, sin implementarla todavia.

### 9.2 Nuevo a implementar despues de la base OSM

1. Confirmar contrato real del backend para rutas y camiones.
2. Definir si `camion_id` se guarda en tabla de rutas o en una relacion aparte.
3. Confirmar contrato real de `api/puntos-recoleccion`.
4. Confirmar si los puntos usan `cp`, `lat`, `lon`, `ruta_id` y si devuelven `punto_id`.
5. Actualizar `src/models/rutaDisenada.ts` con `color`, `visible` y `punto_id` por punto.
6. Ampliar `src/services/rutasApi.ts` con `GET`, `POST`, `PUT/PATCH` y `DELETE` para ruta base.
7. Crear `src/services/puntosRecoleccionApi.ts` para puntos.
8. Crear adaptadores `backendToRutaDisenada`, `rutaDisenadaToBackend`, `puntoToBackend` y `backendToPunto`.
9. Rehacer `useRutasDisenadas` para cargar rutas y sus puntos desde backend al iniciar.
10. Implementar creacion persistente en dos pasos: crear ruta y luego crear puntos.
11. Implementar edicion persistente de datos de ruta y puntos individuales.
12. Implementar eliminacion persistente de puntos y ruta.
13. Actualizar `MapaDisenadorView` para renderizar multiples polilineas por capas.
14. Asignar colores por camion o por ruta.
15. Crear menu desplegable para ver una ruta o todas.
16. Separar claramente ruta visible y ruta en edicion.
17. Ajustar `ResumenRutas` para mostrar estado, color, camion y acciones.
18. Validar recarga de pagina: las rutas y sus puntos deben volver desde backend.
19. Validar que editar una ruta no afecte rutas de otros camiones.
20. Validar que eliminar una ruta no borre ni oculte rutas no relacionadas.

## 10. Validaciones obligatorias

Casos minimos a probar:

- Crear ruta para Camion 1.
- Crear ruta para Camion 2 con otro color.
- Ver solo Camion 1.
- Ver solo Camion 2.
- Ver todas las rutas.
- Editar Camion 1 sin modificar Camion 2.
- Eliminar Camion 1 sin afectar Camion 2.
- Recargar pagina y confirmar que las rutas se cargan desde backend.
- Intentar crear ruta para un camion que ya tiene ruta y mostrar opcion clara de editar o reemplazar.
- Confirmar que `Limpiar` solo limpia la ruta en edicion, no elimina una ruta ya guardada.

Comandos de validacion frontend:

```bash
npm run build
npm run lint
```

El build ejecuta TypeScript mediante `tsc -b`.

## 11. Riesgos tecnicos

- El backend podria no tener `camion_id` en rutas; sin esa relacion no se puede administrar ruta por camion de forma correcta.
- Si el backend no soporta `PUT` o `DELETE` para puntos, habra que implementar endpoints o usar una estrategia temporal de reemplazo completo.
- Si `api/rutas` no devuelve `ruta_id`, no se podran guardar puntos en `api/puntos-recoleccion`.
- Si `api/puntos-recoleccion` no devuelve el id de cada punto, editar y eliminar puntos individuales sera dificil.
- Si se guarda solo `json_ruta`, los puntos no podran administrarse individualmente desde `api/puntos-recoleccion`.
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
- [x] Preparar `MapaDisenadorView` para multiples capas sobre OpenStreetMap.
- [x] Dejar documentada la integracion futura con OSRM, GraphHopper, Valhalla u OpenRouteService.
- [ ] Confirmar endpoints reales disponibles en backend.
- [ ] Confirmar si backend acepta y devuelve `camion_id`.
- [ ] Confirmar formato exacto de respuesta de `GET /api/rutas/`.
- [ ] Confirmar formato exacto de `api/puntos-recoleccion`.
- [ ] Confirmar si `api/puntos-recoleccion` recibe `cp`, `lat`, `lon`, `ruta_id`.
- [ ] Confirmar si `api/puntos-recoleccion` devuelve id del punto creado.
- [x] Actualizar modelo `RutaDisenada`.
- [x] Actualizar modelo `PuntoRuta` con `punto_id`, `cp`, `lat` y `lon`.
- [x] Agregar color por camion/ruta.
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
- [ ] Cargar puntos de cada ruta desde backend.
- [x] Persistir creacion de ruta contra `api/rutas`.
- [ ] Persistir creacion de puntos contra `api/puntos-recoleccion`.
- [x] Persistir edicion de ruta contra `api/rutas`.
- [ ] Persistir edicion de puntos contra `api/puntos-recoleccion`.
- [ ] Persistir eliminacion de puntos contra `api/puntos-recoleccion`.
- [x] Persistir eliminacion de ruta contra `api/rutas`.
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

El siguiente paso practico debe ser confirmar el contrato real del backend para dos recursos: `api/rutas` y `api/puntos-recoleccion`.

El frontend ya tiene servicios y adaptadores preparados para ambos recursos. Falta validar con backend:

- formato real de `GET /api/rutas/`;
- si `api/rutas` acepta y devuelve `camion_id` y `color`;
- si `api/puntos-recoleccion` recibe `cp`, `lat`, `lon`, `ruta_id`;
- si `api/puntos-recoleccion` devuelve `punto_id`;
- si al eliminar una ruta el backend elimina sus puntos en cascada.

Cuando ese contrato quede confirmado, se debe activar el flujo completo de persistencia de puntos individuales: crear, editar, eliminar y recargar puntos desde `api/puntos-recoleccion`.
