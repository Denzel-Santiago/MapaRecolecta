# Funcionamiento del proyecto Mapa-Rec

## 1. Descripcion general

`Mapa-Rec` es el frontend del modulo de mapa de Recolecta. Permite iniciar sesion, proteger el acceso por rol, disenar rutas de recoleccion sobre un mapa de Suchiapa (por clic libre o por un modo detector con KNN + peso), calcular geometria oficial por calles, guardar rutas en el backend y simular el monitoreo del avance de un camion sobre una ruta. Tambien tiene un modo offline para pruebas internas sin backend.

Este documento describe como funciona el proyecto hoy. Para el diseño completo, las decisiones tomadas y el estado fase por fase de las funciones nuevas (detector, borrador, geometria vial, publicacion), ver `PLAN_MAPA_COMPLETO.md`.

El proyecto esta construido con:

- React 19.
- TypeScript.
- Vite.
- Leaflet.
- React Leaflet.
- OpenStreetMap como proveedor de tiles.

El frontend consume el backend mediante rutas relativas `/api/...`. En desarrollo, Vite puede reenviar esas peticiones al backend local, Docker o ngrok mediante el proxy configurado en `vite.config.ts`.

## 2. Flujo general de la aplicacion

El punto de entrada funcional esta en `src/App.tsx`.

La aplicacion funciona asi:

1. Al cargar, intenta recuperar una sesion desde `localStorage`.
2. Si no hay token valido, muestra `LoginPage`.
3. Si hay token valido, muestra `MapaPage`.
4. `MapaPage` permite alternar entre:
   - disenador de rutas
   - monitoreo de ruta
5. El usuario puede cerrar sesion desde la barra superior.

La proteccion de pantalla se hace con `ProtectedRoute`. La sesion se obtiene y valida desde `authService`.

## 3. Autenticacion

El login esta en:

```txt
src/pages/Login/LoginPage.tsx
```

La logica de autenticacion esta en:

```txt
src/services/authService.ts
src/services/api.ts
```

El login envia:

```txt
POST /api/empleados/login
```

Body:

```json
{
  "email": "usuario@recolecta.mx",
  "password": "password"
}
```

El frontend acepta token en cualquiera de estas propiedades de respuesta:

```txt
token
access_token
jwt
```

Cuando recibe el token:

- lo guarda en `localStorage.auth_token`;
- decodifica el JWT;
- lee `user_id`, `role_id` y `exp`;
- elimina el token si ya expiro;
- agrega `Authorization: Bearer TOKEN` en las peticiones protegidas.

Roles conocidos:

```ts
ADMIN = 1
CONDUCTOR = 2
SUPERVISOR = 3
COORDINADOR = 4
```

Actualmente el disenador se considera permitido para:

- ADMIN
- SUPERVISOR

## 4. Cliente HTTP

El cliente base esta en:

```txt
src/services/api.ts
```

`apiRequest` construye la URL usando:

```ts
const BASE_URL = import.meta.env.VITE_API_URL ?? "";
```

Recomendacion actual:

- En desarrollo, dejar `VITE_API_URL` vacio.
- Hacer llamadas a `/api/...`.
- Dejar que Vite reenvie las peticiones al backend mediante `API_PROXY_TARGET`.

Esto evita problemas CORS cuando el frontend corre en `localhost:5173` y el backend esta en otro origen.

El cliente tambien convierte errores de HTML, errores de ngrok y errores JSON en mensajes legibles para la interfaz.

## 4.1 Modo offline (pruebas internas)

Para poder probar el mapa sin depender del backend, existe un modo offline en:

```txt
src/services/offlineMode.ts
```

Se activa con la variable de entorno:

```env
VITE_OFFLINE_MODE=true
```

Cuando esta activo:

- `authService.login` valida contra una credencial fija (`OFFLINE_CREDENCIALES`) y genera un token JWT falso (`construirTokenOffline`, rol ADMIN, 30 dias de vigencia) en vez de llamar a `POST /api/empleados/login`.
- Las cinco funciones de `rutasApi.ts` (`listarRutas`, `obtenerRuta`, `guardarRuta`, `actualizarRuta`, `eliminarRutaBackend`) operan sobre un arreglo en memoria (`rutasOffline`, sembrado con 2 rutas de ejemplo) en vez de llamar al backend real.
- `LoginPage` precarga la credencial offline y muestra un aviso visible de que esta en modo offline.

Con `VITE_OFFLINE_MODE=false` (o sin definir) el comportamiento es exactamente el mismo de siempre, contra el backend real.

## 5. Configuracion Vite y entorno

El archivo real de configuracion es:

```txt
vite.config.ts
```

Vite usa:

```txt
ALLOW_ALL_HOSTS
ALLOWED_HOSTS
API_PROXY_TARGET
VITE_API_PROXY_TARGET
VITE_API_URL
```

Prioridad del proxy:

```txt
API_PROXY_TARGET -> VITE_API_PROXY_TARGET -> VITE_API_URL -> http://localhost:8081
```

Desarrollo recomendado:

```env
ALLOW_ALL_HOSTS=true
ALLOWED_HOSTS=
API_PROXY_TARGET=http://localhost:8081
VITE_API_URL=
VITE_API_PROXY_TARGET=
```

Produccion:

```env
ALLOW_ALL_HOSTS=false
ALLOWED_HOSTS=frontend.example.com,www.example.com
API_PROXY_TARGET=http://localhost:8081
VITE_API_URL=
VITE_API_PROXY_TARGET=
```

Notas importantes:

- `ALLOW_ALL_HOSTS=true` solo debe usarse en desarrollo y pruebas.
- `ALLOWED_HOSTS` no debe llevar `https://`, rutas ni diagonales finales.
- `server.host` y `preview.host` escuchan en `0.0.0.0`.
- El proxy `/api` agrega el header `ngrok-skip-browser-warning: 1`.
- Si Vite sirve en modo produccion, bloquea `ALLOW_ALL_HOSTS=true`.

## 6. Vista principal del mapa

La pagina principal esta en:

```txt
src/pages/Mapa/MapaPage.tsx
```

Responsabilidades:

- Mantener la vista actual: `disenador` o `monitoreo`.
- Mantener la ruta seleccionada para monitoreo.
- Obtener funciones de rutas desde `useRutasDisenadas`.
- Pasar acciones al disenador:
  - guardar ruta
  - eliminar ruta
  - obtener ruta por camion
  - ir a monitoreo
- Cerrar sesion usando `logout`.

El estado de rutas vive actualmente en memoria del frontend, dentro del hook `useRutasDisenadas`.

## 7. Disenador de rutas

El disenador esta dividido en:

```txt
src/components/MapaDiseñador.tsx
src/components/MapaDiseñadorView.tsx
src/hooks/useRutaDiseñador.ts
src/hooks/useDetectorRuta.ts
src/hooks/useRutaBorrador.ts
src/components/SeleccionCamionModal.tsx
src/components/RutaFormModal.tsx
src/components/ResumenRutas.tsx
```

### 7.1 Seleccion de camion

Antes de dibujar, el usuario debe seleccionar un camion.

El modal actual muestra opciones fijas:

```txt
Camion 1
Camion 2
Camion 3
```

Esto ocurre en `SeleccionCamionModal`.

Cuando el usuario elige camion:

- se guarda `camionId`;
- se limpia la ruta temporal;
- se habilita el dibujo en el mapa.

### 7.2 Creacion de puntos

El mapa se muestra centrado en Suchiapa:

```ts
[16.6166, -93.1]
```

Los limites permitidos estan en:

```txt
src/constants/mapa.ts
```

Limites:

```ts
[
  [16.58, -93.15],
  [16.66, -93.05],
]
```

Cada clic en el mapa genera una coordenada real:

```ts
[latitud, longitud]
```

Esa coordenada se guarda en el estado temporal `puntos`.

Si el punto queda fuera de Suchiapa, `useRutaDisenador` lo rechaza usando `estaDentroDeSuchiapa`.

### 7.3 Dibujo visual

`MapaDisenadorView` renderiza:

- `MapContainer`.
- `TileLayer` de OpenStreetMap.
- `Marker` por cada punto.
- `Polyline` cuando hay al menos 2 puntos.

Los marcadores son arrastrables mientras se puede dibujar. Al mover un marcador, se actualiza su coordenada.

Importante:

La linea pintada en Leaflet no se envia como imagen ni como geometria visual. La linea es solo la representacion visual de una lista de coordenadas reales.

### 7.4 Acciones del disenador

El panel del disenador permite:

- `Deshacer`: elimina el ultimo punto temporal.
- `Limpiar`: borra los puntos temporales de la ruta en edicion.
- `Finalizar Ruta`: abre el formulario para capturar nombre y descripcion.
- `Editar formulario`: aparece cuando se esta editando una ruta existente.
- `Cambiar camion`: reinicia la seleccion actual.

Para guardar se exige minimo:

```ts
MIN_ROUTE_POINTS = 2
```

### 7.5 Modo detector (KNN + peso)

Ademas del flujo de clic libre (7.2-7.4), el disenador tiene un segundo modo, activable con el boton "Modo detector", que conviven sin reemplazarse. Implementado en:

```txt
src/services/mapaGeoService.ts        (encontrarVecinoMasCercano, calcularPesoNuevoPunto)
src/models/listaRuta.ts               (ListaRuta, NodoPunto, PuntoConPeso)
src/services/detectorRutaService.ts   (procesarDeteccion, puntosRutaAConPeso)
src/hooks/useDetectorRuta.ts
```

En este modo, un clic en el mapa solo marca un "candidato"; no se agrega nada hasta presionar "Detectar punto". Al detectar:

1. Se busca el vecino mas cercano (K-Nearest-Neighbours, k=1) entre los puntos ya guardados.
2. Se calcula el `peso` del punto nuevo promediando con sus vecinos estructurales en una lista enlazada (`ListaRuta`), o se le asigna `peso = 0` si no hay ningun vecino a menos de `UMBRAL_VECINO_METROS` (40 m).
3. Los puntos con `peso = 0` quedan como "pendientes": se dibujan como marcadores sueltos, sin conectar con `Polyline`, hasta que otra deteccion los enlace.
4. Si el candidato esta a menos de `DISTANCIA_MINIMA_DUPLICADO_METROS` (3 m) de un punto ya existente, se ignora como duplicado.
5. El orden final para dibujar y guardar siempre sale de recorrer la lista enlazada de cabeza a cola (nunca de ordenar por `peso`, que puede tener empates).

Ver `PLAN_MAPA_COMPLETO.md`, seccion 6, para el detalle completo de la regla del peso.

### 7.6 Curvas automaticas

`generarGeometriaVisual` (en `mapaGeoService.ts`) suaviza, solo para dibujar, los tramos donde el giro entre tres puntos consecutivos esta entre `UMBRAL_CURVA_MIN_GRADOS` (15°) y `UMBRAL_CURVA_MAX_GRADOS` (75°), usando interpolacion Catmull-Rom. Las lineas rectas (giro cercano a 0°) y las esquinas reales (giro cercano a 90°) se dejan sin tocar. Esto es puramente visual: los puntos de control reales (los que se guardan y se usan como `Marker`/`CircleMarker`) no cambian.

### 7.7 Modo borrador (edicion en memoria)

```txt
src/models/rutaBorrador.ts
src/services/rutaBorradorService.ts
src/hooks/useRutaBorrador.ts
```

Envuelve, sin modificar su logica interna, la salida de cualquiera de los dos flujos anteriores (clic libre o detector). Mantiene un `RutaBorrador` con cada punto marcado como `sin_cambios`, `nuevo`, `reordenado` o `eliminado`, comparando por coordenada contra el estado anterior. Sirve para mostrar un indicador de "cambios sin sincronizar" y para preparar, mas adelante, el guardado por lotes (`sync`). **Hoy no cambia el guardado real**: `Finalizar Ruta` sigue yendo por el mismo camino de siempre (`rutasApi.ts`).

`src/services/puntosRecoleccionApi.ts` ya tiene escrito `syncPuntosRecoleccion`/`sincronizarPuntosDeRuta` (`POST /api/puntos-recoleccion/sync`). Tras un guardado exitoso, `MapaDiseñador.tsx` siempre re-basea el borrador contra lo que realmente quedo guardado (para que el indicador de "cambios sin sincronizar" no se quede encendido para siempre). El intento de `sync` en si **solo se ejecuta si `VITE_SYNC_PUNTOS_ENABLED=true`** (apagado por defecto): el contrato exacto de ese endpoint todavia no esta confirmado con backend, asi que el intento es no bloqueante y falla en silencio (con un aviso no bloqueante en pantalla) si el endpoint no existe o responde distinto.

### 7.8 Geometria vial oficial (opt-in)

```txt
src/services/rutaVialService.ts
```

El boton "Calcular geometria oficial" pide, bajo demanda, la ruta real por calles a un motor de ruteo compatible con la API de OSRM (por defecto, el servidor de demostracion publico `router.project-osrm.org`, pensado solo para pruebas, no para produccion). Si el calculo tiene exito, esa geometria reemplaza la curva provisional (7.6) solo para la ruta que se esta editando. Si no se pide, o si falla, todo se ve exactamente igual que antes. La geometria calculada se invalida automaticamente en cuanto cambian los puntos de control.

### 7.9 Publicacion de ruta (solo en memoria)

El boton "Publicar ruta" cambia `RutaBorrador.estadoPublicacion` (`BORRADOR` / `ERROR` / `PUBLICADA`) usando `publicarRuta`/`volverABorrador` de `rutaBorradorService.ts`. Solo permite pasar a `PUBLICADA` si ya se calculo una geometria oficial valida (7.8); si no, queda en `ERROR`. Editar los puntos despues de publicar revierte automaticamente a `BORRADOR`.

**Este estado es puramente del frontend, no se persiste**: backend todavia no confirma si maneja un campo de estado de publicacion de ruta. La UI lo aclara explicitamente para no dar a entender que una ruta "publicada" aqui ya es visible para la app movil del conductor.

## 8. Datos que se envian al backend

Actualmente el mapa envia coordenadas reales, no una imagen ni una ruta pintada.

Flujo actual implementado:

1. El usuario marca puntos en el mapa.
2. Cada punto es una coordenada real `[latitud, longitud]`.
3. `rutaService` convierte esas coordenadas a puntos internos:

```ts
{
  orden: 1,
  lat: 16.62345,
  lng: -93.09321
}
```

4. `rutasApi.ts` convierte esos puntos al formato que hoy se envia a backend:

```json
{
  "nombre": "Ruta Centro",
  "descripcion": "Ruta principal de recoleccion",
  "json_ruta": [
    {
      "latitud": 16.62345,
      "longitud": -93.09321
    }
  ]
}
```

5. Ese payload se manda a:

```txt
POST /api/rutas/
```

6. El backend debe devolver `ruta_id`.

La ruta dibujada se puede reconstruir porque el frontend conserva el orden de los puntos y sus coordenadas.

## 9. Ajuste pendiente para puntos de recoleccion

Para poder editar o eliminar cada punto de forma individual, el flujo debe evolucionar a dos recursos:

```txt
api/rutas
api/puntos-recoleccion
```

Flujo recomendado:

1. Enviar la ruta base a:

```txt
POST /api/rutas/
```

2. Obtener `ruta_id`.
3. Enviar cada punto por separado a:

```txt
POST /api/puntos-recoleccion
```

JSON esperado para cada punto:

```json
{
  "cp": 1,
  "lat": 16.62345,
  "lon": -93.09321,
  "ruta_id": 10
}
```

Significado:

- `cp`: consecutivo u orden del punto.
- `lat`: latitud real.
- `lon`: longitud real.
- `ruta_id`: id devuelto por `api/rutas`.

Para edicion futura:

- editar ruta base: `PUT/PATCH /api/rutas/:id`;
- editar punto: `PUT/PATCH /api/puntos-recoleccion/:id`;
- eliminar punto: `DELETE /api/puntos-recoleccion/:id`;
- eliminar ruta: `DELETE /api/rutas/:id`.

## 10. Estado actual de multiples rutas

El hook:

```txt
src/hooks/useRutasDisenadas.ts
```

mantiene un arreglo local:

```ts
RutaDisenada[]
```

Cuando se guarda una ruta:

- si el camion no tenia ruta, la agrega;
- si el camion ya tenia ruta, reemplaza la ruta de ese camion;
- ordena las rutas por `camion_id`.

Cuando se elimina una ruta:

- la elimina del estado local usando `camion_id`;
- actualmente esa eliminacion no se manda al backend.

Limitacion actual:

- Las rutas guardadas viven en memoria mientras la pagina esta cargada.
- No se cargan rutas existentes desde backend al entrar.
- No hay capas para ver una ruta especifica o todas.
- La vista del mapa trabaja principalmente con una ruta activa.

## 11. Resumen de rutas

`ResumenRutas` muestra las rutas que existen en el estado local.

Por cada ruta muestra:

- camion;
- nombre;
- descripcion;
- cantidad de puntos;
- acciones:
  - Ver
  - Editar
  - Eliminar

Actualmente:

- `Ver` carga los puntos de esa ruta en el mapa.
- `Editar` carga esa ruta en el formulario y en los puntos editables.
- `Eliminar` borra la ruta del estado local.

Pendiente:

- sincronizar `Editar` con backend;
- sincronizar `Eliminar` con backend;
- agregar selector desplegable para ver una ruta o todas;
- agregar capas y colores independientes.

## 12. Monitoreo

El monitoreo esta dividido en:

```txt
src/components/MapaMonitoreo.tsx
src/components/MapaMonitoreoView.tsx
src/hooks/useMonitoreo.ts
src/services/monitoreoService.ts
```

Cuando se pulsa `Ir a Monitoreo`, `MapaPage` toma la ruta seleccionada y la convierte a coordenadas usando:

```ts
puntosRutaACoordenadas(rutaMonitoreada.puntos)
```

`useMonitoreo`:

- recibe una lista de coordenadas;
- inicia en el primer punto;
- avanza un indice cada segundo;
- calcula posicion actual del camion;
- calcula ruta recorrida;
- calcula porcentaje de avance;
- guarda la hora de ultima actualizacion.

`MapaMonitoreoView` renderiza:

- puntos grises para pendientes;
- puntos verdes para recorridos;
- linea gris para ruta total;
- linea verde para tramo recorrido;
- marcador del camion en la posicion actual.

La simulacion es local. No consume ubicacion real del camion ni telemetria en tiempo real.

## 13. Modelos principales

### 13.1 Coordenada

```ts
export type Coordenada = [number, number];
```

Formato:

```txt
[latitud, longitud]
```

### 13.2 PuntoRuta actual

```ts
export interface PuntoRuta {
  orden: number;
  lat: number;
  lng: number;
}
```

### 13.3 RutaDisenada actual

```ts
export interface RutaDisenada {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  camion_id: number;
  puntos: PuntoRuta[];
}
```

### 13.4 Modelo recomendado para puntos editables

Para soportar `api/puntos-recoleccion`, el punto deberia guardar el id real del backend:

```ts
export interface PuntoRuta {
  punto_id: number | null;
  cp: number;
  orden: number;
  lat: number;
  lon: number;
}
```

Esto permitiria editar y eliminar puntos individualmente.

## 14. Archivos importantes

- `src/App.tsx`: decide si mostrar login o mapa protegido.
- `src/components/ProtectedRoute.tsx`: protege el acceso.
- `src/pages/Login/LoginPage.tsx`: formulario de login.
- `src/pages/Mapa/MapaPage.tsx`: vista principal del modulo de mapa.
- `src/components/MapaDiseñador.tsx`: flujo de seleccion de camion, dibujo (clic libre y detector), borrador, geometria vial, publicacion y guardado.
- `src/components/MapaDiseñadorView.tsx`: Leaflet para dibujar puntos, polilinea, curvas y geometria oficial.
- `src/components/ResumenRutas.tsx`: listado local de rutas creadas.
- `src/components/RutaFormModal.tsx`: formulario de nombre y descripcion de ruta.
- `src/components/SeleccionCamionModal.tsx`: seleccion inicial de camion.
- `src/components/MapaMonitoreo.tsx`: panel de monitoreo.
- `src/components/MapaMonitoreoView.tsx`: Leaflet para visualizar avance.
- `src/hooks/useRutaDiseñador.ts`: estado de puntos temporales (modo clic libre).
- `src/hooks/useDetectorRuta.ts`: estado del modo detector (KNN + peso).
- `src/hooks/useRutaBorrador.ts`: estado del modo borrador (cambios pendientes, publicacion).
- `src/hooks/useRutasDiseñadas.ts`: arreglo local de rutas disenadas.
- `src/hooks/useMonitoreo.ts`: simulacion de avance.
- `src/services/api.ts`: cliente HTTP con token.
- `src/services/authService.ts`: login, JWT, roles y logout (con rama a modo offline).
- `src/services/offlineMode.ts`: modo offline (credencial fija, rutas en memoria).
- `src/services/rutasApi.ts`: guardado actual en `/api/rutas/` (con rama a modo offline).
- `src/services/rutaService.ts`: conversion y validacion de rutas.
- `src/services/mapaGeoService.ts`: distancia, limites, KNN, peso, angulos de giro y curvas Catmull-Rom.
- `src/services/detectorRutaService.ts`: orquesta el pipeline del modo detector.
- `src/services/rutaBorradorService.ts`: conversion, edicion y payload de sync del modo borrador.
- `src/services/rutaVialService.ts`: geometria oficial por calles (API estilo OSRM).
- `src/services/puntosRecoleccionApi.ts`: CRUD de puntos y `syncPuntosRecoleccion` (escrito, sin conectar a la UI).
- `src/services/monitoreoService.ts`: porcentaje y tramo recorrido.
- `src/models/listaRuta.ts`: `ListaRuta`, `NodoPunto`, `PuntoConPeso`.
- `src/models/rutaBorrador.ts`: `RutaBorrador`, `PuntoBorrador`, estados de publicacion.
- `src/constants/mapa.ts`: centro, limites, minimo de puntos, umbrales de KNN/curvas/duplicados.
- `vite.config.ts`: proxy, hosts permitidos y configuracion Vite.
- `PLAN_MAPA_COMPLETO.md`: diseño completo, decisiones y estado fase por fase de todo lo anterior.

## 15. Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

`npm run build` ejecuta:

```bash
tsc -b && vite build
```

`npm test` ejecuta `vitest run` sobre los archivos `*.test.ts` (`listaRuta.test.ts`, `mapaGeoService.test.ts`, `detectorRutaService.test.ts`).

## 16. Limitaciones actuales

- `puntosRecoleccionApi.ts` existe (CRUD + `syncPuntosRecoleccion`) pero no esta conectado a ningun componente: el contrato de `POST /api/puntos-recoleccion/sync` no esta confirmado con backend.
- El modo borrador (7.7) mantiene el estado de cambios en memoria, pero el guardado real sigue siendo el mismo de siempre (`rutasApi.ts`), no el `sync` por lotes.
- La geometria oficial por calles (7.8) usa por defecto el servidor de demostracion publico de OSRM, no pensado para produccion; falta decidir un servidor propio o un proveedor con SLA.
- El estado de publicacion de ruta (7.9) es solo del frontend: no se persiste, porque backend no confirma si maneja ese campo.
- La edicion de rutas no esta persistida con `PUT/PATCH` mas alla de lo que ya hace `rutasApi.ts`.
- La eliminacion de rutas no esta persistida en cascada de puntos (depende de que backend la maneje).
- Los camiones disponibles en el modal estan fijos como 1, 2 y 3.
- El monitoreo es una simulacion local por indice, no seguimiento real.
- La posicion del camion avanza cada segundo de punto a punto, sin interpolacion.
- `npm run lint` y `npm run build` (`tsc -b`) corren limpio; `npm test` (`vitest run`) puede fallar en algunos entornos por un problema conocido de esbuild/vitest ajeno al codigo del proyecto. Si eso ocurre, verificar la logica pura con `npx tsc` + `node -e` manual, como se documenta en `PLAN_MAPA_COMPLETO.md`.

## 17. Pendientes recomendados

Prioridad alta (bloqueada por backend, ver `PLAN_MAPA_COMPLETO.md` seccion 10):

1. Confirmar contrato de `api/rutas` y de `POST /api/puntos-recoleccion/sync`.
2. Confirmar si existe un endpoint de geometria vial en backend, o si se sigue calculando en el frontend.
3. Confirmar si backend va a manejar un estado de publicacion de ruta.
4. Decidir un servidor de produccion para la geometria oficial (OSRM propio o proveedor con SLA).
5. Conectar `syncPuntosRecoleccion` al guardado real una vez confirmado el contrato.

Prioridad media:

1. Agregar colores por camion o por ruta.
2. Permitir ver una ruta o todas (ya existe el selector; falta capas independientes por color).
3. Persistir edicion y eliminacion via sync en vez del camino actual.
4. Completar pruebas automatizadas (`vitest`) para los servicios de red (`rutasApi.ts`, `puntosRecoleccionApi.ts`, `rutaVialService.ts`), que hoy no tienen cobertura.
5. Limpiar codigo muerto (`src/api/mockApi.ts`, datos falsos sin usar).

Prioridad futura:

1. Obtener camiones reales desde backend.
2. Agregar monitoreo real desde API o WebSocket.
3. Interpolar movimiento entre puntos.
4. Calcular distancia y tiempo estimado.
5. Agregar cache local/offline mas alla del modo offline de pruebas ya implementado.

## 18. Respuesta corta sobre que datos manda el mapa

El mapa manda coordenadas reales.

La ruta pintada es solo la representacion visual de esas coordenadas en Leaflet. Actualmente esas coordenadas se envian dentro de `json_ruta` a `POST /api/rutas/`. El ajuste recomendado es crear primero la ruta, obtener `ruta_id` y despues mandar cada coordenada real como punto individual a `POST /api/puntos-recoleccion` con:

```json
{
  "cp": 1,
  "lat": 16.62345,
  "lon": -93.09321,
  "ruta_id": 10
}
```
