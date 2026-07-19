# Funcionamiento del proyecto Mapa-Rec

## 1. Descripcion general

`Mapa-Rec` es el frontend del modulo de mapa de Recolecta. Permite iniciar sesion, proteger el acceso por rol, disenar rutas de recoleccion sobre un mapa de Suchiapa, guardar rutas en el backend y simular el monitoreo del avance de un camion sobre una ruta.

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
src/components/MapaDisenador.tsx
src/components/MapaDisenadorView.tsx
src/hooks/useRutaDisenador.ts
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
- `src/components/MapaDisenador.tsx`: flujo de seleccion de camion, dibujo, guardado y acciones.
- `src/components/MapaDisenadorView.tsx`: Leaflet para dibujar puntos y polilinea.
- `src/components/ResumenRutas.tsx`: listado local de rutas creadas.
- `src/components/RutaFormModal.tsx`: formulario de nombre y descripcion de ruta.
- `src/components/SeleccionCamionModal.tsx`: seleccion inicial de camion.
- `src/components/MapaMonitoreo.tsx`: panel de monitoreo.
- `src/components/MapaMonitoreoView.tsx`: Leaflet para visualizar avance.
- `src/hooks/useRutaDisenador.ts`: estado de puntos temporales.
- `src/hooks/useRutasDisenadas.ts`: arreglo local de rutas disenadas.
- `src/hooks/useMonitoreo.ts`: simulacion de avance.
- `src/services/api.ts`: cliente HTTP con token.
- `src/services/authService.ts`: login, JWT, roles y logout.
- `src/services/rutasApi.ts`: guardado actual en `/api/rutas/`.
- `src/services/rutaService.ts`: conversion y validacion de rutas.
- `src/services/monitoreoService.ts`: porcentaje y tramo recorrido.
- `src/constants/mapa.ts`: centro, limites y minimo de puntos.
- `vite.config.ts`: proxy, hosts permitidos y configuracion Vite.

## 15. Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

`npm run build` ejecuta:

```bash
tsc -b && vite build
```

## 16. Limitaciones actuales

- No se cargan rutas desde backend al iniciar.
- No existe `puntosRecoleccionApi.ts`.
- No se mandan puntos individualmente a `api/puntos-recoleccion`.
- La edicion de rutas no esta persistida con `PUT/PATCH`.
- La eliminacion de rutas no esta persistida con `DELETE`.
- No hay capas para mostrar una ruta o todas.
- No hay colores independientes por ruta.
- Los camiones disponibles en el modal estan fijos como 1, 2 y 3.
- El monitoreo es una simulacion local por indice, no seguimiento real.
- La posicion del camion avanza cada segundo de punto a punto, sin interpolacion.

## 17. Pendientes recomendados

Prioridad alta:

1. Confirmar contrato de `api/rutas`.
2. Confirmar contrato de `api/puntos-recoleccion`.
3. Crear servicio `puntosRecoleccionApi.ts`.
4. Guardar ruta base y luego guardar puntos con `ruta_id`.
5. Guardar `punto_id` para editar o eliminar puntos.
6. Cargar rutas y puntos desde backend al iniciar.

Prioridad media:

1. Agregar colores por camion o por ruta.
2. Implementar selector desplegable de rutas.
3. Permitir ver una ruta o todas.
4. Separar ruta visible de ruta en edicion.
5. Persistir edicion y eliminacion.

Prioridad futura:

1. Obtener camiones reales desde backend.
2. Agregar monitoreo real desde API o WebSocket.
3. Interpolar movimiento entre puntos.
4. Calcular distancia y tiempo estimado.
5. Agregar cache local/offline si se requiere.

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
