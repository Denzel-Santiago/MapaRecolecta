# Plan de adaptacion al plan del administrador

## 1. Objetivo

Adaptar el modulo de mapa al plan proporcionado por el administrador del proyecto sin descartar la logica ya implementada.

El plan del administrador se considera obligatorio para la siguiente etapa, especialmente en:

- modo borrador;
- IDs temporales;
- ordenamiento flotante;
- sincronizacion por lotes con `POST /api/puntos-recoleccion/sync`;
- separacion entre puntos de recoleccion y `json_ruta`;
- geometria oficial de ruta calculada por calles;
- publicacion de rutas para consumo de la app movil.

La logica actual no se elimina. Se usara como base para avanzar de forma controlada.

## 2. Estado actual que debe conservarse

El proyecto ya cuenta con una base funcional que no debe romperse:

- Mapa con OpenStreetMap y Leaflet.
- Configuracion centralizada en `src/constants/mapa.ts`.
- Servicio geografico `src/services/mapaGeoService.ts`.
- Creacion de puntos por clic.
- Edicion de puntos por arrastre.
- Validacion de limites de Suchiapa.
- Rutas con `ruta_id`, `camion_id`, `color`, `visible` y `puntos`.
- Selector para ver todas las rutas o una ruta especifica.
- Renderizado de multiples rutas como capas.
- Servicios base para `api/rutas`.
- Servicio inicial para `api/puntos-recoleccion`.
- Separacion entre rutas visibles, rutas guardadas y ruta en edicion.

Estos elementos deben evolucionar, no ser reemplazados sin necesidad.

## 3. Cambio principal de arquitectura

Actualmente la linea del mapa se dibuja usando los puntos colocados por el usuario.

El plan del administrador requiere separar:

| Elemento | Uso |
|---|---|
| Puntos de recoleccion | Marcadores creados por el administrador. |
| Orden de visita | Secuencia definida por `orden`. |
| Geometria previa | Ruta calculada por calles mientras se edita. |
| Geometria oficial | Ruta final validada y guardada en `json_ruta`. |
| Estado de publicacion | Controla si la app movil puede consumir la ruta. |

Regla nueva:

```txt
Markers = puntos de recoleccion
Polyline = geometria calculada por motor vial
```

Mientras no exista motor vial, se puede mantener una geometria provisional basada en puntos, pero debe quedar marcada como provisional y no como geometria oficial publicada.

## 4. Principio de compatibilidad

La adaptacion debe hacerse en capas:

1. No romper el guardado actual de rutas mientras se confirma backend.
2. Agregar modelos nuevos sin eliminar inmediatamente los antiguos.
3. Crear adaptadores entre modelo actual y modelo borrador.
4. Agregar `sync` como ruta nueva de persistencia.
5. Activar el flujo nuevo solo cuando el backend confirme contrato.
6. Mantener fallback controlado para el flujo actual durante la transicion.

## 5. Modelo objetivo

### 5.1 Punto de ruta actual

El modelo actual `PuntoRuta` puede seguir existiendo como modelo persistido o de compatibilidad.

Debe mapearse hacia un modelo de borrador cuando se entre en edicion.

### 5.2 Punto borrador

Modelo recomendado:

```ts
export type EstadoPuntoBorrador =
  | "sin_cambios"
  | "nuevo"
  | "movido"
  | "reordenado"
  | "eliminado";

export interface PuntoBorrador {
  punto_id: number | string;
  ruta_id: number;
  cp: string;
  lat: number;
  lon: number;
  orden: number;
  latOriginal?: number;
  lonOriginal?: number;
  ordenOriginal?: number;
  estado: EstadoPuntoBorrador;
}
```

### 5.3 Ruta borrador

```ts
export type EstadoRutaBorrador = "editando" | "calculando" | "valida" | "error";

export interface RutaBorrador {
  ruta_id: number;
  puntos: PuntoBorrador[];
  puntosEliminados: number[];
  geometriaPrevia: [number, number][];
  distanciaMetros: number;
  duracionSegundos: number;
  estado: EstadoRutaBorrador;
  errores: string[];
}
```

### 5.4 Estado de publicacion de ruta

```ts
export type EstadoPublicacionRuta =
  | "BORRADOR"
  | "VALIDANDO"
  | "VALIDA"
  | "ERROR"
  | "PUBLICADA";
```

La app movil solo debe consumir rutas en estado `PUBLICADA`.

## 6. Servicios nuevos o ajustados

### 6.1 `puntosRecoleccionApi.ts`

Debe agregarse el metodo oficial del plan del administrador:

```ts
syncPuntosRecoleccion(payload)
```

Endpoint:

```txt
POST /api/puntos-recoleccion/sync
```

Payload:

```ts
interface SyncPuntosRecoleccionRequest {
  ruta_id: number;
  puntos_nuevos: Array<{
    direccion: string;
    lat: number;
    lon: number;
    orden: number;
  }>;
  puntos_actualizados: Array<{
    punto_id: number;
    orden: number;
  }>;
  puntos_eliminados: number[];
}
```

El CRUD individual actual puede mantenerse como utilidad o fallback, pero el flujo principal de guardado de puntos debe migrar a `sync`.

### 6.2 Servicio de borrador

Crear:

```txt
src/services/rutaBorradorService.ts
```

Responsabilidades:

- convertir `RutaDiseñada` a `RutaBorrador`;
- generar IDs temporales;
- calcular orden flotante;
- detectar puntos nuevos, movidos, reordenados y eliminados;
- construir payload para `sync`;
- normalizar orden cuando sea necesario.

### 6.3 Servicio de geometria vial

Crear:

```txt
src/services/rutaVialService.ts
```

Responsabilidades:

- solicitar calculo de ruta por calles al backend o motor vial;
- recibir geometria completa;
- recibir distancia y duracion;
- manejar errores de calculo;
- permitir modo provisional si el motor vial aun no existe.

Este servicio no debe vivir dentro de componentes React.

### 6.4 Servicio de publicacion

Crear o ampliar:

```txt
src/services/rutasApi.ts
```

Para soportar:

```txt
PATCH /api/rutas/:id/json-ruta
PATCH /api/rutas/:id/estado
```

O los endpoints equivalentes que defina backend.

No asumir nombres finales hasta confirmarlos.

## 7. Flujo adaptado de edicion

### 7.1 Entrar a editar ruta

1. Usuario selecciona una ruta.
2. Frontend carga ruta y puntos persistidos.
3. Convierte los puntos a `RutaBorrador`.
4. Marca todos los puntos como `sin_cambios`.
5. Calcula o solicita `geometriaPrevia`.
6. Muestra marcadores editables y polyline vial.

### 7.2 Agregar punto

1. Usuario da clic en el mapa.
2. Se valida que este dentro de Suchiapa.
3. Se crea `punto_id` temporal tipo `temp_xxx`.
4. Se calcula `orden` flotante.
5. Se marca como `nuevo`.
6. Se recalcula `geometriaPrevia`.
7. Se validan reglas minimas.

### 7.3 Mover punto

Regla del administrador:

Un punto real movido debe convertirse en:

```txt
punto eliminado + punto nuevo
```

Flujo:

1. Si el punto es temporal, solo se actualiza su lat/lon.
2. Si el punto tiene ID real, se agrega a `puntosEliminados`.
3. Se crea un nuevo punto temporal con la nueva ubicacion.
4. Se conserva el orden.
5. Se recalcula `geometriaPrevia`.

Advertencia:

Esta regla cambia el `punto_id`. Si en el futuro hay historial operativo vinculado al punto, backend debera permitir actualizar coordenadas conservando identidad.

### 7.4 Reordenar punto

1. Usuario cambia posicion del punto en la lista.
2. Se recalcula `orden` flotante.
3. Si el punto tiene ID real, se marca `reordenado`.
4. Si el punto es temporal, sigue como `nuevo`.
5. Se recalcula geometria vial.

### 7.5 Eliminar punto

1. Si el punto tiene ID real, se agrega a `puntosEliminados`.
2. Si es temporal, solo se elimina del borrador.
3. Se recalcula geometria.
4. Se validan minimos.

## 8. Flujo adaptado de guardado

El boton debe llamarse preferentemente:

```txt
Guardar recorrido
```

Flujo:

1. Validar ruta en borrador.
2. Construir payload de `sync`.
3. Ejecutar `POST /api/puntos-recoleccion/sync`.
4. Recargar datos frescos desde backend.
5. Verificar que puntos nuevos tengan ID real.
6. Verificar que puntos eliminados ya no aparezcan.
7. Recalcular geometria definitiva con puntos recargados.
8. Guardar geometria oficial en `json_ruta`.
9. Mantener ruta en `BORRADOR`, `VALIDA` o `ERROR` segun resultado.
10. No publicar automaticamente si falla la geometria.

## 9. Flujo adaptado de publicacion

La publicacion debe ser un paso separado de guardar puntos.

1. Ruta debe tener puntos persistidos.
2. Ruta debe tener geometria oficial valida.
3. Ruta no debe tener errores de validacion.
4. Usuario presiona `Publicar ruta`.
5. Frontend solicita cambio de estado a `PUBLICADA`.
6. App movil consume solo rutas `PUBLICADA`.

## 10. Validaciones necesarias

### 10.1 Validaciones actuales que se conservan

- Punto dentro de limites de Suchiapa.
- Minimo de puntos.
- Coordenadas reales.
- Rutas separadas por camion.

### 10.2 Validaciones nuevas

- IDs temporales solo en frontend.
- No enviar puntos temporales como eliminados.
- No permitir orden ambiguo.
- No publicar sin geometria oficial.
- No publicar si falla `sync`.
- No publicar si falla guardado de `json_ruta`.
- No aceptar puntos duplicados.
- Validar movimiento excesivo.
- Validar distancia maxima a calle.
- Validar distancia maxima entre puntos consecutivos.
- Validar factor de desvio.

### 10.3 Validaciones que dependen del motor vial

Estas deben implementarse cuando exista motor vial o endpoint backend:

- cercania real a calle;
- distancia vial entre puntos;
- duracion estimada;
- respeto de sentidos viales;
- factor de desvio;
- conectividad vial.

## 11. Fases de implementacion

### Fase 0 - Confirmacion del contrato

Confirmar con backend:

- si existe `POST /api/puntos-recoleccion/sync`;
- payload exacto del `sync`;
- respuesta exacta del `sync`;
- como se recargan todos los puntos despues del `sync`;
- si existe endpoint para calcular ruta vial;
- si existe endpoint para guardar `json_ruta`;
- si existe estado de ruta;
- si la app movil ya consume `json_ruta`;
- si `json_ruta` puede cambiar de lista de puntos a geometria oficial.

### Fase 1 - Modelos de borrador

- Crear `rutaBorrador.ts`.
- Crear `PuntoBorrador`.
- Crear `RutaBorrador`.
- Crear estados de punto y ruta.
- Crear adaptadores desde `RutaDiseñada`.

### Fase 2 - Servicio de borrador

- Crear `rutaBorradorService.ts`.
- Generar IDs temporales.
- Calcular orden flotante.
- Detectar cambios.
- Construir payload de `sync`.
- Normalizar orden si hay demasiadas inserciones.

### Fase 3 - Integrar borrador en UI sin romper flujo actual

- Adaptar `useRutaDiseñador` o crear `useRutaBorrador`.
- Mantener el flujo actual como fallback.
- Mostrar puntos del borrador.
- Permitir agregar, mover, eliminar y reordenar.
- Mantener rutas visibles separadas.

### Fase 4 - Agregar `sync`

- Implementar `syncPuntosRecoleccion`.
- Usarlo al guardar puntos cuando backend este confirmado.
- Recargar rutas/puntos despues del sync.
- Mantener fallback actual si `sync` no esta disponible durante transicion.

### Fase 5 - Geometria vial

- Crear `rutaVialService.ts`.
- Definir respuesta esperada: geometria, distancia, duracion, errores.
- Dibujar `geometriaPrevia` como polyline.
- Dejar de tratar puntos como geometria oficial.
- Mantener polyline provisional solo mientras no exista motor vial.

### Fase 6 - Guardar `json_ruta` oficial

- Confirmar endpoint.
- Guardar geometria oficial despues del sync.
- Si falla, mantener ruta en `ERROR` o `BORRADOR`.
- No publicar geometria vieja.

### Fase 7 - Publicacion

- Agregar estado de ruta.
- Agregar accion `Publicar ruta`.
- Bloquear publicacion si no hay geometria oficial.
- Preparar contrato para app movil.

### Fase 8 - Limpieza y documentacion

- Actualizar `README.md`.
- Actualizar `MAPA-FUNCIONAMIENTO.md`.
- Actualizar `PLAN_DE_SEGUIMIENTO.md`.
- Actualizar `REGLAS_PARA_EL_AGENTE.md` si cambian reglas.
- Eliminar fallback viejo solo cuando backend y app movil ya usen el flujo nuevo.

## 12. Riesgos y decisiones pendientes

### 12.1 `json_ruta`

Riesgo:

Actualmente puede representar puntos dibujados. El plan del administrador requiere que represente geometria oficial.

Decision pendiente:

Confirmar si backend y app movil aceptan que `json_ruta` cambie a GeoJSON o formato equivalente.

### 12.2 Punto movido

Riesgo:

Mover un punto real como eliminado + nuevo cambia su `punto_id`.

Decision pendiente:

Confirmar si existen datos historicos asociados al punto.

### 12.3 Motor vial

Riesgo:

Sin motor vial, no se puede garantizar que la polyline siga calles ni sentidos viales.

Decision pendiente:

Confirmar si el calculo lo hara backend o frontend provisionalmente.

### 12.4 Publicacion

Riesgo:

Si la app movil consume rutas sin estado, podria recibir borradores incompletos.

Decision pendiente:

Confirmar si backend tendra estados `BORRADOR`, `VALIDANDO`, `VALIDA`, `ERROR`, `PUBLICADA`.

## 13. Criterios de aceptacion

La adaptacion se considera correcta cuando:

- el flujo actual no queda roto durante la transicion;
- existe modo borrador para editar puntos;
- los puntos nuevos usan IDs temporales;
- los puntos reales movidos se convierten en eliminado + nuevo;
- el guardado principal usa `POST /api/puntos-recoleccion/sync`;
- despues del sync se recargan datos frescos;
- la polyline visible usa geometria vial cuando exista motor;
- `json_ruta` guarda geometria oficial, no puntos sueltos;
- una ruta solo puede publicarse si esta validada;
- la app movil consume rutas publicadas con geometria oficial;
- `npm run lint` y `npm run build` pasan despues de implementar cambios de codigo.

## 14. Resumen ejecutivo

El plan del administrador debe integrarse como la ruta principal de evolucion del mapa.

La logica actual se conserva como base:

- OpenStreetMap;
- capas;
- rutas por camion;
- puntos editables;
- servicios API;
- validaciones basicas.

La nueva adaptacion agrega:

- borradores;
- cambios por lote;
- orden flotante;
- geometria vial;
- `json_ruta` oficial;
- estados de publicacion;
- contrato confiable para app movil.

La regla mas importante es no mezclar responsabilidades:

```txt
puntos-recoleccion = puntos y orden
json_ruta = geometria oficial por calles
estado = control de publicacion
```
