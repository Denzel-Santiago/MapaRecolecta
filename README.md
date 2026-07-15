# Mapa-Rec

Frontend independiente para disenar, guardar y monitorear rutas de recoleccion en Suchiapa, Chiapas. Esta construido con React, TypeScript, Vite, Leaflet y React Leaflet.

Este proyecto no depende de `recolecta-web`. Comparte el mismo backend (`API_recolecta`) y el mismo contrato de autenticacion, pero tiene sus propios servicios, paginas, configuracion Vite y variables de entorno.

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Backend `API_recolecta` corriendo localmente o publicado mediante una URL accesible

## Instalacion

```bash
npm install
```

## Configuracion de entorno

El proyecto lee variables Vite desde un archivo `.env` ubicado en la raiz de este proyecto:

```txt
Mapa/Mapa-Rec/.env
```

Este archivo no debe subirse al repositorio. Usa el ejemplo incluido:

```bash
cp .env.example .env
```

Configuracion recomendada para desarrollo local:

```env
VITE_API_URL=
VITE_API_PROXY_TARGET=http://localhost:8081
```

Si el backend corre en `8080`, usa:

```env
VITE_API_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
```

Si usas ngrok:

```env
VITE_API_URL=
VITE_API_PROXY_TARGET=https://TU-SUBDOMINIO.ngrok-free.app
```

La recomendacion es dejar `VITE_API_URL` vacio en desarrollo para que el navegador llame a rutas relativas como `/api/empleados/login`. Vite reenvia esas llamadas al backend usando `VITE_API_PROXY_TARGET`. Esto evita errores CORS cuando el frontend corre en `localhost:5173` y la API esta en otro origen.

Solo usa llamada directa si el backend tiene CORS correctamente configurado:

```env
VITE_API_URL=http://localhost:8081
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

En desarrollo, Vite normalmente publica la app en:

```txt
http://localhost:5173
```

## Configuracion Vite

Archivo principal:

```txt
vite.config.ts
```

Este archivo:

- carga variables con `loadEnv`
- usa `VITE_API_PROXY_TARGET || VITE_API_URL || http://localhost:8081`
- configura proxy para `/api`
- agrega el header `ngrok-skip-browser-warning: 1` cuando se usa ngrok
- permite hosts `.ngrok-free.app`

## Estructura principal

```txt
src/
  App.tsx
  pages/
    Login/
      LoginPage.tsx
      LoginPage.css
    Mapa/
      MapaPage.tsx
      MapaPage.css
  components/
    MapaDiseñador.tsx
    MapaDiseñadorView.tsx
    MapaMonitoreo.tsx
    MapaMonitoreoView.tsx
    RutaFormModal.tsx
    ResumenRutas.tsx
    SeleccionCamionModal.tsx
    ProtectedRoute.tsx
    diseñador.css
  hooks/
    useRutaDiseñador.ts
    useRutasDiseñadas.ts
    useMonitoreo.ts
  services/
    api.ts
    authService.ts
    rutasApi.ts
    rutaService.ts
    monitoreoService.ts
  models/
    geo.ts
    rutaDiseñada.ts
    ModelosMapa.tsx
```

## Flujo de autenticacion

La pantalla de login esta en:

```txt
src/pages/Login/LoginPage.tsx
```

El servicio de autenticacion esta en:

```txt
src/services/authService.ts
```

El login llama a:

```txt
POST /api/empleados/login
```

Body enviado:

```json
{
  "email": "usuario@recolecta.mx",
  "password": "password"
}
```

Cuando el backend responde con token, el frontend guarda el JWT en:

```txt
localStorage.auth_token
```

El token se decodifica para leer:

- `user_id`
- `role_id`
- `exp`

El acceso al disenador se permite para:

- `ADMIN` rol `1`
- `SUPERVISOR` rol `3`

## Servicio base de API

Archivo:

```txt
src/services/api.ts
```

Responsabilidades:

- leer `VITE_API_URL`
- construir `fetch(BASE_URL + path)`
- agregar `Content-Type: application/json`
- agregar `Authorization: Bearer TOKEN`
- guardar y limpiar `auth_token`
- convertir errores JSON, HTML o errores de ngrok en mensajes legibles

Ejemplo:

```ts
apiRequest("/api/empleados/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});
```

## Flujo del mapa

La pagina principal del mapa esta en:

```txt
src/pages/Mapa/MapaPage.tsx
```

Esta pagina decide si se muestra:

- `MapaDiseñador`
- `MapaMonitoreo`

El disenador se encuentra en:

```txt
src/components/MapaDiseñador.tsx
```

Flujo de uso:

1. El usuario inicia sesion.
2. Selecciona un camion.
3. Dibuja puntos en el mapa.
4. Presiona `Finalizar Ruta`.
5. Captura `nombre` y `descripcion`.
6. Presiona `Guardar ruta`.
7. Se envia `POST /api/rutas/`.
8. Si la API responde correctamente, la ruta se guarda tambien en estado local para verla en el resumen.

## Formato enviado para guardar rutas

Servicio:

```txt
src/services/rutasApi.ts
```

Endpoint:

```txt
POST /api/rutas/
```

JSON enviado:

```json
{
  "nombre": "Ruta Centro",
  "descripcion": "Ruta principal de recoleccion",
  "json_ruta": [
    {
      "latitud": 16.62345,
      "longitud": -93.09321
    },
    {
      "latitud": 16.62401,
      "longitud": -93.09288
    }
  ]
}
```

`json_ruta` contiene unicamente los puntos dibujados, ordenados, con latitud y longitud. No se envian `camion_id`, `zona`, `turno`, `fecha` ni `estado` dentro de `json_ruta`.

## Hooks

La carpeta `src/hooks` contiene logica reutilizable de React separada de la interfaz.

- `useRutaDiseñador.ts`: guarda puntos dibujados, valida limites, permite deshacer, limpiar y editar puntos.
- `useRutasDiseñadas.ts`: mantiene la lista local de rutas creadas durante la sesion.
- `useMonitoreo.ts`: calcula avance, posicion de camion y ruta recorrida para la vista de monitoreo.

## Notas sobre CORS y ngrok

Si `VITE_API_URL` apunta directo a un dominio externo, el navegador hace una peticion cross-origin y puede aparecer:

```txt
Access-Control-Allow-Origin missing
Failed to fetch
```

Para desarrollo, evita eso usando:

```env
VITE_API_URL=
VITE_API_PROXY_TARGET=https://TU-SUBDOMINIO.ngrok-free.app
```

Asi el navegador llama a `/api/...` en el mismo origen de Vite y Vite reenvia la peticion al backend.

## Archivos importantes

- `src/services/api.ts`: conexion base con API y token.
- `src/services/authService.ts`: login, logout, roles y expiracion JWT.
- `src/services/rutasApi.ts`: guardado de rutas.
- `src/pages/Login/LoginPage.tsx`: pantalla de login.
- `src/pages/Mapa/MapaPage.tsx`: pagina principal del mapa.
- `src/components/MapaDiseñador.tsx`: dibujo y guardado de rutas.
- `vite.config.ts`: proxy, host y configuracion de Vite.
