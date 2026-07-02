# PLAN_DE_SEGUIMIENTO

## 1. Diagnóstico del proyecto

El proyecto actual es un prototipo funcional construido con React + TypeScript + Vite y Leaflet. Posee dos vistas principales: el diseñador de rutas y el monitoreo. El flujo actual comparte datos de ruta en memoria entre vistas y usa simulación simple para el movimiento del camión.

Sin embargo, la aplicación mezcla lógica de negocio con componentes, no está estructurada por capas ni por módulos, y carece de una arquitectura lista para API, offline y orquestación de datos.

## 2. Problemas encontrados

- Arquitectura monolítica en `App.tsx` y componentes: la lógica de rutas, estados, y simulación reside dentro de componentes.
- Falta de separación clara entre servicios, modelos, API, datos simulados y lógica de negocio.
- `MapaDiseñador` hace control de estado, persistencia y presentación en un solo lugar.
- `MapaMonitoreo` contiene simulación de posicionamiento y no está desacoplado de la vista.
- No existe manejo de rutas reales de calles: la ruta se dibuja por clic directo en el mapa.
- No hay preparación de consumo de API REST: los datos vienen directamente de memoria y constantes.
- No hay estructura de offline / cache / sincronización.
- No existe distinción entre módulos de administración (diseñador) y visualización (monitoreo) antes de renderizar.
- Tipos y modelos están parcialmente definidos, pero no se usa consistentemente.
- No hay sistema de validación de límites de Suchiapa más allá de `maxBounds` de Leaflet.
- No existe una estrategia de múltiples rutas, múltiples camiones o estados dinámicos en monitoreo.

## 3. Riesgos técnicos

- Riesgo de código difícil de mantener si se siguen añadiendo funcionalidades directamente en componentes.
- Riesgo de acoplamiento fuerte con Leaflet y el flujo de UI, lo que complica sustituir la generación de rutas por un motor de ruteo.
- Riesgo de duplicar lógica de datos si no se separa la capa de servicio/API.
- Riesgo de fallas de validación si no se restringe y normaliza el formato de coordenadas para la base de datos.
- Riesgo de comportamiento no determinista en móviles si no se adapta el layout y los controles.
- Riesgo de no cumplir con la futura API REST si no se define un contrato claro desde ahora.

## 4. Funcionalidades actuales

- Vista de diseñador de rutas con mapa Leaflet.
- Creación de puntos por clic en el mapa.
- Renderizado de `Marker` para cada punto.
- Dibujado de `Polyline` entre puntos.
- Botones para deshacer, limpiar e ir a monitoreo.
- Vista de monitoreo con mapa y simulación de avance del camión.
- Coloración de puntos recorridos y pendientes.
- Renderizado de icono de camión según estado.
- Datos falsos de camiones en `src/data/DatosFalsos.tsx`.
- Modelos básicos en `src/models/ModelosMapa.tsx`.

## 5. Funcionalidades pendientes

- Módulo de administración completo con creación, edición y eliminación de rutas.
- Agregar y modificar puntos de recolección individuales.
- Guardado local de rutas y exportación JSON compatible con la base de datos.
- Preparación de servicios para consumo de `GET /rutas`, `GET /camiones`, `GET /puntos`, `POST /rutas`, `PUT /camiones`.
- Módulo de monitoreo con detalles de ruta asignada, camión, estado, puntos recorridos, pendientes y avance.
- Gestión de múltiples rutas y múltiples camiones.
- Cálculo de porcentaje de avance y última actualización.
- Posicionamiento basado en ruta y no en simples índices de matriz.
- Encapsulado de lógica de ruteo para futura integración con OSRM/GraphHopper/Valhalla.
- Arquitectura preparada para modo offline / cache local / sincronización futura.
- Restricción estricta de zona en Suchiapa.
- UI responsiva para escritorio y móvil.

## 6. Arquitectura propuesta

### 6.1 Estructura de carpetas

- `src/components/` → componentes puros de UI.
- `src/hooks/` → hooks personalizados que exponen estado y acciones.
- `src/services/` → lógica de negocio y adaptación a API.
- `src/api/` → adaptadores de llamadas HTTP y simulación de llamadas.
- `src/models/` → tipos, interfaces y estructuras de datos.
- `src/data/` → datos simulados y fixtures.
- `src/utils/` → utilidades transversales.
- `src/constants/` → constantes de negocio como límites geográficos y mapas de estado.

### 6.2 Capas de responsabilidad

- `Presentation` → componentes React ligeros.
- `Application` → hooks coordinadores de estado y lógica mínima.
- `Domain` → modelos y reglas de negocio.
- `Infrastructure` → servicios de datos, adaptadores API, cache local.

### 6.3 Contratos / modelos

- `RutaDTO` / `PuntoDTO` con `{ latitud, longitud }`.
- `CamionDTO` con `id`, `nombre`, `estado`, `posicionActual`, `rutaId`, `velocidad`.
- `Ruta` interna con `id`, `nombre`, `coordenadas` y `puntosRecoleccion`.
- `MonitoreoRuta` o `EstadoRuta` base para vistas de seguimiento.

### 6.4 Módulos separados

- `ruta-disenador` → registra rutas, puntos, edición y export.
- `monitoreo` → visualiza rutas, camiones y estado.
- `shared` → mapas, validaciones, servicios generales.

## 7. Orden recomendado de implementación

1. Crear `PLAN_DE_SEGUIMIENTO.md` y validar diagnóstico.
2. Refactorizar la estructura de carpetas sin cambiar comportamiento.
3. Extraer modelos y tipos limpios a `src/models/` y `src/constants/`.
4. Crear capas de servicio y datos simulados (`src/services/`, `src/api/`, `src/data/`).
5. Extraer lógica de `MapaDiseñador` a un hook y servicio de rutas.
6. Extraer lógica de `MapaMonitoreo` a un hook de monitoreo y servicio de camiones.
7. Implementar DTO de coordenadas `{ latitud, longitud }` y adaptadores de exportación JSON.
8. Preparar adaptadores de API REST simulados para `GET` y `POST`.
9. Añadir restricciones de zona y validaciones geográficas en el servicio.
10. Crear renderizado de UI responsiva y controles separados.
11. Añadir soporte de múltiples rutas y selección en diseñador/monitoreo.
12. Documentar los puntos de extensión para motor de ruteo y offline.

## 8. Dependencias necesarias

### Dependencias actuales suficientes

- `react`, `react-dom`, `react-leaflet`, `leaflet`.
- `typescript`, `vite`, `eslint`.

### Recomendaciones para producción futura

- `axios` o `ky` para llamadas HTTP.
- `zustand` o `react-query` si se requiere cache/estado global.
- `localforage` / `idb-keyval` para cache offline.
- `date-fns` para manejo de fechas y última actualización.
- `@types/leaflet` ya presente.

## 9. Estimación de impacto de cada cambio

- `Refactorizar estructura de carpetas`: bajo impacto funcional, alto beneficio de mantenimiento.
- `Extraer modelos/tipos`: casi sin impacto, mejora tipado y consistencia.
- `Crear servicios/API simulada`: impacto medio, prepara la arquitectura.
- `Mover lógica fuera de componentes`: impacto medio, reduce acoplamiento.
- `Agregar DTO latitud/longitud para BD`: impacto alto en interoperabilidad con backend, necesario.
- `Preparar motor de ruteo`: impacto medio-alto en diseño, pero aislado si se encapsula.
- `Soporte offline`: impacto alto a largo plazo, mejor implementar por etapas después de desacoplar datos.
- `UI responsiva y separación de módulos`: impacto medio, mejora experiencia móvil.

## 10. Lista de tareas (Checklist)

- [x] Generar `PLAN_DE_SEGUIMIENTO.md`.
- [x] Definir estructura de carpetas y mover archivos sin cambiar lógica.
- [x] Crear tipos de dominio y DTOs para rutas, puntos, camiones.
- [x] Definir `ApiClient` simulado para `GET /rutas`, `GET /camiones`, `GET /puntos`, `POST /rutas`, `PUT /camiones`.
- [x] Crear servicio de rutas `RutaService` con validaciones de Suchiapa y exportación JSON.
- [x] Crear servicio de monitoreo `MonitoreoService` con cálculo de avance y estado.
- [x] Extraer hook `useDiseñadorRutas`.
- [x] Extraer hook `useMonitoreoRutas`.
- [x] Mantener el flujo actual de diseñador → monitoreo usando datos del servicio.
- [x] Implementar adaptador `CoordenadaDTO` compatible con base de datos.
- [x] Agregar control de zona geográfica en los clics del mapa.
- [ ] Documentar puntos de extensión para motor de ruteo.
- [x] Asegurar que `App.tsx` sólo enrute vistas y pase datos de servicios.
- [x] Validar que todas las rutas se renderizan con Leaflet y no se mezcla lógica en UI.
- [ ] Crear base para cache local / offline (servicios con interfaz de almacenamiento).
- [ ] Añadir elementos de UI para `ruta asignada`, `camión`, `estado`, `puntos recorridos`, `pendientes`, `avance`, `última actualización`.

---

### Nota
El siguiente paso será refactorizar la estructura de carpetas y extraer la lógica de presentación a servicios/hooks antes de agregar nuevas funciones.
