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

- Para producción, externalizar configuración en `.env` y no subir variables sensibles.
- Añadir autenticación y un backend para persistencia en servidor.
- Usar HTTPS en despliegues y considerar despliegues en contenedores o servicios estáticos.

---

## Scripts disponibles

- `npm run dev` → Ejecuta en desarrollo
- `npm run build` → Genera build de producción
- `npm run preview` → Previsualiza build
- `npm run lint` → Ejecuta ESLint

