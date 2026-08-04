# Reglas para el agente

Este documento define como debe trabajar un agente o IA de desarrollo dentro de este proyecto. Su objetivo es evitar cambios improvisados, proteger el estado actual del codigo y facilitar que cualquier persona pueda continuar el trabajo sin perder contexto.

## 1. Lectura obligatoria antes de modificar

Antes de implementar cualquier cambio, el agente debe revisar:

1. `README.md`
2. `PLAN_MAPA_COMPLETO.md`
3. Este archivo: `REGLAS_PARA_EL_AGENTE.md`
4. Los archivos directamente relacionados con la tarea solicitada

El agente no debe asumir que el README contiene todo el estado actual. Debe contrastar la documentacion con el codigo real.

## 2. Analizar primero, implementar despues

Antes de editar archivos, el agente debe:

- identificar la estructura del proyecto;
- ubicar componentes, hooks, servicios, modelos y constantes relacionados;
- entender el flujo de datos entre UI, estado local y backend;
- detectar si hay cambios previos sin confirmar;
- separar cambios propios de cambios existentes;
- revisar si la tarea afecta mapa, autenticacion, API, modelos o estilos.

Si el cambio puede afectar varias partes del sistema, el agente debe trabajar por etapas pequenas.

## 3. Mantener un plan de seguimiento

Antes de implementar cambios medianos o grandes, el agente debe organizar un plan claro.

El plan debe indicar:

- que se va a revisar;
- que se va a modificar;
- que depende del backend o de informacion externa;
- que se debe verificar al final;
- que queda pendiente.

Cuando el cambio este relacionado con rutas, puntos, mapa, backend o multiples vistas, el agente debe actualizar `PLAN_MAPA_COMPLETO.md` si el estado del proyecto cambia.

## 4. Reglas sobre OpenStreetMap y mapa

El proyecto debe trabajar sobre OpenStreetMap y Leaflet.

Reglas:

- usar `react-leaflet` para renderizar mapas;
- centralizar configuracion del mapa en `src/constants/mapa.ts`;
- usar `OSM_TILE_URL` y `OSM_ATTRIBUTION` desde constantes;
- mantener coordenadas internas como `[latitud, longitud]`;
- no guardar imagenes del mapa como rutas;
- tratar las rutas como datos geograficos;
- separar ruta en edicion, rutas guardadas y rutas visibles;
- no mezclar puntos de una ruta con otra;
- mantener preparada la arquitectura para ruteo futuro por calles usando OSRM, GraphHopper, Valhalla u OpenRouteService.

Si se requiere geocodificacion o busqueda de lugares, debe agregarse como servicio separado y no dentro de los componentes.

## 5. Reglas sobre rutas y puntos

Las rutas y puntos deben mantenerse como entidades claras.

Una ruta debe incluir, cuando aplique:

- `ruta_id`;
- `camion_id`;
- `nombre`;
- `descripcion`;
- `color`;
- `visible`;
- `puntos`.

Un punto debe incluir, cuando aplique:

- `punto_id`;
- `cp`;
- `orden`;
- `lat`;
- `lon`;
- `ruta_id` cuando se envie al backend.

El agente debe evitar depender de un solo formato de backend si todavia no esta confirmado. Para eso debe usar adaptadores en servicios como `rutasApi.ts` y `puntosRecoleccionApi.ts`.

## 6. Reglas sobre backend

No asumir contratos de backend sin confirmarlos.

Antes de depender de un endpoint, confirmar:

- ruta exacta;
- metodo HTTP;
- payload esperado;
- formato de respuesta;
- nombres reales de ids;
- si acepta `camion_id`;
- si devuelve `ruta_id`;
- si devuelve `punto_id`;
- si elimina puntos en cascada al eliminar una ruta.

Endpoints esperados o propuestos:

```txt
GET    /api/rutas/
GET    /api/rutas/:id
POST   /api/rutas/
PUT    /api/rutas/:id
DELETE /api/rutas/:id

GET    /api/puntos-recoleccion
POST   /api/puntos-recoleccion
PUT    /api/puntos-recoleccion/:id
DELETE /api/puntos-recoleccion/:id
```

Si el backend usa otros nombres, el agente debe adaptar en servicios, no contaminar componentes con formatos externos.

## 7. Reglas de implementacion

El agente debe:

- preferir patrones existentes del proyecto;
- mantener cambios acotados;
- evitar refactors no solicitados;
- crear servicios para logica de API;
- crear helpers para conversiones de datos;
- mantener componentes enfocados en interfaz;
- mantener hooks enfocados en estado y flujo;
- evitar duplicar constantes;
- no mover archivos sin necesidad;
- no borrar funcionalidad existente si no se pidio;
- no romper compatibilidad con el flujo actual si el backend no esta confirmado.

Si algo ya funciona, el agente debe extenderlo con cuidado en lugar de reemplazarlo sin razon.

## 8. Reglas de estado y capas

Para el modulo de mapa:

- una ruta en edicion debe ser independiente de las rutas visibles;
- una ruta visible no debe volverse editable automaticamente;
- `Limpiar` solo debe limpiar la ruta en edicion;
- eliminar una ruta debe afectar solo esa ruta;
- editar una ruta no debe modificar rutas de otros camiones;
- cambiar de camion no debe borrar rutas ya guardadas;
- recargar la pagina debe intentar cargar rutas desde backend si el servicio esta disponible.

## 9. Reglas de interfaz

La interfaz debe ser clara y funcional.

El agente debe cuidar:

- que los botones tengan estados `disabled` cuando corresponda;
- que los errores sean visibles;
- que los paneles no tapen informacion importante;
- que las rutas tengan colores distinguibles;
- que el selector de rutas permita ver todas o una sola;
- que los textos sean entendibles para usuarios no tecnicos.

No agregar instrucciones largas dentro de la interfaz si pueden vivir en documentacion.

## 10. Verificacion obligatoria

Despues de cambios de codigo, ejecutar:

```bash
npm run lint
npm run build
```

Si alguno falla, el agente debe corregirlo antes de entregar.

Si no se puede ejecutar una verificacion, debe decir claramente por que no pudo hacerse.

## 11. Documentacion

Actualizar documentacion cuando cambie:

- flujo de uso;
- estructura de rutas;
- contrato de API;
- variables de entorno;
- comportamiento del mapa;
- plan de seguimiento;
- reglas de trabajo.

Documentos importantes:

- `README.md`: guia general del proyecto;
- `PLAN_MAPA_COMPLETO.md`: documento unico de estado, decisiones, fases y pendientes del mapa;
- `REGLAS_PARA_EL_AGENTE.md`: reglas para futuros agentes.

## 12. Manejo de cambios existentes

El agente debe revisar si hay archivos modificados antes de empezar.

Reglas:

- no revertir cambios ajenos;
- no sobrescribir cambios que no entiende;
- si un archivo ya esta modificado, leerlo antes de editarlo;
- si un cambio ajeno afecta la tarea, trabajar con ese cambio;
- si hay conflicto real, avisar antes de continuar.

## 13. Seguridad del proyecto

Este proyecto no es necesariamente propiedad de quien lo modifica. Por eso:

- no hacer cambios destructivos;
- no eliminar archivos sin necesidad;
- no usar comandos de reset;
- no cambiar contratos de API sin razon;
- no introducir dependencias nuevas sin justificar;
- no exponer tokens ni datos sensibles;
- no subir `.env` locales;
- cuidar especialmente autenticacion, rutas y llamadas al backend.

## 14. Cierre de trabajo

Al terminar, el agente debe entregar un resumen breve con:

- archivos principales modificados;
- que se implemento;
- que se verifico;
- que queda pendiente;
- cualquier riesgo o supuesto importante.

Si el cambio depende del backend, debe indicar exactamente que falta confirmar.
