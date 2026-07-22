# Requisitos de backend para PLAN_ADAPTACION_ADMIN.md

Documento dirigido al encargado de `gin-backend`. Explica que necesita el modulo de mapa (`map-view`) del backend para poder implementar el plan obligatorio del administrador (`PLAN_ADAPTACION_ADMIN.md`), a partir de una revision directa del codigo fuente de `gin-backend` hecha el 2026-07-19.

No se modifico ningun archivo de `gin-backend`. Este documento es solo diagnostico y peticion de cambios.

## 1. Resumen para el encargado de backend

El frontend ya tiene lista la arquitectura de mapas, capas, rutas por camion y borradores de edicion. Lo que falta para cerrar el flujo completo depende de cambios en `gin-backend`, no en `map-view`. Sin estos cambios, el plan del administrador (modo borrador, sincronizacion por lotes, geometria oficial, publicacion de rutas) no se puede activar de forma segura.

Ademas de lo que pide el plan, la revision encontro dos problemas de integridad de datos que ya afectan al flujo actual (no son parte del plan nuevo, pero conviene resolverlos junto con lo demas).

## 2. Estado actual confirmado (lo que ya existe)

### `api/rutas`

```txt
POST   /api/rutas/
GET    /api/rutas/
GET    /api/rutas/:id
PUT    /api/rutas/:id
DELETE /api/rutas/:id
GET    /api/rutas/activas
```

La entidad `Ruta` solo tiene: `ruta_id`, `nombre`, `descripcion`, `json_ruta`, `eliminado`, `created_at`. La tabla `ruta` en Postgres usa `colonia_id`, no `camion_id`.

### `api/puntos-recoleccion`

```txt
POST   /api/puntos-recoleccion/
GET    /api/puntos-recoleccion/
GET    /api/puntos-recoleccion/:id
GET    /api/puntos-recoleccion/ruta/:rutaId
PUT    /api/puntos-recoleccion/:id
DELETE /api/puntos-recoleccion/:id
```

La entidad `PuntoRecoleccion` tiene: `punto_id`, `ruta_id`, `cp` (tipo `string`), `lat`, `lon`, `eliminado`, `created_at`.

## 3. Problemas de integridad ya existentes (recomendado corregir cuanto antes)

Estos dos puntos no son parte de las peticiones del plan del administrador, pero son riesgos reales del flujo que ya esta en produccion:

### 3.1 Las coordenadas de los puntos no se guardan en Postgres

El `INSERT`/`UPDATE` de `punto_recoleccion` solo persiste `ruta_id` y el valor de `cp` (guardado en la columna `direccion`). Las coordenadas `lat`/`lon` que manda el frontend se guardan unicamente en Redis, bajo la llave `point:<punto_id>`. Si Redis se reinicia sin persistencia (RDB/AOF) o la llave expira, la coordenada del punto se pierde para siempre, aunque el registro siga existiendo en la tabla `punto_recoleccion`.

Peticion: agregar columnas `lat` y `lon` (numericas) a la tabla `punto_recoleccion` y guardarlas ahi como fuente de verdad. Redis puede seguir usandose como cache, pero no como unico almacen.

### 3.2 Tipo de `cp` no coincide entre frontend y backend

El frontend envia `cp` como numero (consecutivo de orden). El backend declara `cp` como `string` y ademas lo guarda en la columna `direccion`, que semanticamente es una direccion de texto, no un consecutivo. Esto puede provocar errores de validacion JSON o datos mal interpretados.

Peticion: definir un solo significado y tipo para `cp` (o separar claramente "consecutivo/orden" de "direccion" como dos campos distintos).

## 4. Lo que pide PLAN_ADAPTACION_ADMIN.md y que falta en backend

### 4.1 Relacion ruta-camion persistida — RESUELTO (actualizacion 2026-07-19)

El equipo de backend ya implemento el modulo `ruta_camion` con endpoints reales:

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

Nota para frontend: `camion_id` sigue sin existir dentro de la entidad `Ruta` (`GET /api/rutas/` no lo devuelve embebido). Para saber que camion tiene asignada una ruta, el frontend debe consultar `/api/ruta-camion/ruta/:ruta_id` o `/api/ruta-camion/camion/:camion_id` por separado y cruzar la informacion en el cliente. `color` sigue sin existir en backend; se puede mantener calculado en frontend a partir del `camion_id`, como ya se hace hoy.

Pendiente a confirmar con backend: si al eliminar una ruta o un camion, el registro correspondiente en `ruta_camion` se marca eliminado automaticamente o hay que hacerlo explicitamente desde frontend.

### 4.1.1 Columna `orden` agregada pero sin usar (actualizacion 2026-07-19)

La tabla `punto_recoleccion` ya tiene una columna `orden` (`DOUBLE PRECISION`), que coincide con el "orden flotante" que pide este plan. Sin embargo el codigo Go (`entities.PuntoRecoleccion` y `PostgresPuntoRecoleccion.go`) no la lee ni la escribe en ningun metodo (`Save`, `Update`, `ListAll`, `GetById`, `GetByRuta`).

Peticion: agregar el campo `Orden float64` a la entidad y usarlo en los `INSERT`/`UPDATE`/`SELECT` de `punto_recoleccion`, para que el frontend pueda enviar y recibir el orden flotante real en vez de inferirlo por posicion.

### 4.2 `POST /api/puntos-recoleccion/sync`

El plan del administrador pide migrar el guardado principal de puntos a un endpoint de sincronizacion por lotes. Hoy no existe.

Payload propuesto (a validar con backend):

```json
{
  "ruta_id": 10,
  "puntos_nuevos": [
    { "direccion": "texto opcional", "lat": 16.62345, "lon": -93.09321, "orden": 1 }
  ],
  "puntos_actualizados": [
    { "punto_id": 55, "orden": 2 }
  ],
  "puntos_eliminados": [42, 43]
}
```

Preguntas para backend:

- ¿El backend puede procesar altas, actualizaciones y bajas en una sola transaccion?
- ¿Que responde el endpoint? (se propone devolver la lista completa y actualizada de puntos de la ruta, con sus `punto_id` reales)
- ¿Aplica en cascada si la ruta no existe o esta eliminada?

### 4.3 Geometria vial (opcional, puede quedar en fase futura)

El plan pide una polyline "oficial" calculada por calles (via OSRM/GraphHopper/Valhalla/OpenRouteService), separada de los puntos de recoleccion. Hoy no existe ningun endpoint de calculo de ruta vial en backend. Si el equipo de backend no lo va a implementar pronto, el frontend puede mantener una geometria provisional (union de puntos) marcada explicitamente como no oficial, sin bloquear el resto del plan.

Peticion: confirmar si esto se resuelve en backend (integrando un motor de ruteo) o si el frontend debe llamar directamente a un servicio externo compatible con OSM.

### 4.4 Geometria oficial en `json_ruta`

Hoy `json_ruta` se sobrescribe completo con cada `PUT /api/rutas/:id`, junto con `nombre` y `descripcion`. El plan pide poder guardar ahi una geometria oficial (tipo GeoJSON o similar) de forma independiente, idealmente sin tener que reenviar nombre/descripcion cada vez.

Peticion: evaluar un endpoint o metodo separado, por ejemplo `PATCH /api/rutas/:id/json-ruta`, que solo actualice la geometria oficial.

### 4.5 Estado de publicacion de ruta

El plan pide que una ruta tenga estado (`BORRADOR`, `VALIDANDO`, `VALIDA`, `ERROR`, `PUBLICADA`) y que la app movil solo consuma rutas `PUBLICADA`. Hoy no existe ningun campo de estado en la tabla `ruta` ni endpoint para cambiarlo.

Peticion: agregar una columna de estado a `ruta` (o tabla relacionada) y un endpoint tipo `PATCH /api/rutas/:id/estado` para cambiarlo, mas un filtro en las lecturas que use la app movil para traer solo rutas publicadas.

### 4.6 Eliminacion en cascada de puntos al eliminar una ruta

Hoy `DELETE /api/rutas/:id` hace soft delete solo de la ruta; los `punto_recoleccion` asociados quedan huerfanos (con `ruta_id` apuntando a una ruta eliminada).

Peticion: al eliminar una ruta, marcar tambien como eliminados (soft delete) sus puntos asociados, o exponer un mecanismo para que el frontend lo haga explicitamente antes de borrar la ruta.

## 5. Prioridad sugerida (actualizada 2026-07-19)

1. ~~Relacion ruta-camion persistida~~ — resuelto con el modulo `ruta-camion`.
2. Persistir `lat`/`lon` en Postgres (riesgo de perdida de datos ya en produccion).
3. Definir tipo y significado de `cp`.
4. Usar la columna `orden` ya agregada en `punto_recoleccion` desde la entidad y el adaptador Go.
5. Cascada de eliminacion de puntos al borrar ruta.
6. `POST /api/puntos-recoleccion/sync`.
7. Estado de publicacion de ruta.
8. `json_ruta` oficial separado de nombre/descripcion.
9. Geometria vial (puede quedar para una fase posterior sin bloquear el resto).

## 6. Que puede avanzar en frontend mientras tanto

Las Fases 1 a 3 de `PLAN_ADAPTACION_ADMIN.md` (modelos de borrador, servicio de borrador, integracion en UI con IDs temporales y estados por punto) son logica de frontend y no dependen de estos cambios. Pueden implementarse ya. Las Fases 4 a 7 (sync, geometria vial, `json_ruta` oficial, publicacion) quedan bloqueadas hasta que backend confirme y/o implemente lo anterior.
