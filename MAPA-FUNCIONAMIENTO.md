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

La aplicación tiene dos pantallas o vistas principales:

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
- La ruta se guarda en el estado de la aplicación (`App.tsx`) y además se persiste en `localStorage` para restaurarla tras recargas.
- Solo se puede ir a la vista de monitoreo si hay al menos 2 puntos.

## Cómo funciona la vista de monitoreo

- Recibe la ruta creada en el diseñador como una lista de coordenadas.
- Centra el mapa en la zona objetivo (Suchiapa).
- Si la ruta tiene al menos 2 puntos, inicia la animación de los camiones:
  - Soporte para **múltiples camiones**: la app puede simular una flota y escoger el camión a mostrar.
  - La posición del/los camión(es) se actualiza(n) periódicamente según una configuración de velocidad/intervalo; esto es configurable vía `monitoreoService` o el estado del camión.
  - Se dibuja una línea gris con toda la ruta prevista y una línea verde con el tramo recorrido.
  - Los marcadores de puntos cambian de estado visual (por ejemplo, de gris a verde) según sean recorridos.
- El ícono del camión se selecciona a partir de los datos en `src/data/DatosFalsos.tsx` (o de la lista de camiones en estado).
- Desde la vista de monitoreo se puede pausar, reiniciar y regresar al diseñador.

## Datos, modelos y arquitectura interna

- `src/data/DatosFalsos.tsx` contiene datos de ejemplo de la flota (`listaCamiones`) usados para la selección de íconos y estados.
- `src/models/ModelosMapa.tsx` define las entidades y tipos: `Ruta`, `PuntoRecoleccion` y `Camion`. Estas clases/tipos se usan ahora en el flujo para garantizar tipado consistente.
- La lógica del diseñador y del monitoreo está separada en:
  - Hooks: `src/hooks/useRutaDiseñador.ts`, `src/hooks/useMonitoreo.ts` — encapsulan manejo de estado y efectos.
  - Servicios: `src/services/rutaService.ts`, `src/services/monitoreoService.ts` — encapsulan persistencia (local) y utilidades de animación/intervalos.

## Persistencia y comportamiento del estado

- La ruta actual se guarda en `localStorage` cuando se crea o se modifica, y se restaura al iniciar la aplicación.
- Los datos de camiones de `DatosFalsos` son ejemplo; para producción se recomienda reemplazarlos por API/servicios remotos.

## Animación y velocidad

- La animación del camión ya no está limitada a un tick fijo de 1 segundo: la velocidad es configurable y puede controlarse desde el estado del camión o desde `monitoreoService`.
- En la implementación actual el camión avanza de punto a punto; para movimientos más suaves se puede implementar interpolación entre coordenadas (próxima mejora sugerida).

## Limitaciones actuales

- La persistencia es local (`localStorage`) y no sustituye una base de datos en servidor.
- La simulación de camiones es local y no sincronizada con un backend en tiempo real.
- No hay cálculo avanzado de rutas (distancia/tiempo real) ni optimización de recorridos.

## Resumen de la funcionalidad

- `App.tsx` gestiona la vista activa, la ruta compartida y la restauración desde `localStorage`.
- `MapaDiseñador.tsx` permite dibujar y editar rutas; usa `useRutaDiseñador`.
- `MapaMonitoreo.tsx` muestra el avance de la ruta con soporte para múltiples camiones; usa `useMonitoreo`.
- `DatosFalsos.tsx` contiene ejemplos de camiones e íconos.
- `ModelosMapa.tsx` define los modelos de dominio y se usa para tipado.

## Archivos clave

- `src/App.tsx`
- `src/components/MapaDiseñador.tsx`
- `src/components/MapaMonitoreo.tsx`
- `src/hooks/useRutaDiseñador.ts`
- `src/hooks/useMonitoreo.ts`
- `src/services/rutaService.ts`
- `src/services/monitoreoService.ts`
- `src/data/DatosFalsos.tsx`
- `src/models/ModelosMapa.tsx`

## Uso

1. Ejecutar el proyecto con `npm install` y `npm run dev`.
2. En la vista de diseñador, hacer clic sobre el mapa para crear una ruta (mínimo 2 puntos).
3. Pulsar `Ir a Monitoreo` para iniciar la simulación; ajustar la velocidad si se desea.
4. Regresar al diseñador para modificar o crear otra ruta; la ruta persistirá en `localStorage`.

---

Este documento describe el comportamiento actualizado del mapa y las mejoras implementadas en la aplicación `Mapa Recolecta`.