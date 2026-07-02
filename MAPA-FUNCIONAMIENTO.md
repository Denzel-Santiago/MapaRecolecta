# Funcionamiento del Mapa - Mapa Recolecta

## Descripción general

Esta aplicación muestra un mapa interactivo para diseñar y monitorear rutas de recolección en Suchiapa, Chiapas.

El proyecto está construido con:
- React
- TypeScript
- Vite
- Leaflet + React Leaflet
- OpenStreetMap para los tiles del mapa

## Vistas principales

La aplicación tiene dos pantallas o vistas:

1. **Diseñador de rutas** (`src/components/MapaDiseñador.tsx`)
2. **Monitoreo de ruta** (`src/components/MapaMonitoreo.tsx`)

La navegación entre ambas se controla desde `src/App.tsx`.

## Cómo funciona el diseñador de rutas

- El mapa se muestra centrado en Suchiapa con coordenadas aproximadas `[16.6166, -93.1]`.
- El usuario puede hacer clic sobre el mapa para agregar puntos de ruta.
- Cada clic crea un marcador y los puntos se conectan con una `Polyline`.
- El usuario puede:
  - `Deshacer`: eliminar el último punto agregado.
  - `Limpiar`: borrar toda la ruta.
  - `Ir a Monitoreo`: guardar la ruta actual y pasar a la vista de monitoreo.
- La ruta se guarda en el estado de la aplicación (`App.tsx`) como `rutaActual`.
- Solo se puede ir a la vista de monitoreo si hay al menos 2 puntos.

## Cómo funciona la vista de monitoreo

- Recibe la ruta creada en el diseñador como una lista de coordenadas.
- Centra el mapa en Suchiapa de nuevo.
- Si la ruta tiene al menos 2 puntos, inicia una animación automática:
  - Cada segundo avanza el "camión" al siguiente punto de la ruta.
  - El camión se desplaza actualizando su posición en el estado.
- Se dibuja:
  - Una línea gris con toda la ruta prevista.
  - Una línea verde con el tramo ya recorrido.
  - Marcadores circulares que cambian de gris a verde según estén recorridos.
- El marcador del camión utiliza un ícono de camión basado en el estado del primer camión definido en `src/data/DatosFalsos.tsx`.
- Desde aquí también se puede regresar al diseñador.

## Datos y modelos actuales

- `src/data/DatosFalsos.tsx` contiene una lista de camiones simulada (`listaCamiones`).
- Los camiones tienen campos como `id`, `nombre`, `estado`, `posicionActual` y `velocidad`.
- El componente de monitoreo solo usa el estado del primer camión para seleccionar el ícono.
- `src/models/ModelosMapa.tsx` define clases de dominio: `Ruta`, `PuntoRecoleccion` y `Camion`, pero actualmente no se usan en la lógica del mapa.

## Limitaciones y estado actual

- La ruta no se guarda en una base de datos ni se persiste entre recargas.
- No hay integración con backend ni API de mapas externos más allá de OpenStreetMap.
- El movimiento del camión es simulado con un intervalo de 1 segundo y avanza por los puntos de la ruta.
- No hay control de velocidad real ni cálculos de distancia/timings.
- El componente de datos de camiones es estático y se usa solo parcialmente para el ícono.

## Resumen de la funcionalidad actual

- `App.tsx` gestiona la vista activa y la ruta compartida.
- `MapaDiseñador.tsx` permite dibujar rutas con clics y pasar esa ruta a monitoreo.
- `MapaMonitoreo.tsx` muestra el progreso de la ruta y anima un camión sobre ella.
- `DatosFalsos.tsx` provee ejemplos de camiones y estados.
- `ModelosMapa.tsx` declara modelos, pero no forma parte del flujo activo actual.

## Archivos clave

- `src/App.tsx`
- `src/components/MapaDiseñador.tsx`
- `src/components/MapaMonitoreo.tsx`
- `src/data/DatosFalsos.tsx`
- `src/models/ModelosMapa.tsx`

## Uso actual

1. Ejecutar el proyecto con `npm install` y `npm run dev`.
2. En la vista de diseñador, hacer clic sobre el mapa para crear una ruta.
3. Pulsar `Ir a Monitoreo` para ver el avance simulado del camión.
4. Regresar al diseñador para modificar o crear otra ruta.

---

Este documento describe el comportamiento actual del mapa y su funcionamiento dentro de la aplicación `Mapa Recolecta`.