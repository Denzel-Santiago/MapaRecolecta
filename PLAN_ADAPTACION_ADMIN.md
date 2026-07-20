# Plan de adaptacion al plan del administrador

Ultima revision de contrato de backend: 2026-07-20 (tercera revision, verificacion completa via `docs/swagger.json`).

Nota sobre el alcance de este documento (2026-07-20): este plan incluye todas las fases originales del plan del administrador, incluidas las que hoy no se pueden ejecutar. Cada fase bloqueada documenta, con evidencia concreta del codigo fuente de `gin-backend`, exactamente que falta en backend para poder implementarla y por que no se puede resolver desde `map-view`. Ninguna fase se elimino ni se movio fuera del plan.

## 1. Objetivo

Adaptar el modulo de mapa al plan proporcionado por el administrador sin descartar la logica ya implementada.

El plan del administrador se considera obligatorio para la siguiente etapa, especialmente en:

- modo borrador;
- IDs temporales;
- ordenamiento flotante;
- sincronizacion por lotes con `POST /api/puntos-recoleccion/sync`;
- separacion entre puntos de recoleccion y `json_ruta`;
- geometria oficial de ruta calculada por calles;
- publicacion de rutas para consumo de la app movil.

De todo esto, lo que ya se puede construir con el backend actual (modo borrador, IDs temporales, orden flotante en frontend, relacion ruta-camion) esta implementado y completo (Fases 0 a 3, seccion 10). Lo que todavia no se puede construir (sincronizacion por lotes, geometria vial, `json_ruta` oficial, publicacion) sigue como fase numerada de este plan (Fases 4 a 7), cada una con la razon tecnica exacta por la que esta bloqueada.

La logica actual no se elimina. Se usa como base para avanzar de forma controlada.

## 2. Estado actual que debe conservarse

El proyecto ya cuenta con una base funcional que no debe romperse:

- Mapa con OpenStreetMap y Leaflet.
- Configuracion centralizada en `src/constants/mapa.ts`.
- Servicio geografico `src/services/mapaGeoService.ts`.
- Creacion de puntos por clic.
- Edicion de puntos por arrastre.
- Validacion de limites de Suchiapa.
- Rutas con `ruta_id`, `camion_id`, `color`, `visible` y `puntos` (los tres ultimos calculados/mantenidos en frontend, ver seccion 4).
- Selector para ver todas las rutas o una ruta especifica.
- Renderizado de multiples rutas como capas.
- Servicios base para `api/rutas`.
- Servicio inicial para `api/puntos-recoleccion`.
- Separacion entre rutas visibles, rutas guardadas y ruta en edicion.
- Modulo backend `ruta_camion` (`/api/ruta-camion`), ya integrado en frontend para persistir la relacion ruta-camion (ver seccion 4).
- Modo borrador para editar puntos de una ruta ya guardada, con IDs temporales y orden flotante (ver Fases 1-3, seccion 10).

Estos elementos deben evolucionar, no ser reemplazados sin necesidad.

## 3. Cambio principal de arquitectura

Actualmente la linea del mapa se dibuja usando los puntos colocados por el usuario.

El plan del administrador requiere separar:

| Elemento | Uso | Disponible hoy |
|---|---|---|
| Puntos de recoleccion | Marcadores creados por el administrador. | Si |
| Orden de visita | Secuencia definida por `orden`, calculada en frontend. | Si (en frontend; backend todavia no persiste la columna `orden`, ver seccion 4.3) |
| Geometria previa | Ruta calculada por calles mientras se edita. | Solo provisional (ver Fase 5) |
| Geometria oficial | Ruta final validada y guardada en `json_ruta`. | No (ver Fase 6) |
| Estado de publicacion | Controla si la app movil puede consumir la ruta. | No (ver Fase 7) |

Regla nueva:

```txt
Markers = puntos de recoleccion
Polyline = geometria calculada por motor vial
```

Mientras no exista motor vial, se mantiene una geometria provisional basada en puntos, marcada como provisional y no como geometria oficial publicada.

## 4. Contrato real de backend confirmado

Revisado directamente sobre el codigo fuente de `gin-backend` (Go/Gin/Postgres/Redis), en modo solo lectura, en tres rondas: 2026-07-19 (primera revision), 2026-07-19 (segunda revision, tras actualizacion del equipo de backend) y 2026-07-20 (tercera revision, verificacion cruzada contra `docs/swagger.json`, el documento OpenAPI que Go genera automaticamente desde las anotaciones de cada endpoint registrado). Esta tercera revision confirma, endpoint por endpoint, que no falto nada en las dos revisiones anteriores. Esta seccion es la base probatoria de por que las Fases 4 a 7 estan bloqueadas.

### 4.1 `api/rutas` — sin cambios entre revisiones

Endpoints reales: `POST /api/rutas/`, `GET /api/rutas/`, `GET /api/rutas/:id`, `PUT /api/rutas/:id`, `DELETE /api/rutas/:id`, `GET /api/rutas/activas`.

La entidad `Ruta` solo tiene `ruta_id`, `nombre`, `descripcion`, `json_ruta`, `eliminado`, `created_at`. **No tiene `camion_id`, `color` ni `visible`.** Cuando el frontend envia esos campos en el payload, el backend los ignora silenciosamente. `DELETE /api/rutas/:id` hace soft delete solo de la ruta; no elimina ni marca los puntos asociados (quedan huerfanos). No existe ningun `PATCH` sobre este recurso, solo `PUT` (reemplazo completo).

### 4.2 `api/ruta-camion` — ya integrado en frontend

El equipo de backend agrego un modulo completo con tabla, entidad Go, adaptador y endpoints reales:

```txt
POST   /api/ruta-camion/
GET    /api/ruta-camion/
GET    /api/ruta-camion/:id
GET    /api/ruta-camion/camion/:camion_id
GET    /api/ruta-camion/ruta/:ruta_id
GET    /api/ruta-camion/exists/:id
PUT    /api/ruta-camion/:id
DELETE /api/ruta-camion/:id
```

Entidad `RutaCamion`: `ruta_camion_id`, `ruta_id`, `camion_id`, `fecha`, `created_at`, `eliminado`.

Ya se puede guardar y consultar que camion tiene asignada que ruta en backend, como recurso separado (no como campo `camion_id` embebido en la respuesta de `GET /api/rutas/`). El frontend cruza ambos recursos via `rutaCamionApi.ts` (seccion 6.1).

`color` sigue sin existir en ningun lado del backend; se mantiene calculado en frontend a partir del `camion_id`, como ya se hace hoy con `obtenerColorCamion`.

Pendiente de confirmar con backend: si al eliminar una ruta o un camion, el registro correspondiente en `ruta_camion` se marca eliminado automaticamente o el frontend debe hacerlo explicitamente (hoy el frontend lo hace explicitamente, best-effort).

### 4.3 `api/puntos-recoleccion` — un cambio de esquema sin terminar

Endpoints reales: `POST /api/puntos-recoleccion/`, `GET /api/puntos-recoleccion/`, `GET /api/puntos-recoleccion/:id`, `GET /api/puntos-recoleccion/ruta/:rutaId`, `PUT /api/puntos-recoleccion/:id`, `DELETE /api/puntos-recoleccion/:id`.

Entidad `PuntoRecoleccion`: `punto_id`, `ruta_id`, `cp` (tipo `string`), `lat`, `lon`, `eliminado`, `created_at`.

- La tabla `punto_recoleccion` tiene columna `orden` (`DOUBLE PRECISION`), justo el concepto de "orden flotante" que pide este plan (seccion 5.2). Pero la entidad Go y el adaptador `PostgresPuntoRecoleccion.go` no la leen ni la escriben en ningun `INSERT`/`UPDATE`/`SELECT`. El esquema esta listo, el codigo todavia no lo usa.
- El `INSERT`/`UPDATE` real en Postgres solo persiste `ruta_id` y el valor de `cp` (guardado en la columna `direccion`). Las coordenadas `lat`/`lon` **no se guardan en Postgres**, solo se cachean en Redis bajo la llave `point:<punto_id>`. Si Redis pierde datos, las coordenadas se pierden de forma permanente aunque el punto siga existiendo en la base de datos.
- `cp` es `string` en backend. El modelo `PuntoBorrador` de este plan (seccion 5.2) ya define `cp: string`, igual que `PuntoRuta.cp`, ya corregido en frontend.
- No existe ningun endpoint que reciba una lista de operaciones (crear/actualizar/eliminar) en una sola llamada: cada operacion es individual, un `punto_id` a la vez.

### 4.4 Lista completa y verificada de endpoints (`docs/swagger.json`, 2026-07-20)

Se extrajeron programaticamente todas las rutas `/api/...` registradas en el documento OpenAPI generado por Go (autoritativo porque se genera desde las anotaciones de cada handler real, no desde documentacion escrita a mano). Relacionadas con rutas/puntos/camiones:

```txt
/api/rutas/, /api/rutas/{id}, /api/rutas/activas, /api/rutas/arrival
/api/ruta-camion/, /api/ruta-camion/{id}, /api/ruta-camion/camion/{camion_id}, /api/ruta-camion/ruta/{ruta_id}, /api/ruta-camion/exists/{id}
/api/puntos-recoleccion/, /api/puntos-recoleccion/{id}, /api/puntos-recoleccion/ruta/{rutaId}
```

No aparece, en ningun lado del archivo: `sync`, ningun endpoint de geometria o ruteo vial, ningun `PATCH` sobre `rutas`, ni ningun campo o ruta de estado de publicacion. Los modulos nuevos que agrego el backend (`Camion`, `EstadoCamion`, `TipoCamion`, `HistorialAsignacionCamion`, telemetria, procesamiento de arribo) son para tracking operativo del camion en tiempo real; no aplican a este plan de adaptacion del disenador de rutas.

### 4.5 Consecuencia para este plan

Las Fases 0 a 3 (confirmacion de contrato, modelos de borrador, servicio de borrador, integracion en UI, incluyendo `/api/ruta-camion`) no dependen de endpoints faltantes y estan completas (ver seccion 10). Las Fases 4 a 7 (`sync`, geometria vial, `json_ruta` oficial, publicacion) siguen bloqueadas porque, segun la lista completa y verificada de la seccion 4.4, esos endpoints simplemente no existen en `gin-backend` todavia; ninguna de esas cuatro fases puede resolverse escribiendo mas codigo en `map-view`, porque no hay nada en el backend que ese codigo pueda llamar. Este agente trabaja unicamente en `map-view` y no debe modificar `gin-backend`.

## 5. Modelo objetivo

### 5.1 Punto de ruta actual

El modelo actual `PuntoRuta` puede seguir existiendo como modelo persistido o de compatibilidad.

Debe mapearse hacia un modelo de borrador cuando se entre en edicion.

### 5.2 Punto borrador

Modelo implementado en `src/models/rutaBorrador.ts`:

```ts
export type EstadoPuntoBorrador =
  | "sin_cambios"
  | "nuevo"
  | "movido"
  | "reordenado"
  | "eliminado";

export interface PuntoBorrador {
  punto_id: number | string;
  ruta_id: number;
  cp: string;
  lat: number;
  lon: number;
  orden: number;
  latOriginal?: number;
  lonOriginal?: number;
  ordenOriginal?: number;
  estado: EstadoPuntoBorrador;
}
```

Nota: `cp: string` y `orden: number` ya coinciden con el esquema real de `punto_recoleccion` en Postgres. Lo unico que falta para que `orden` se persista de verdad es que backend actualice `PuntoRecoleccion` (entidad) y `PostgresPuntoRecoleccion.go` (adaptador) para leer/escribir esa columna (ver `REQUISITOS_BACKEND_PLAN_ADAPTACION_ADMIN.md`). Mientras eso no ocurra, el frontend calcula y mantiene `orden` localmente en el borrador, sin asumir que el backend lo devuelve al recargar.

### 5.3 Ruta borrador

```ts
export type EstadoRutaBorrador = "editando" | "calculando" | "valida" | "error";

export interface RutaBorrador {
  ruta_id: number;
  camion_id: number | null;
  puntos: PuntoBorrador[];
  puntosEliminados: number[];
  geometriaPrevia: [number, number][];
  distanciaMetros: number;
  duracionSegundos: number;
  estado: EstadoRutaBorrador;
  errores: string[];
}
```

`camion_id` se resuelve consultando `/api/ruta-camion/ruta/:ruta_id`; no viene embebido en la respuesta de `GET /api/rutas/:id`.

### 5.4 Estado de publicacion de ruta

```ts
export type EstadoPublicacionRuta =
  | "BORRADOR"
  | "VALIDANDO"
  | "VALIDA"
  | "ERROR"
  | "PUBLICADA";
```

La app movil solo debe consumir rutas en estado `PUBLICADA`. Este tipo esta definido en el modelo pero no se usa en ningun lado del codigo todavia: no hay campo, tabla ni endpoint en backend que represente este estado (ver Fase 7 para el detalle de por que esta bloqueado).

## 6. Servicios nuevos o ajustados

### 6.1 `rutaCamionApi.ts` — implementado

Servicio dedicado al modulo real `/api/ruta-camion`:

```ts
listarAsignaciones()
obtenerAsignacionPorId(id)
obtenerAsignacionesPorRuta(rutaId)
obtenerAsignacionesPorCamion(camionId)
obtenerAsignacionActivaPorRuta(rutaId)
existeAsignacion(id)
crearAsignacion(rutaId, camionId, fecha)
actualizarAsignacion(id, rutaId, camionId, fecha)
eliminarAsignacion(id)
```

Es la unica fuente de verdad para "que camion tiene asignada esta ruta" y "que ruta tiene asignada este camion", reemplazando la suposicion de que `camion_id` viene dentro de `Ruta`.

### 6.2 `puntosRecoleccionApi.ts`

CRUD real contra `/api/puntos-recoleccion`, con `cp` tipado como `string`. Es el mecanismo de guardado de puntos hoy. El metodo `syncPuntosRecoleccion(payload)` que pide el plan del administrador no se puede agregar todavia porque no existe `POST /api/puntos-recoleccion/sync` en backend (ver Fase 4). El CRUD individual se mantiene como el flujo real de guardado, no como un "fallback temporal".

### 6.3 Servicio de borrador — implementado

```txt
src/services/rutaBorradorService.ts
```

Responsabilidades:

- convertir `RutaDiseñada` (mas su asignacion de `rutaCamionApi`) a `RutaBorrador`;
- generar IDs temporales;
- calcular orden flotante;
- detectar puntos nuevos, movidos, reordenados y eliminados;
- construir payload para `sync` (`construirPayloadSync`, listo para el dia que el endpoint exista, ver Fase 4) y payload equivalente para el CRUD individual (el que se usa hoy);
- normalizar orden cuando sea necesario;
- persistir el borrador contra el CRUD real de `puntos-recoleccion` (`guardarPuntosBorrador`): crea solo los puntos nuevos, elimina solo los marcados como eliminados, y actualiza los reordenados.

### 6.4 Servicio de geometria vial — no implementado, ver Fase 5

```txt
src/services/rutaVialService.ts
```

No se puede crear con contenido real porque no hay ningun endpoint ni motor de ruteo que consultar (ver seccion 4.4 y Fase 5).

### 6.5 Servicio de publicacion — no implementado, ver Fase 7

No se puede ampliar `rutasApi.ts` con acciones de publicacion porque no existe ningun endpoint de estado de ruta en backend (ver seccion 4.4 y Fase 7).

## 7. Flujo adaptado de edicion (implementado)

### 7.1 Entrar a editar ruta

1. Usuario selecciona una ruta.
2. Frontend carga ruta y puntos persistidos.
3. Frontend consulta `/api/ruta-camion/ruta/:ruta_id` para saber el camion asignado.
4. Convierte los puntos a `RutaBorrador`.
5. Marca todos los puntos como `sin_cambios`.
6. Calcula geometria provisional.
7. Muestra marcadores editables y polyline provisional.

### 7.2 Agregar punto

1. Usuario da clic en el mapa.
2. Se valida que este dentro de Suchiapa.
3. Se crea `punto_id` temporal tipo `temp_xxx`.
4. Se calcula `orden` flotante.
5. Se marca como `nuevo`.
6. Se recalcula geometria provisional.
7. Se validan reglas minimas.

### 7.3 Mover punto

Regla del administrador: un punto real movido se convierte en `punto eliminado + punto nuevo`.

1. Si el punto es temporal, solo se actualiza su lat/lon.
2. Si el punto tiene ID real, se agrega a `puntosEliminados`.
3. Se crea un nuevo punto temporal con la nueva ubicacion.
4. Se conserva el orden.
5. Se recalcula geometria provisional.

Advertencia: esta regla cambia el `punto_id`. Si en el futuro hay historial operativo vinculado al punto, backend debera permitir actualizar coordenadas conservando identidad.

### 7.4 Reordenar punto

Servicio ya implementado (`reordenarPuntoBorrador`); todavia sin control de arrastre en la UI de lista (queda para una iteracion futura, no depende de backend).

### 7.5 Eliminar punto

1. Si el punto tiene ID real, se agrega a `puntosEliminados`.
2. Si es temporal, solo se elimina del borrador.
3. Se recalcula geometria.
4. Se validan minimos.

## 8. Flujo adaptado de guardado

El boton se llama `Guardar recorrido`.

Flujo objetivo, tal como lo pide el plan del administrador (ver Fase 4, bloqueada):

1. Validar ruta en borrador.
2. Construir payload de `sync`.
3. Ejecutar `POST /api/puntos-recoleccion/sync`.
4. Recargar datos frescos desde backend.
5. Verificar que puntos nuevos tengan ID real.
6. Verificar que puntos eliminados ya no aparezcan.
7. Recalcular geometria definitiva con puntos recargados.
8. Guardar geometria oficial en `json_ruta` (ver Fase 6, bloqueada).
9. Mantener ruta en `BORRADOR`, `VALIDA` o `ERROR` segun resultado (ver Fase 7, bloqueada).
10. No publicar automaticamente si falla la geometria.

Flujo real implementado hoy (pasos 2-3 y 8-10 sustituidos porque los endpoints que necesitan no existen):

1. Validar ruta en borrador.
2. Persistir asignacion de camion via `/api/ruta-camion`.
3. Para cada punto del borrador: crear los `nuevo` via `POST /api/puntos-recoleccion`, actualizar los `reordenado` via `PUT`, eliminar los marcados via `DELETE` (uno por uno, porque no existe `sync`).
4. Recargar puntos frescos desde backend (`listarPuntosPorRuta`).
5. Verificar que puntos nuevos tengan ID real y que los eliminados ya no aparezcan.
6. Guardar `json_ruta` junto con `nombre`/`descripcion` via `PUT /api/rutas/:id` (unico mecanismo disponible; no hay endpoint separado para geometria oficial).
7. Reiniciar el borrador (`iniciarDesdeRuta`) con los datos recargados.

## 9. Flujo adaptado de publicacion

La publicacion debe ser un paso separado de guardar puntos. Bloqueada por completo (ver Fase 7): no hay estado de ruta en backend, por lo que no existe un paso "presionar Publicar ruta" que tenga algo real que llamar.

1. Ruta debe tener puntos persistidos.
2. Ruta debe tener geometria oficial valida.
3. Ruta no debe tener errores de validacion.
4. Usuario presiona `Publicar ruta`.
5. Frontend solicita cambio de estado a `PUBLICADA`.
6. App movil consume solo rutas `PUBLICADA`.

## 10. Validaciones necesarias

### 10.1 Validaciones actuales que se conservan

- Punto dentro de limites de Suchiapa.
- Minimo de puntos.
- Coordenadas reales.
- Rutas separadas por camion (via `/api/ruta-camion`).

### 10.2 Validaciones nuevas (implementadas)

- IDs temporales solo en frontend.
- No enviar puntos temporales como eliminados.
- No permitir orden ambiguo.
- No aceptar puntos duplicados.

### 10.3 Validaciones bloqueadas (dependen de Fases 4-7)

- No publicar sin geometria oficial (depende de Fase 6).
- No publicar si falla `sync` (depende de Fase 4).
- No publicar si falla guardado de `json_ruta` oficial (depende de Fase 6).
- Validar movimiento excesivo, distancia maxima a calle, distancia maxima entre puntos consecutivos, factor de desvio (dependen de Fase 5, motor vial).

### 10.4 Validaciones que dependen del motor vial

Estas deben implementarse cuando exista motor vial o endpoint backend (ver Fase 5):

- cercania real a calle;
- distancia vial entre puntos;
- duracion estimada;
- respeto de sentidos viales;
- factor de desvio;
- conectividad vial.

## 11. Fases de implementacion

### Fase 0 - Confirmacion del contrato — COMPLETADA

Completada por revision directa del codigo fuente de `gin-backend`, en tres rondas (2026-07-19, 2026-07-19, 2026-07-20). Ver seccion 4 para el detalle completo. La tercera revision (via `docs/swagger.json`) confirma que no quedo ningun endpoint sin revisar. Resumen del veredicto: se resolvio la relacion ruta-camion (`/api/ruta-camion`); el resto de los bloqueos originales (`sync`, geometria vial, `json_ruta` oficial, publicacion, persistencia de `lat`/`lon`, columna `orden` sin usar) sigue vigente.

### Fase 1 - Modelos de borrador — COMPLETADA

- [x] Crear `src/models/rutaBorrador.ts`.
- [x] Crear `PuntoBorrador` (con `punto_id: number | string`, campos `*Original` para deteccion de cambios en Fase 2).
- [x] Crear `RutaBorrador` (incluyendo `camion_id: number | null`).
- [x] Crear estados de punto (`EstadoPuntoBorrador`) y de ruta (`EstadoRutaBorrador`), mas `EstadoPublicacionRuta` documentado para la Fase 7.
- [x] Crear adaptadores desde `RutaDiseñada`: `rutaDiseñadaABorrador`, `puntoRutaABorrador`, y el adaptador inverso `borradorAPuntosRuta`.
- [x] Crear `generarIdTemporal`/`esIdTemporal` para los IDs `temp_xxx` de puntos nuevos.
- Verificado con `npx tsc -b` y `npx eslint .` (ambos limpios).

### Fase 1.5 - Integrar relacion ruta-camion real — COMPLETADA

- [x] Crear `src/services/rutaCamionApi.ts` contra `/api/ruta-camion`.
- [x] Ajustar `src/models/rutaDiseñada.ts` (`camion_id: number | null`) y `useRutasDiseñadas.cargarRutas` para resolver `camion_id` de cada ruta consultando este servicio en paralelo.
- [x] `rutasApi.ts` ya no envia `camion_id`/`color` a `/api/rutas/`; `color` se sigue calculando en frontend con `obtenerColorCamion`, ahora null-safe (`COLOR_SIN_CAMION`).
- [x] `MapaDiseñador.tsx` crea o actualiza la asignacion en `/api/ruta-camion` al guardar una ruta, con error visible en el panel si falla, sin revertir el guardado de la ruta.
- [x] `useRutasDiseñadas.eliminarRuta` intenta eliminar la asignacion en `/api/ruta-camion` antes de eliminar la ruta (best-effort).
- Verificado con `npx tsc -b` y `npx eslint .` (ambos limpios).

### Fase 2 - Servicio de borrador — COMPLETADA

- [x] Crear `src/services/rutaBorradorService.ts`.
- [x] Generar IDs temporales.
- [x] Calcular orden flotante (`generarOrdenFlotante`, punto medio entre vecinos).
- [x] Detectar cambios: `agregarPuntoBorrador`, `moverPuntoBorrador` (regla eliminado+nuevo para puntos reales), `reordenarPuntoBorrador`, `eliminarPuntoBorrador`.
- [x] Construir payload de `sync`: `construirPayloadSync` (listo para cuando exista el endpoint, ver Fase 4).
- [x] Normalizar orden (`normalizarOrden`).
- [x] Geometria provisional (`calcularGeometriaProvisional`), documentada explicitamente como fallback mientras no exista motor vial (ver Fase 5).
- Validacion de minimos y limites de Suchiapa reutilizadas de los servicios existentes.
- Verificado con `npx tsc -b` y `npx eslint .` (ambos limpios).

### Fase 3 - Integrar borrador en UI sin romper flujo actual — COMPLETADA (pendiente de prueba manual)

- [x] Crear `src/hooks/useRutaBorrador.ts` (no se adapto `useRutaDiseñador`: se dejo intacto como fallback explicito para dibujar rutas nuevas).
- [x] Mantener el flujo actual como fallback: `useRutaDiseñador` se usa para rutas sin `ruta_id` todavia; el modo borrador aplica solo a rutas ya persistidas (`esRutaPersistida` en `MapaDiseñador.tsx`).
- [x] Mostrar puntos del borrador via `calcularGeometriaProvisional`.
- [x] Permitir agregar, mover y eliminar puntos desde la UI.
- [x] Mantener rutas visibles separadas de la ruta en edicion.
- [x] Guardado dirigido por estado: `guardarPuntosBorrador` reemplaza el "borrar todo y recrear" cuando se edita una ruta existente; para una ruta nueva se sigue usando `reemplazarPuntosDeRuta`.
- [x] `borradorAPuntosRuta` preserva los `punto_id` reales al construir el payload de la ruta base.
- Verificado con `npx tsc -b` y `npx eslint .` (ambos limpios).
- **Pendiente real:** no se pudo probar manualmente contra un backend corriendo (no hay entorno de navegador/backend disponible en este sandbox). Antes de dar esto por cerrado, alguien con el entorno completo deberia verificar en vivo: agregar un punto a una ruta existente, arrastrar un punto existente (confirmar que se crea uno nuevo y el viejo se marca eliminado), guardar y recargar la pagina para confirmar que los cambios persistieron correctamente.

### Fase 4 - Agregar `sync` — BLOQUEADA

Por que esta bloqueada: el plan del administrador pide que el guardado de puntos use `POST /api/puntos-recoleccion/sync`, enviando en una sola llamada los puntos nuevos, actualizados y eliminados. Este endpoint no existe: la lista completa de endpoints registrados en `docs/swagger.json` (seccion 4.4) solo tiene `POST /api/puntos-recoleccion/`, `GET /`, `GET /:id`, `GET /ruta/:rutaId`, `PUT /:id` y `DELETE /:id` — todos de un punto a la vez. No hay ninguna ruta con la palabra `sync` en todo el backend (se busco en el codigo fuente completo, no solo en el swagger). No se puede simular `sync` en frontend porque, aunque se hicieran las llamadas individuales en secuencia (que es justamente lo que ya hace el flujo implementado en la Fase 3, seccion 8), eso no es lo mismo que una transaccion atomica en backend: si una llamada falla a la mitad, el backend puede quedar en un estado parcial que un verdadero `sync` transaccional evitaria.

Que se necesita en backend para desbloquearla: un endpoint nuevo, por ejemplo `POST /api/puntos-recoleccion/sync`, que reciba `{ ruta_id, puntos_nuevos, puntos_actualizados, puntos_eliminados }` y aplique los tres cambios en una sola transaccion de base de datos. Ya esta pedido formalmente en `REQUISITOS_BACKEND_PLAN_ADAPTACION_ADMIN.md`.

Trabajo ya preparado en frontend para cuando exista: `construirPayloadSync` (Fase 2) ya genera el payload exacto que este endpoint necesitaria recibir.

- [ ] Implementar `syncPuntosRecoleccion` en `puntosRecoleccionApi.ts`.
- [ ] Usarlo al guardar puntos en lugar del CRUD individual.
- [ ] Recargar rutas/puntos despues del sync.
- [ ] Eliminar el flujo de CRUD individual solo cuando `sync` este confirmado en produccion.

### Fase 5 - Geometria vial — BLOQUEADA

Por que esta bloqueada: el plan del administrador pide que la polyline visible sea la geometria real de la ruta calculada por calles (respetando sentidos viales, distancias reales, etc.), no una linea recta entre puntos. Esto requiere un motor de ruteo (por ejemplo OSRM, GraphHopper, Valhalla u OpenRouteService) o un endpoint de backend que lo exponga. Ninguno de los dos existe: no hay ninguna dependencia de ruteo en el `go.mod` de `gin-backend`, ni ningun endpoint de geometria en `docs/swagger.json` (seccion 4.4). Calcularlo en frontend sin motor de ruteo tampoco es una opcion real: determinar el camino real por calles requiere un grafo vial con datos de OpenStreetMap procesados (nodos, aristas, sentidos), algo que no se puede improvisar en el navegador sin ese servicio.

Que se necesita para desbloquearla: que backend integre un motor de ruteo propio, o exponga un endpoint que internamente llame a un servicio externo de ruteo compatible con OSM, devolviendo geometria, distancia y duracion.

Mientras tanto, se usa `calcularGeometriaProvisional` (Fase 2) como fallback explicito, documentado como provisional, no como geometria oficial.

- [ ] Crear `rutaVialService.ts`.
- [ ] Definir respuesta esperada: geometria, distancia, duracion, errores.
- [ ] Dibujar `geometriaPrevia` como polyline real.
- [ ] Dejar de tratar puntos como geometria oficial.
- [ ] Mantener polyline provisional solo mientras no exista motor vial.

### Fase 6 - Guardar `json_ruta` oficial — BLOQUEADA

Por que esta bloqueada: el plan del administrador pide separar el guardado de la geometria oficial (resultado del motor vial de la Fase 5) del guardado de datos generales de la ruta (`nombre`/`descripcion`), idealmente via un endpoint dedicado tipo `PATCH /api/rutas/:id/json-ruta`. Ese endpoint no existe: `api/rutas` solo tiene `POST`, `GET`, `PUT` (reemplazo completo) y `DELETE` (seccion 4.1 y 4.4); no hay ningun `PATCH` registrado en `docs/swagger.json`. Ademas, esta fase depende directamente de la Fase 5: sin motor vial no hay geometria oficial que guardar, solo la provisional.

Que se necesita para desbloquearla: primero, que exista geometria oficial (Fase 5); despues, que backend agregue un endpoint para guardarla de forma independiente de `nombre`/`descripcion` (puede ser el `PATCH` propuesto, o backend puede decidir otro diseño).

Mientras tanto, `json_ruta` se sigue guardando junto con `nombre`/`descripcion` via `PUT /api/rutas/:id`, con los puntos del borrador (no con geometria vial, porque no existe).

- [ ] Confirmar endpoint con backend.
- [ ] Guardar geometria oficial despues del sync (Fase 4) y del calculo vial (Fase 5).
- [ ] Si falla, mantener ruta en `ERROR` o `BORRADOR`.
- [ ] No publicar geometria vieja.

### Fase 7 - Publicacion — BLOQUEADA

Por que esta bloqueada: el plan del administrador pide que una ruta solo sea visible para la app movil cuando este en estado `PUBLICADA`, con estados intermedios `BORRADOR`/`VALIDANDO`/`VALIDA`/`ERROR`. Backend no tiene ningun campo, columna ni tabla que represente un estado de publicacion para `Ruta` (confirmado en el codigo fuente y en `docs/swagger.json`, secciones 4.1 y 4.4): la entidad `Ruta` solo tiene `ruta_id`, `nombre`, `descripcion`, `json_ruta`, `eliminado`, `created_at`. No hay "estado" que cambiar. Publicar sin esto significaria que cualquier ruta guardada seria indistinguible de una "publicada" para quien la consuma, lo cual contradice el objetivo mismo de esta fase. Adicionalmente, no hay codigo ni documentacion de la app movil en este repositorio, por lo que tampoco se puede confirmar que consumiria este estado aunque existiera.

Que se necesita para desbloquearla: que backend agregue el campo/tabla de estado de publicacion a `Ruta`, mas el endpoint para cambiarlo (por ejemplo `PATCH /api/rutas/:id/estado`), y que se confirme con quien mantiene la app movil que efectivamente filtrara por ese estado.

- [ ] Agregar estado de ruta en backend (fuera del alcance de `map-view`).
- [ ] Agregar accion `Publicar ruta` en frontend una vez exista el endpoint.
- [ ] Bloquear publicacion si no hay geometria oficial (Fase 6).
- [ ] Preparar contrato para app movil (pendiente de confirmar con ese equipo).

### Fase 8 - Limpieza y documentacion

- [ ] Actualizar `README.md`.
- [ ] Actualizar `MAPA-FUNCIONAMIENTO.md`.
- [x] Actualizar `PLAN_DE_SEGUIMIENTO.md`.
- [ ] Actualizar `REGLAS_PARA_EL_AGENTE.md` si cambian reglas.
- [ ] Eliminar fallback viejo (`reemplazarPuntosDeRuta` para rutas nuevas) solo cuando backend y app movil ya usen el flujo nuevo completo (Fases 4-7 resueltas).

## 12. Riesgos y decisiones pendientes

### 12.0 Riesgos confirmados en backend real

Riesgo (vigente):

Las coordenadas `lat`/`lon` de cada punto de recoleccion solo se guardan en Redis, no en Postgres. Un reinicio o perdida de datos en Redis borraria las coordenadas de forma permanente aunque el punto siga existiendo en la tabla `punto_recoleccion`.

Riesgo (resuelto en frontend):

~~El tipo de `cp` no coincide entre frontend actual (numero) y backend (string)~~ — corregido: `PuntoRuta.cp` ahora es `string` en el modelo y en los adaptadores `rutasApi.ts`/`puntosRecoleccionApi.ts`.

Riesgo (resuelto):

~~El campo `camion_id` no existe en la tabla `ruta` ni en la entidad backend~~ — resuelto con el modulo `/api/ruta-camion` (seccion 4.2).

Riesgo (vigente):

La columna `orden` ya existe en `punto_recoleccion`, pero el codigo Go no la usa. Si el frontend empieza a enviar `orden` esperando que se persista, el dato se perdera silenciosamente hasta que backend actualice la entidad y el adaptador.

Decision pendiente:

Los riesgos de Redis y de la columna `orden` sin usar requieren cambios en `gin-backend`. Ninguno se resuelve desde `map-view`. Se debe informar al equipo de backend (ver `REQUISITOS_BACKEND_PLAN_ADAPTACION_ADMIN.md`) antes de activar las Fases 4-7 de este plan.

### 12.1 `json_ruta`

Riesgo: actualmente puede representar puntos dibujados. El plan del administrador requiere que represente geometria oficial (Fase 6).

Decision pendiente: confirmar si backend y app movil aceptan que `json_ruta` cambie a GeoJSON o formato equivalente.

### 12.2 Punto movido

Riesgo: mover un punto real como eliminado + nuevo cambia su `punto_id`.

Decision pendiente: confirmar si existen datos historicos asociados al punto.

### 12.3 Motor vial

Riesgo: sin motor vial, no se puede garantizar que la polyline siga calles ni sentidos viales (Fase 5).

Decision pendiente: confirmar si el calculo lo hara backend o un servicio externo.

### 12.4 Publicacion

Riesgo: si la app movil consume rutas sin estado, podria recibir borradores incompletos (Fase 7).

Decision pendiente: confirmar si backend tendra estados `BORRADOR`, `VALIDANDO`, `VALIDA`, `ERROR`, `PUBLICADA`.

## 13. Criterios de aceptacion

La adaptacion se considera correcta cuando:

- el flujo actual no queda roto durante la transicion;
- la relacion ruta-camion se resuelve via `/api/ruta-camion`, no asumida dentro de `Ruta`;
- existe modo borrador para editar puntos;
- los puntos nuevos usan IDs temporales;
- los puntos reales movidos se convierten en eliminado + nuevo;
- el guardado principal usa `POST /api/puntos-recoleccion/sync` cuando exista (Fase 4); mientras tanto, usa el CRUD individual dirigido por estado;
- despues de guardar se recargan datos frescos;
- la polyline visible usa geometria vial cuando exista motor (Fase 5);
- `json_ruta` guarda geometria oficial, no puntos sueltos, cuando backend lo soporte (Fase 6);
- una ruta solo puede publicarse si esta validada, cuando backend lo soporte (Fase 7);
- la app movil consume rutas publicadas con geometria oficial, cuando backend lo soporte (Fase 7);
- `npm run lint` pasa despues de implementar cambios de codigo (`npm run build` no se pudo validar end-to-end en este sandbox por un problema de entorno ajeno al codigo, ver Fase 3).

## 14. Resumen ejecutivo

El plan del administrador se integra como la ruta principal de evolucion del mapa, con las siete fases originales completas en el documento.

La logica actual se conserva como base: OpenStreetMap, capas, rutas por camion, puntos editables, servicios API, validaciones basicas.

El backend ya aporto una pieza real de este plan: el modulo `ruta_camion` (`/api/ruta-camion`), que permite persistir la relacion ruta-camion como recurso propio. Sobre esa base, las Fases 0 a 3 (contrato confirmado, modelos de borrador, servicio de borrador, integracion en UI) estan completas.

Las Fases 4 a 7 siguen bloqueadas, cada una por una razon tecnica especifica y verificada contra el codigo fuente y `docs/swagger.json` (seccion 4, y el detalle de cada fase en la seccion 11):

- Fase 4 (`sync`): el endpoint no existe, solo hay CRUD individual.
- Fase 5 (geometria vial): no hay motor de ruteo ni endpoint que lo exponga.
- Fase 6 (`json_ruta` oficial): no hay endpoint separado, y depende de que exista geometria oficial (Fase 5).
- Fase 7 (publicacion): no existe ningun campo ni tabla de estado en la entidad `Ruta`.

Ninguna de estas cuatro fases se puede resolver escribiendo mas codigo en `map-view`: todas requieren cambios en `gin-backend`, ya solicitados formalmente en `REQUISITOS_BACKEND_PLAN_ADAPTACION_ADMIN.md`. Este agente segira este mismo documento como referencia para retomar cada fase, en el orden 4 → 5 → 6 → 7, en cuanto el equipo de backend confirme el endpoint correspondiente.

La regla mas importante es no mezclar responsabilidades:

```txt
puntos-recoleccion = puntos y orden
ruta-camion = asignacion de ruta a camion
json_ruta = geometria oficial por calles
estado = control de publicacion
```
