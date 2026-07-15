# Mapa Recolecta (Suchiapa, Chiapas)

Aplicación web desarrollada con **React + TypeScript + Vite** para visualizar un **mapa interactivo** enfocado en la planeación y representación de rutas de recolección en Suchiapa, Chiapas.

Este repositorio contiene mejoras y refactorizaciones del prototipo inicial: soporte para múltiples camiones, movimiento de camiones con velocidad configurable, persistencia local de rutas, y una separación más clara entre hooks, servicios y modelos.

---

## Introducción

`Mapa Recolecta` es un frontend construido con React y Leaflet que permite dibujar rutas en un mapa, simular el avance de camiones por la ruta y monitorizar el progreso. Está pensado como prototipo para integrar luego APIs y persistencia en servidor.

---

## Novedades y mejoras (actualizadas)

- **Múltiples camiones**: ahora la aplicación soporta una flota y la selección de ícono por camión.
- **Velocidad configurable**: la animación del camión puede ajustarse (velocidad/intervalo) desde el estado o `monitoreoService`.
- **Persistencia local**: la ruta actual se guarda en `localStorage` y se restaura al recargar la página.
- **Refactor a hooks y servicios**: lógica de monitoreo y diseñador extraída a `useMonitoreo`, `useRutaDiseñador` y servicios en `src/services`.
- **Modelos reutilizados**: `src/models/ModelosMapa.tsx` ahora se usa para tipado y entidades (`Ruta`, `PuntoRecoleccion`, `Camion`).
- **Mejoras UI/UX**: botones `Deshacer`, `Limpiar`, `Ir a Monitoreo`, estado de botones (habilitado/deshabilitado) y estilos responsive.
- **Estructura modular**: componentes, hooks, servicios y constantes organizados para facilitar integración futura con backend.

---

## Características Principales

- Visualización de mapa interactivo (OpenStreetMap)
- Diseñador de rutas con clics y `Polyline`
- Monitorización con animación de camiones y trazado de tramo recorrido
- Persistencia local de rutas (`localStorage`)
- Soporte para múltiples camiones y selección de íconos
- Hooks y servicios para separar lógica de UI

---

## Arquitectura

Arquitectura **SPA (Single Page Application)** basada en componentes con separación de responsabilidades:

- `src/components`: UI del diseñador y monitoreo
- `src/hooks`: hooks reutilizables (`useMonitoreo`, `useRutaDiseñador`)
- `src/services`: lógica de negocio y utilidades (`monitoreoService`, `rutaService`)
- `src/models`: entidades y tipos (`ModelosMapa.tsx`)

---

## Stack Tecnológico

### Frontend
- React
- TypeScript
- Vite

### Mapas
- Leaflet
- React Leaflet
- OpenStreetMap (tiles)

---

## Requisitos

- Node.js >= 18
- npm >= 9

---

## Instalación y ejecución

1) Clonar repositorio

```bash
git clone https://github.com/Denzel-Santiago/MapaRecolecta.git
```

2) Entrar a la carpeta

```bash
cd Mapa-Rec
```

3) Instalar dependencias

```bash
npm install
```

4) Ejecutar en desarrollo

```bash
npm run dev
```

El proyecto se abrirá normalmente en `http://localhost:5173` (o el puerto que indique Vite).

5) Configurar la API (desarrollo)

```bash
cp .env.example .env
```

Por defecto el `.env` deja `VITE_API_URL` vacío y apunta el proxy a `http://localhost:8081` (Gin publicado por Docker de `recolecta_web` con `BACKEND_PORT=8081`).

---

## Conexión con la API

En desarrollo el patrón correcto es **mismo origen + proxy de Vite** (evita CORS y el 403 HTML de ngrok free):

1. El navegador llama a `http://localhost:5173/api/...`
2. Vite reenvía `/api` a `VITE_API_PROXY_TARGET` (Gin en `localhost:8081`)
3. Login: `POST /api/empleados/login` con body `{"email","password"}` y `Content-Type: application/json`

Variables en `.env` / `.env.example`:

| Variable | Uso |
|----------|-----|
| `VITE_API_URL` | Base URL del cliente. En local: vacío. |
| `VITE_API_PROXY_TARGET` | Destino del proxy Vite. Local: `http://localhost:8081`. |

**No** pongas la URL de ngrok en `VITE_API_URL`: el navegador haría petición cross-origin y ngrok free puede responder 403 (página “Visit Site”) en lugar de Gin. Ngrok sirve para clientes externos (p. ej. Swagger); MapaRecolecta en local debe usar el proxy a `:8081`.

El login de Gin responde `200` / `400` / `401`. Un `403` casi siempre viene de otro hop (ngrok, host bloqueado), no del endpoint de login.

---

## Estructura del Proyecto (resumen)

Mapa-Rec/
│
├── public/                      # Archivos públicos estáticos
│
├── src/
│   ├── assets/                  # Imágenes, íconos, etc.
│   ├── components/              # Componentes UI (`MapaDiseñador`, `MapaMonitoreo`)
│   ├── hooks/                   # Hooks (`useMonitoreo`, `useRutaDiseñador`)
│   ├── services/                # Servicios (`monitoreoService`, `rutaService`)
│   ├── models/                  # Modelos y tipos (`ModelosMapa.tsx`)
│   ├── data/                    # Datos de ejemplo (`DatosFalsos.tsx`)
│   ├── App.tsx                  # Componente raíz
│   └── main.tsx                 # Entrada principal
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
└── README.md

---

## Configuración del Mapa

Ejemplo de `TileLayer` usado por defecto:

```tsx
<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
```

---

## Buenas prácticas y recomendaciones

- Copiar `.env.example` a `.env` y no subir `.env` (ya está en `.gitignore`).
- En local, preferir proxy Vite → `localhost:8081` frente a llamar ngrok desde el navegador.
- Usar HTTPS en despliegues y considerar despliegues en contenedores o servicios estáticos.

---

## Scripts disponibles

- `npm run dev` → Ejecuta en desarrollo
- `npm run build` → Genera build de producción
- `npm run preview` → Previsualiza build
- `npm run lint` → Ejecuta ESLint

