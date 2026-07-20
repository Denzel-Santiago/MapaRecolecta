# Permisos por rol — Backend (gin-backend)

Este documento resume, endpoint por endpoint, qué rol puede hacer qué. Se generó leyendo directamente cada `*_routes.go` / `*_controller.go` (`core.RequireRole(...)` y `core.JWTAuthMiddleware()`), no es una descripción de intención — es lo que el código realmente aplica.

## Roles (tabla `rol`)

| id | Rol | Constante en `core/roles.go` |
|----|-----|-------------------------------|
| 1 | Administrador | `ADMIN` |
| 2 | Coordinador | `COORDINADOR` |
| 3 | Operador | `SUPERVISOR` |
| 4 | Conductor | `CONDUCTOR` |
| 5 | Ciudadano | *(no participa en `core.RequireRole`; usa su propio login/JWT)* |

> **Nota:** en absolutamente ningún endpoint del backend se distingue a `SUPERVISOR` (Operador) de `COORDINADOR` — siempre aparecen juntos en la misma lista de `RequireRole(...)`. Funcionalmente son el mismo nivel de acceso; solo cambia el nombre mostrado.

Cómo funciona la protección: cada grupo de rutas aplica (o no) dos middlewares en cadena:
- `core.JWTAuthMiddleware()` — exige sesión válida (cualquier rol).
- `core.RequireRole(core.X, core.Y, ...)` — exige, además, que el rol del token esté en esa lista.

Si un grupo no llama a ninguno de los dos, el endpoint es público / no requiere sesión.

## Matriz de endpoints

| Endpoint (prefijo) | Admin | Coordinador | Operador | Conductor | Notas |
|---|:---:|:---:|:---:|:---:|---|
| `POST /api/empleados/login` | — | — | — | — | Público (login) |
| `/api/empleados/*` (CRUD) | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `POST /api/roles`, `GET/PUT/DELETE /api/roles` | ✅ | ❌ | ❌ | ❌ | Definido en `rol_controller.go`, pero **no está montado** en `dependencies.go`/`main.go` — hoy no es alcanzable por HTTP |
| `GET /api/colonia`, `GET /api/colonia/:id` | ✅ | ✅ | ✅ | ✅ | Público, sin sesión |
| `POST/PUT/DELETE /api/colonia` | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `POST /api/ciudadanos`, `POST /api/ciudadanos/login` | — | — | — | — | Público (alta/login de ciudadano) |
| `/api/ciudadanos` (list/get/update/delete) | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `/api/domicilios/*` | ✅ | ✅ | ✅ | ✅ | Solo exige sesión, cualquier rol |
| `POST /api/alertas` | ✅ | ✅ | ✅ | ❌ | Crear alerta: Admin + Operador (Coordinador incluido vía `SUPERVISOR`… ver nota abajo) |
| `GET /api/alertas`, `PUT /api/alertas/:id/leida` | ✅ | ✅ | ✅ | ✅ | Solo exige sesión; cada quien ve/marca las suyas |
| `/api/rutas/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/relleno-sanitario/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/registro-vaciado/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/puntos-recoleccion/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/estado-camion/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/camion/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/anomalias/*` | ✅ | ✅ | ✅ | ❌ | Conductor excluido a propósito |
| `/api/incidencias/*` | ✅ | ✅ | ✅ | ❌ | Conductor excluido a propósito |
| `/api/seguimientos-falla-critica/*` | ✅ | ✅ | ✅ | ❌ | Conductor excluido a propósito |
| `/api/alertas-mantenimiento/*` | ✅ | ✅ | ✅ | ❌ | Conductor excluido a propósito |
| `/api/reportes-falla-critica/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/reportes-conductor/*` | ✅ | ✅ | ✅ | ✅ | CRUD completo para los 4 roles |
| `/api/notifications/rules/*` | ✅ | ✅ | ✅ | ✅ | Solo exige sesión, cualquier rol |
| `POST /api/realtime/ws/upgrade-token` | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `POST /api/realtime/ws/sessions/:id/heartbeat` | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `GET/DELETE /api/realtime/ws/sessions/:id` | ✅ | ❌ | ❌ | ❌ | Exclusivo ADMIN |
| `POST /api/realtime/ws/sessions/consume` | — | — | — | — | Público (token de un solo uso) |
| `POST /api/notifications/citizens/send`, `/api/notifications/events/*` | — | — | — | — | Público (pensado para uso interno/servicio, no para staff) |

## ⚠️ Endpoints sin ninguna protección (ni sesión ni rol)

Estos grupos no llaman ni a `JWTAuthMiddleware()` ni a `RequireRole(...)` — cualquiera, con o sin sesión, puede hacer CRUD completo:

- `/api/historial-asignacion/*`
- `/api/registros-mantenimiento/*`
- `/api/reportes-mantenimiento-generado/*`
- `/api/tipos-mantenimiento/*`
- `/api/tipo-camion/*`
- `/api/ruta-camion/*`
- `/api/notificaciones/*` (módulo interno de notificaciones, CRUD completo sin protección)

Esto no es una decisión de "qué rol puede qué" — es una falta de middleware, aplicable por igual a los 4 roles y a solicitudes anónimas.

## Resumen por rol

### Administrador
Acceso total: todo lo de la tabla, más lo exclusivo de ADMIN (`empleados`, `colonia` escritura, `ciudadanos`, `realtime/ws` admin).

### Coordinador y Operador (permisos idénticos)
- CRUD completo: rutas, relleno-sanitario, registro-vaciado, puntos-recoleccion, estado-camion, camion, reportes-falla-critica, reportes-conductor.
- Acceso a: anomalías, incidencias, seguimientos-falla-critica, alertas-mantenimiento (Conductor no entra aquí).
- Pueden crear alertas de usuario (`POST /api/alertas`).
- Sin acceso a: empleados, colonia (escritura), ciudadanos, roles, realtime/ws admin.

### Conductor
- CRUD completo: rutas, relleno-sanitario, registro-vaciado, puntos-recoleccion, estado-camion, camion, reportes-falla-critica, reportes-conductor.
- Puede leer/marcar sus propias alertas, pero no crear alertas nuevas.
- **Sin acceso**: anomalías, incidencias, seguimientos-falla-critica, alertas-mantenimiento, empleados, colonia (escritura), ciudadanos, roles, realtime/ws admin.

---

