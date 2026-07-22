# PLAN_MAPA_COMPLETO

Este documento reune en un solo lugar todo el contexto del modulo de mapa de Recolecta: como funciona hoy, que le falta, que pide el administrador y como sera el nuevo flujo de captura de puntos por detector. A partir de ahora este es el documento de referencia unico para planear trabajo sobre el mapa; no se van a crear mas archivos de plan sueltos. `MAPA-FUNCIONAMIENTO.md`, `PLAN_DE_SEGUIMIENTO.md`, `PLAN_ADAPTACION_ADMIN.md` y `PLAN_FLUJO_DETECTOR.md` siguen existiendo como material de referencia detallado, pero para saber "que falta hacer en el mapa" basta con leer este archivo.

`REGLAS_PARA_EL_AGENTE.md` sigue aplicando igual: analizar antes de programar, no romper lo que ya funciona, no asumir contratos de backend sin confirmarlos, y correr `npm run lint` y `npm run build` despues de cualquier cambio de codigo.

---

## 1. Que es Mapa-Rec

Mapa-Rec es el frontend del modulo de mapa de Recolecta. Deja iniciar sesion, revisa el rol del usuario, permite disenar rutas de recoleccion sobre un mapa de Suchiapa, guarda esas rutas en el backend y simula el avance de un camion sobre una ruta ya definida.

Esta construido con React 19, TypeScript, Vite, Leaflet y react-leaflet, usando OpenStreetMap como proveedor de mapas. El frontend habla con el backend por rutas relativas `/api/...`; en desarrollo, Vite reenvia esas peticiones al backend real mediante un proxy configurado en `vite.config.ts`.

El punto de entrada es `src/App.tsx`: intenta recuperar sesion desde `localStorage`, muestra `LoginPage` si no hay token valido, y muestra `MapaPage` si lo hay. `MapaPage` permite cambiar entre dos vistas: el **Disenador de rutas** y el **Monitoreo**.

---

## 2. Como se disenan rutas hoy

El disenador vive en `src/components/MapaDiseñador.tsx`, `MapaDiseñadorView.tsx` y el hook `useRutaDiseñador.ts`. El flujo actual es:

1. El usuario elige un camion en `SeleccionCamionModal` (hoy las opciones son fijas: Camion 1, 2 y 3).
2. Cada clic en el mapa agrega una coordenada real `[latitud, longitud]` al arreglo temporal `puntos`, validando que caiga dentro de los limites de Suchiapa (`estaDentroDeSuchiapa` en `mapaGeoService.ts`).
3. `MapaDiseñadorView` dibuja un `Marker` por punto y una `Polyline` recta conectandolos, ademas de las demas rutas guardadas visibles como capas independientes con su propio color.
4. El usuario puede deshacer el ultimo punto, limpiar la ruta en edicion, o finalizar y llenar un formulario con nombre y descripcion.
5. Al guardar, `rutaService.ts` convierte las coordenadas a `PuntoRuta[]` y arma una `RutaDiseñada`; `rutasApi.ts` la manda a `POST /api/rutas/` (o `PUT /api/rutas/:id` si ya existia) dentro del campo `json_ruta`.

Los modelos actuales, en `src/models/rutaDiseñada.ts`:

```ts
export type Coordenada = [number, number]; // [latitud, longitud]

export interface PuntoRuta {
  punto_id?: number | null;
  cp?: number;
  orden: number;
  lat: number;
  lng?: number;
  lon?: number;
}

export interface RutaDiseñada {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  camion_id: number;
  color?: string;
  visible?: boolean;
  puntos: PuntoRuta[];
}
```

El estado de todas las rutas disenadas vive en el hook `useRutasDiseñadas.ts`, que ya carga rutas desde backend al iniciar (`GET /api/rutas/`), permite ver todas las rutas o solo una, y elimina rutas contra backend (`DELETE /api/rutas/:id`).

---

## 3. Como funciona el Monitoreo hoy

`MapaMonitoreo.tsx`, `MapaMonitoreoView.tsx` y `useMonitoreo.ts` simulan el avance de un camion sobre una ruta ya guardada: toman la lista de coordenadas de la ruta, avanzan un indice cada segundo, y calculan el porcentaje recorrido y el tramo ya hecho (en verde) contra el tramo pendiente (en gris). No consume ubicacion real ni telemetria; es una simulacion local por indice, sin interpolacion entre puntos.

---

## 4. Limitaciones actuales (lo que falta en el flujo de hoy)

- No existe todavia un servicio separado para `api/puntos-recoleccion`; los puntos se mandan todos juntos dentro de `json_ruta` al crear la ruta, no se pueden editar o eliminar de forma individual contra backend.
- La edicion de una ruta existente no confirma un `PUT`/`PATCH` real de cada punto por separado.
- Los camiones disponibles en el selector estan fijos (1, 2, 3), no vienen de backend.
- El monitoreo es una simulacion local, no sigue la posicion real de un camion.
- La ruta pintada en el mapa es siempre una linea recta entre los puntos que el usuario marco; no sigue calles reales todavia.

---

## 5. Lo que pide el administrador (plan obligatorio, ya documentado en `PLAN_ADAPTACION_ADMIN.md`)

El administrador del proyecto definio una evolucion obligatoria para la siguiente etapa del mapa. La idea central es separar responsabilidades que hoy estan mezcladas:

```
puntos-recoleccion = puntos y su orden de visita
json_ruta          = geometria oficial calculada por calles
estado             = control de publicacion para la app movil
```

Hoy, un `Marker` es un punto de recoleccion y la `Polyline` que lo conecta con el siguiente es, en realidad, la misma lista de puntos dibujada como linea recta. El plan del administrador pide que esas dos cosas dejen de ser la misma cosa: los `Markers` siguen siendo los puntos de recoleccion, pero la geometria de la ruta (la linea que efectivamente sigue el camion) debe salir de un motor de ruteo por calles (OSRM, GraphHopper, Valhalla u OpenRouteService), no de conectar puntos con lineas rectas.

### 5.1 Modo borrador

Mientras se edita una ruta, los puntos no se guardan de inmediato contra backend uno por uno. Se trabaja sobre una copia en memoria (`RutaBorrador`) donde cada punto tiene un estado:

```ts
export type EstadoPuntoBorrador = "sin_cambios" | "nuevo" | "movido" | "reordenado" | "eliminado";

export interface PuntoBorrador {
  punto_id: number | string; // real o temporal ("temp_xxx")
  ruta_id: number;
  cp: number;
  lat: number;
  lon: number;
  orden: number;
  estado: EstadoPuntoBorrador;
}
```

**[HECHO]** Implementado en `src/models/rutaBorrador.ts` con `esIdTemporal`/`generarIdTemporal` como helpers. Nota de correccion: aqui arriba `cp` se corrigio a `number` (no `string` como se habia escrito primero en este borrador de plan), para que coincida con `PuntoRuta.cp` y `PuntoRecoleccionRequest.cp`, que ya son `number` en el resto del proyecto (`rutaDiseñada.ts`, `puntosRecoleccionApi.ts`).

Reglas del borrador:

- Un punto nuevo se crea con un id temporal (`temp_xxx`) hasta que el backend le asigna uno real.
- Mover un punto que ya tiene id real se trata como "eliminar el punto viejo + crear uno nuevo" (no se reutiliza el id), porque backend no tiene forma de actualizar coordenadas conservando identidad.
- Reordenar un punto usa orden flotante (numeros entre los vecinos, sin renumerar toda la lista), el mismo mecanismo que se retoma en la seccion 6 de este documento para el flujo detector.

### 5.2 Guardado por lotes (`sync`)

En vez de mandar cada punto por separado, el guardado principal debe usar:

```txt
POST /api/puntos-recoleccion/sync
```

con un payload que distingue puntos nuevos, actualizados y eliminados en una sola llamada. Despues del `sync`, el frontend debe recargar los datos frescos desde backend (con los ids reales ya asignados) antes de seguir.

### 5.3 Geometria oficial y publicacion

Una vez que los puntos estan guardados, se calcula la geometria oficial (la ruta real por calles) y se guarda aparte, no como los puntos sueltos. La ruta pasa por estados:

```ts
export type EstadoPublicacionRuta = "BORRADOR" | "VALIDANDO" | "VALIDA" | "ERROR" | "PUBLICADA";
```

**[HECHO]** Tipo ya definido en `src/models/rutaBorrador.ts` y usado como campo `estadoPublicacion` de `RutaBorrador`. Las transiciones reales (`VALIDANDO`/`VALIDA`/`ERROR`/publicar) todavia no existen, eso es Fase 10.

Solo una ruta en estado `PUBLICADA` deberia ser visible para la app movil del conductor. Publicar es una accion separada de guardar los puntos.

### 5.4 Que falta confirmar con backend antes de activar esto

- Si existe realmente `POST /api/puntos-recoleccion/sync` y cual es su payload y respuesta exactos.
- Si existe un endpoint para calcular la geometria por calles, o si eso lo hace el frontend con un servicio externo.
- Si `json_ruta` puede pasar de ser una lista de puntos a una geometria tipo GeoJSON sin romper lo que ya consume la app movil.
- Si el backend maneja estados de publicacion de ruta.

---

## 6. El nuevo flujo de captura por "detector"

Esto es un modo nuevo dentro del Disenador (no un modulo aparte, no depende de GPS ni de hardware externo): un boton "Detectar punto" que, cada vez que se presiona, corre un pipeline completo en vez de simplemente agregar el punto al final de la lista.

### 6.1 Bloques del flujo

```
Inicio -> Esperar detector -> Guardar el punto para recalcular (KNN + peso) -> Wipe -> Write points -> Connect points
```

| Bloque | Que hace en este proyecto |
|---|---|
| Inicio | Se activa el modo detector para el camion seleccionado, partiendo de la lista enlazada de la ruta en edicion. |
| Esperar detector | La UI espera a que el operador presione "Detectar punto"; no se agrega nada solo por mover el mouse o hacer clic normal. |
| Guardar el punto para recalcular | Se compara el punto candidato contra los puntos ya guardados usando distancia real (formula Haversine, ya existe como `calcularDistanciaMetros`), se busca el vecino mas cercano (K-Nearest-Neighbours con k=1) y se calcula el `peso` del punto nuevo (ver 6.3). |
| Wipe | Se limpia el arreglo que alimenta al `Marker`/`Polyline` antes de reescribirlo. En React esto no requiere tocar Leaflet a mano, basta con reemplazar el estado. |
| Write points | Se reconstruye el arreglo de marcadores a partir de la lista enlazada ya actualizada. |
| Connect points | Se dibuja la conexion entre puntos recorriendo la lista enlazada en su orden real (ver 6.4 sobre por que no se usa el `peso` para ordenar). |

Los puntos se guardan en una lista enlazada (no en un arreglo plano) mientras se esta en modo detector, y al finalizar se arma el JSON de la ruta reutilizando el mismo mecanismo que ya existe hoy en `rutasApi.ts` (`construirRutaBackend`, `guardarRuta`, `actualizarRuta`).

### 6.2 La lista enlazada

```ts
export interface PuntoConPeso extends PuntoRuta {
  peso: number;
}

export interface NodoPunto {
  punto: PuntoConPeso;
  anterior: NodoPunto | null;
  siguiente: NodoPunto | null;
}

export class ListaRuta {
  cabeza: NodoPunto | null = null;
  cola: NodoPunto | null = null;

  insertarAlFinal(punto: PuntoConPeso): NodoPunto { /* ... */ }
  insertarDespuesDe(nodo: NodoPunto, punto: PuntoConPeso): NodoPunto { /* ... */ }
  aArrayEnOrden(): PuntoConPeso[] { /* recorre de cabeza a cola, NO ordena por peso */ }
  static desdeArray(puntos: PuntoConPeso[]): ListaRuta { /* ... */ }
}
```

### 6.3 La regla del `peso`

`peso` es el campo que decide la posicion de un punto dentro de la ruta, ademas de guiar como se inserta un punto nuevo sin tener que renumerar toda la lista (el mismo problema que resuelve el "orden flotante" del plan del administrador, seccion 5.1 de este documento). Reglas de calculo:

- Peso base del primer punto de una ruta nueva, sin nada que promediar: `10`.
- Si el punto candidato cae entre dos puntos que ya estan conectados entre si en la lista, su `peso` es el promedio de los pesos de esos dos vecinos.
- Si el punto candidato extiende la ruta despues del ultimo punto guardado (el caso mas comun, ir agregando puntos mientras el camion avanza), su `peso` es `peso de la cola + 10` (10, 20, 30...).
- Si el punto candidato extiende la ruta antes del primer punto guardado, su `peso` es el promedio entre un "inicio virtual" de `0` y el peso actual de la cabeza (por ejemplo, si la cabeza pesa 10, el nuevo punto queda en 5).
- Si no hay ningun vecino a menos de un umbral de distancia (`UMBRAL_VECINO_METROS`, propuesto en 40 metros, pendiente de confirmar), el punto se guarda con `peso = 0` y queda marcado como "pendiente de conectar" hasta que otra deteccion lo enlace.
- Si se inserta muchas veces entre los mismos dos puntos, los promedios pueden perder separacion por precision de punto flotante; en ese caso se debe recorrer la lista y renumerar todo en multiplos limpios de 10.

La logica de insercion primero busca el vecino mas cercano por distancia real (KNN), y despues revisa los vecinos **estructurales** de ese nodo dentro de la lista (su `anterior` y `siguiente`) para decidir si el punto candidato cae entre dos nodos ya conectados o si extiende un extremo de la ruta.

### 6.4 Por que el orden final no sale de ordenar por `peso`

Aunque `peso` es la clave de posicion, no es seguro reconstruir el orden final con `Array.sort` sobre ese campo: pueden darse empates (por ejemplo, todos los puntos con `peso = 0` estan empatados entre si por definicion, ya que estan "sin conectar"). El orden real y confiable siempre viene de la estructura de la lista enlazada: cada insercion deja el nodo fisicamente en su lugar correcto, sin importar el valor numerico del peso.

Por eso, tanto para dibujar la `Polyline` (paso "connect points") como para armar el JSON final que se manda a backend, se debe recorrer la lista de `cabeza` a `cola` y asignar ahi mismo un `orden`/`cp` secuencial limpio (1, 2, 3...). El campo `peso` es una herramienta interna del calculo de insercion; no hace falta mandarlo a backend salvo que se confirme que el contrato lo va a aceptar.

Sigue pendiente decidir que hacer con los puntos `peso = 0` al momento de guardar: la opcion recomendada es mostrarlos como marcadores sueltos (sin `Polyline`) y no incluirlos en el JSON final hasta que otra deteccion los conecte a la cadena.

### 6.5 Curvas automaticas

Hoy "connect points" siempre dibuja lineas rectas. Suchiapa tiene calles en angulo recto casi todo el tiempo, pero tambien hay calles curvas, y la idea es que el sistema decida solo, sin intervencion manual, cuando dibujar una curva.

La lista enlazada sigue guardando solo puntos de control (los puntos reales detectados); lo que cambia es unicamente la forma de dibujar entre puntos consecutivos, no el modelo de datos.

Para decidir si un tramo es curva, se calcula el angulo de giro entre tres puntos consecutivos (`p1`, `p2`, `p3`), usando el angulo entre los vectores `p1->p2` y `p2->p3`:

```ts
export function calcularAnguloGiro(p1: Coordenada, p2: Coordenada, p3: Coordenada): number {
  const v1 = [p2[0] - p1[0], p2[1] - p1[1]];
  const v2 = [p3[0] - p2[0], p3[1] - p2[1]];
  const producto = v1[0] * v2[0] + v1[1] * v2[1];
  const magnitud1 = Math.hypot(v1[0], v1[1]);
  const magnitud2 = Math.hypot(v2[0], v2[1]);
  if (magnitud1 === 0 || magnitud2 === 0) return 0;
  const coseno = Math.min(1, Math.max(-1, producto / (magnitud1 * magnitud2)));
  return Math.acos(coseno) * (180 / Math.PI); // grados
}
```

Si el giro esta cerca de 0 grados (misma direccion, linea recta) o cerca de 90 grados (esquina real), se deja la conexion recta. Si el cambio de direccion es progresivo (entre 15 y 75 grados, `UMBRAL_CURVA_MIN_GRADOS`/`UMBRAL_CURVA_MAX_GRADOS`), se trata como curva.

**[HECHO]** Implementado en `mapaGeoService.ts`: `calcularAnguloGiro`, `esGiroDeCurva` y `generarGeometriaVisual` (interpolacion Catmull-Rom, con snapping exacto a los puntos de control en cada extremo de tramo para evitar arrastre de punto flotante). Aplicado a los tres usos de `Polyline` en `MapaDiseñadorView.tsx` (rutas visibles, modo clic libre, modo detector); los `Marker`/`CircleMarker` siguen usando las coordenadas reales sin modificar. Probado con `mapaGeoService.test.ts` (angulo recto, esquina real, giro intermedio, casos limite de longitud de arreglo).

Para dibujar la curva sin agregar una dependencia nueva al proyecto (Leaflet no dibuja splines de forma nativa, y `REGLAS_PARA_EL_AGENTE.md` pide justificar cualquier libreria nueva), la opcion recomendada es generar puntos intermedios interpolados con Catmull-Rom entre los puntos de control y pasarle ese arreglo mas denso al mismo `Polyline` que ya existe. Visualmente se ve como una curva suave; tecnicamente sigue siendo una linea con muchos segmentos cortos. El JSON final sigue llevando solo los puntos de control reales, la interpolacion es puramente de dibujo.

Este bloque es independiente del calculo de `peso`: se puede implementar en una etapa separada sin bloquear el resto del flujo detector.

### 6.6 Como conviven el flujo detector y el modo borrador del administrador

No son sistemas competidores, resuelven problemas distintos y se pueden usar juntos:

- El **flujo detector** decide en que orden entran los puntos durante la captura en campo (KNN + peso + lista enlazada), y como se ve la ruta mientras se dibuja (rectas o curvas).
- El **modo borrador** del administrador decide como se sincronizan esos puntos contra backend una vez capturados (`sync`, ids temporales, estados de publicacion).

El JSON que arma el flujo detector (puntos en su orden real, ya resuelto por la lista enlazada) puede alimentar tanto el `POST /api/rutas/` que existe hoy como, mas adelante, el payload de `sync` del plan del administrador.

---

## 7. Arquitectura objetivo (las tres piezas juntas)

Pensado de afuera hacia adentro, el mapa terminado deberia funcionar asi:

1. El operador activa el modo detector para un camion y va presionando "Detectar punto" mientras recorre la ruta o marca puntos en el mapa.
2. Cada punto pasa por KNN + calculo de `peso` y queda insertado en el lugar correcto de la lista enlazada, sin que el operador tenga que preocuparse por el orden.
3. El mapa dibuja los puntos y los conecta, usando curvas donde el giro lo amerita.
4. Al terminar, la lista enlazada se convierte en un `RutaBorrador` (modelo del administrador) para sincronizarse contra backend por lotes by `sync`, con ids temporales resueltos a ids reales.
5. Con los puntos ya persistidos, se calcula la geometria oficial por calles (motor de ruteo externo) y se guarda aparte de los puntos.
6. La ruta se publica (`PUBLICADA`) solo cuando la geometria oficial es valida, y la app movil consume unicamente rutas publicadas.

Ninguna de estas etapas rompe las anteriores: el flujo actual de clic libre sigue funcionando en paralelo mientras se construye todo esto, y cada pieza se activa cuando su contrato de backend quede confirmado.

---

## 8. Modelos de datos, estado actual vs. objetivo

| Modelo | Estado | Para que sirve |
|---|---|---|
| `Coordenada` | Existe | `[latitud, longitud]`, tipo base de todo el mapa. |
| `PuntoRuta` | Existe | Punto persistido, formato de compatibilidad con backend actual. |
| `RutaDiseñada` | Existe | Ruta completa en memoria del frontend (`ruta_id`, `camion_id`, `color`, `visible`, `puntos`). |
| `PuntoConPeso` | Falta crear | `PuntoRuta` + `peso`, usado solo dentro del flujo detector. |
| `NodoPunto` / `ListaRuta` | Falta crear | Estructura de lista enlazada para el modo detector. |
| `PuntoBorrador` | [HECHO] | Punto con estado (`sin_cambios`, `nuevo`, `movido`, `reordenado`, `eliminado`) para el modo borrador del administrador. |
| `RutaBorrador` | [HECHO] | Contenedor de edicion: `ruta_id`, `nombre`, `descripcion`, `camion_id`, `color`, `puntos: PuntoBorrador[]`, `estadoPublicacion`. |
| `EstadoPublicacionRuta` | [HECHO] | `BORRADOR` / `VALIDANDO` / `VALIDA` / `ERROR` / `PUBLICADA`. Definido, transiciones reales pendientes (Fase 10). |

---

## 9. Archivos: que existe y que falta crear

| Archivo | Estado | Responsabilidad |
|---|---|---|
| `src/constants/mapa.ts` | [HECHO] | Centro, limites, zoom, tiles OSM, mas `UMBRAL_VECINO_METROS`, `PESO_BASE`, `DISTANCIA_MINIMA_DUPLICADO_METROS`, `UMBRAL_CURVA_MIN_GRADOS`, `UMBRAL_CURVA_MAX_GRADOS`. |
| `src/services/mapaGeoService.ts` | [HECHO] (fases 1-5) | `calcularDistanciaMetros`, `estaDentroDeSuchiapa`, conversiones DTO, `encontrarVecinoMasCercano`, `calcularPesoNuevoPunto`, `calcularAnguloGiro`, `esGiroDeCurva`, `generarGeometriaVisual` (Catmull-Rom). |
| `src/services/rutaService.ts` | Existe | Convierte coordenadas a `PuntoRuta[]` y arma `RutaDiseñada`. |
| `src/services/rutasApi.ts` | Existe, ampliado | `listarRutas`, `obtenerRuta`, `guardarRuta`, `actualizarRuta`, `eliminarRutaBackend` contra `api/rutas`; ahora con rama a modo offline. |
| `src/services/detectorRutaService.ts` | [HECHO] (fase 3-4) | `procesarDeteccion` (KNN + peso + duplicados) y `puntosRutaAConPeso`. |
| `src/services/offlineMode.ts` | [HECHO] (fase 0) | Flag `OFFLINE_MODE`, credencial fija, token falso y CRUD de rutas en memoria. |
| `src/services/puntosRecoleccionApi.ts` | [HECHO] (fase 8-12), conexion experimental apagada por defecto | CRUD de `api/puntos-recoleccion`, mas `syncPuntosRecoleccion`/`sincronizarPuntosDeRuta`; llamado desde `MapaDiseñador.tsx` solo si `VITE_SYNC_PUNTOS_ENABLED=true` (default `false`), de forma no bloqueante. |
| `src/services/rutaBorradorService.ts` | [HECHO] (fase 6-7-10) | Convierte `RutaDiseñada` a `RutaBorrador` y viceversa, agrega/mueve/elimina/reordena puntos, arma payload de `sync`, detecta cambios pendientes, `sincronizarConPuntos`, y `puedePublicarse`/`publicarRuta`/`volverABorrador`. Probado en `rutaBorradorService.test.ts` (fase 13). |
| `src/services/rutaBorradorService.test.ts` | [HECHO] (fase 13) | 20 casos con `vitest` cubriendo toda la logica de arriba. |
| `src/services/rutaVialService.ts` | [HECHO] (fase 9) | Pide geometria oficial por calles a un motor compatible con OSRM (`obtenerGeometriaVial`); demo publico por defecto, pendiente de decidir servidor de produccion. Probado en `rutaVialService.test.ts` (fase 13). |
| `src/services/rutaVialService.test.ts` | [HECHO] (fase 13) | 5 casos con `vitest` para `parsearRespuestaOsrm`. |
| `src/models/rutaDiseñada.ts` | Existe | `PuntoRuta`, `RutaDiseñada`, helpers de coordenadas. |
| `src/models/listaRuta.ts` | [HECHO] (fase 2-3) | `NodoPunto`, `ListaRuta`, `PuntoConPeso`, `nodosEnOrden`, renumeracion. |
| `src/models/rutaBorrador.ts` | [HECHO] | `PuntoBorrador`, `RutaBorrador`, `EstadoPuntoBorrador`, `EstadoPublicacionRuta`, `esIdTemporal`, `generarIdTemporal`. |
| `src/hooks/useRutaDiseñador.ts` | Existe | Estado de puntos del flujo de clic libre actual. |
| `src/hooks/useRutasDiseñadas.ts` | Existe | Arreglo de rutas, carga desde backend, ver todas/una. |
| `src/hooks/useDetectorRuta.ts` | [HECHO] (fase 3) | Estado de candidato/conectados/pendientes, `marcarCandidato`, `detectarPunto`, `limpiarDetector`. |
| `src/hooks/useRutaBorrador.ts` | [HECHO] (fase 7-10) | Envuelve `useRutaDiseñador`/`useDetectorRuta` sin tocarlos: mantiene un `RutaBorrador` sincronizado con `puntosActivos` via `sincronizarConPuntos`; expone `publicar`/`despublicar`/`puedePublicarse`. |
| `src/components/MapaDiseñador.tsx` | [HECHO] (fase 3-4-7-9-10-12) | Boton "Modo detector", "Detectar punto", "Cancelar candidato"; guarda desde `puntosActivos` segun el modo; sincroniza `useRutaBorrador` con `puntosActivos` y muestra indicador de cambios pendientes; boton "Calcular geometria oficial"; boton "Publicar ruta"/"Quitar publicacion" y leyenda de estado (Fase 10, solo en memoria); re-basea el borrador tras guardar y, si `VITE_SYNC_PUNTOS_ENABLED=true`, intenta sync no bloqueante (Fase 12). |
| `src/components/MapaDiseñadorView.tsx` | [HECHO] (fase 3-5-9) | Distingue conectados/pendientes/candidato; dibuja `Polyline` con `generarGeometriaVisual` (curvas Catmull-Rom) por defecto, o `geometriaOficial` (Fase 9) cuando esta disponible, solo para la ruta en edicion. |
| `src/components/MapaMonitoreo.tsx` / `MapaMonitoreoView.tsx` / `useMonitoreo.ts` | Existen | Simulacion de avance, sin cambios previstos por ahora. |

---

## 10. Contrato de backend: confirmado contra el swagger real

**[ACTUALIZADO]** Esta seccion originalmente era una lista de preguntas abiertas. Se reviso el swagger real (`/api/swagger/doc.json`, ver `REQUISITOS_BACKEND_MAPA.md` para el detalle completo con evidencia) y ahora la mayoria tiene respuesta confirmada:

- **`GET /api/rutas/` y si acepta/devuelve `camion_id`/`color`: CONFIRMADO QUE NO.** La entidad `Ruta` real solo tiene `ruta_id`, `nombre`, `descripcion`, `json_ruta`, `eliminado`, `created_at`. El frontend manda `camion_id`/`color` en el payload de guardado, pero Go los descarta en silencio al no existir esos campos, y al leer una ruta de vuelta el `camion_id` cae a `0`. **Este es un bug activo hoy**, no solo una pregunta pendiente: en cuanto se recarga la pagina o se vuelve a listar desde backend, se pierde la asociacion ruta-camion. Requiere un cambio de backend (agregar las columnas, o un recurso de asignacion ruta-camion); no se puede resolver solo en el frontend porque se confirmo que la app movil ya consume `json_ruta` como un arreglo plano de `{latitud, longitud}` y cambiar esa forma arriesga romperla. Ver `REQUISITOS_BACKEND_MAPA.md`, seccion 2.
- **`POST /api/puntos-recoleccion/sync`: CONFIRMADO QUE NO EXISTE.** `VITE_SYNC_PUNTOS_ENABLED` debe seguir en `false`. No es bloqueante: se puede lograr el mismo resultado con los endpoints individuales que si existen (`POST`/`PUT`/`DELETE` de `/api/puntos-recoleccion/{id}`), aplicando el diff que ya calcula `construirPayloadSync`.
- **`api/puntos-recoleccion` recibe `cp`, `lat`, `lon`, `ruta_id`: CONFIRMADO, y ya corregido.** `cp` es `string` en el swagger; el frontend lo trataba como `number`. Se corrigio: `puntoToBackend` (`puntosRecoleccionApi.ts`) y `construirPayloadSync` (`rutaBorradorService.ts`) ahora mandan `cp: String(orden)` siempre -- nunca un valor de `cp` guardado aparte que se pudiera desincronizar si el punto se reordena -- y `backendToPuntoRuta` (`rutasApi.ts`) ahora tolera leer `cp` como string o number de vuelta. Esto es lo que responde a "guardar la secuencia": cada punto lleva su propia coordenada real MAS un numero de secuencia explicito (`cp`), derivado siempre de `orden` en vez de repetirse por separado. Probado con un caso nuevo en `rutaBorradorService.test.ts`.
- **Si al eliminar una ruta se eliminan sus puntos en cascada: SIGUE SIN CONFIRMAR.** El swagger no trae descripcion para `DELETE /api/rutas/{id}` ni `DELETE /api/puntos-recoleccion/{id}`. Pendiente de preguntar directamente.
- **Geometria vial: CONFIRMADO QUE NO HAY ENDPOINT, Y NO HACE FALTA.** Se resolvio enteramente en el frontend con OSRM (Fase 9); esto nunca fue responsabilidad de backend.
- **`json_ruta` como GeoJSON: DESCARTADO.** Confirmado que la app movil consume `json_ruta` como arreglo plano de `{latitud, longitud}` en produccion. No se debe cambiar esa forma sin coordinar con quien mantiene la app movil.
- **Estado de publicacion de ruta: CONFIRMADO QUE NO EXISTE**, y no es una funcion prometida, es nueva. La Fase 10 la implemento solo en memoria del frontend por esta razon.
- **`peso` de cada punto: no aplica.** El backend no tiene ningun campo para esto y no hace falta pedirselo; el `orden`/`cp` ya resuelto es lo unico que se manda.

Ademas, se encontraron dos hallazgos que no estaban en la lista original de preguntas:

- El selector de camion del Disenador esta hardcodeado (Camion 1/2/3) y no viene de `GET /api/camion/`; si se conecta a ese endpoint real, el modelo real de `Camion` no tiene un nombre simple, se identifica por `placa`/`modelo`/`tipo_camion_id`/`disponibilidad_id`.
- Dos posibles bugs de documentacion en el swagger: `PUT /api/rutas/{id}` documenta como body `entities.UpdateEstadoCamionRequest` (de camion, no de ruta), y tanto `GET /api/rutas/` como `GET /api/camion/` documentan su respuesta 200 como `entities.EstadoCamionListResponse`. Probablemente son errores de copy-paste en las anotaciones de Go, pero conviene confirmarlo.

Ver `REQUISITOS_BACKEND_MAPA.md` (documento separado, pensado para compartir directo con el equipo de backend) para el detalle completo con evidencia y la prioridad sugerida.

---

## 11. Orden recomendado de implementacion (todo junto, en fases)

**Fase 0 - Confirmar contratos.** Resolver la lista completa de la seccion 10 con backend antes de escribir codigo que dependa de ella.

**Fase 1 - Utilidades base para el detector. [HECHO]** Agregado `UMBRAL_VECINO_METROS`, `PESO_BASE` y `DISTANCIA_MINIMA_DUPLICADO_METROS` a constantes; agregado `encontrarVecinoMasCercano` y `calcularPesoNuevoPunto` a `mapaGeoService.ts`; probado con `mapaGeoService.test.ts` y verificacion manual con `tsc` + `assert`.

**Fase 2 - Lista enlazada. [HECHO]** Creado `listaRuta.ts` (`NodoPunto`, `PuntoConPeso`, `ListaRuta` con `insertarAlFinal/Inicio/DespuesDe/AntesDe`, `nodosEnOrden`, `aArrayEnOrden`, `necesitaRenumerar`, `renumerarPesos`, `desdeArray`). Probado con `listaRuta.test.ts`.

**Fase 3 - Hook y UI del detector. [HECHO]** Creado `detectorRutaService.ts` (`procesarDeteccion`, `puntosRutaAConPeso`) y `useDetectorRuta.ts`; agregado boton "Modo detector" y "Detectar punto" en `MapaDiseñador.tsx` sin quitar el flujo de clic libre; `MapaDiseñadorView.tsx` distingue visualmente conectados (morado), pendientes/`peso = 0` (naranja, sin `Polyline`) y candidato (azul). Probado con `detectorRutaService.test.ts`.

**Fase 4 - Guardado del detector. [HECHO]** Al guardar, se recorre la lista con `aArrayEnOrden`, se asigna `orden`/`cp` secuencial, y se manda por el mismo camino que ya existe en `rutasApi.ts`. Ademas, `procesarDeteccion` trata como duplicado (sin insertar) cualquier candidato a menos de `DISTANCIA_MINIMA_DUPLICADO_METROS` de un punto ya existente (conectado o pendiente), y `useDetectorRuta` expone el error para mostrarlo en la UI.

**Fase 5 - Curvas (independiente, no bloqueante). [HECHO]** Agregado `calcularAnguloGiro`, `esGiroDeCurva` y la interpolacion Catmull-Rom (`generarGeometriaVisual`) en `mapaGeoService.ts`, con `UMBRAL_CURVA_MIN_GRADOS`/`UMBRAL_CURVA_MAX_GRADOS` en constantes. Aplicado solo al dibujo (`Polyline`) en `MapaDiseñadorView.tsx`; el modelo de datos y los marcadores siguen usando los puntos de control reales. Probado con `mapaGeoService.test.ts`.

**Fase 6 - Modelos de borrador del administrador. [HECHO]** Creado `src/models/rutaBorrador.ts` (`PuntoBorrador`, `RutaBorrador`, `EstadoPuntoBorrador`, `EstadoPublicacionRuta`, `esIdTemporal`, `generarIdTemporal`) y `src/services/rutaBorradorService.ts` (`rutaDiseñadaARutaBorrador`, `agregarPuntoBorrador`, `moverPuntoBorrador`, `eliminarPuntoBorrador`, `reordenarPuntoBorrador`, `tieneCambiosPendientes`, `puntosVisiblesDelBorrador`, `construirPayloadSync`, `rutaBorradorARutaDiseñada`). Todavia no esta conectado a ningun componente de UI (eso es Fase 7); por ahora es solo el modelo y las funciones puras, probadas con `tsc` + `assert` (15 casos, incluyendo mover/eliminar segun id real vs. temporal, payload de sync, y reconstruccion de orden secuencial). El payload de `construirPayloadSync` es provisional hasta confirmar el contrato real de `POST /api/puntos-recoleccion/sync` (seccion 5.4).

**Fase 7 - Integrar borrador en la UI sin romper el flujo actual. [HECHO]** En vez de reescribir `useRutaDiseñador`/`useDetectorRuta` por dentro (riesgo alto: son dos motores de estado distintos, ver seccion 6.6), se creo `useRutaBorrador.ts` que los **envuelve** observando su salida comun (`puntosActivos: Coordenada[]`), sin tocar ninguno de los dos. Se agrego `sincronizarConPuntos` a `rutaBorradorService.ts`: reconcilia el `RutaBorrador` contra la lista de coordenadas activa, conservando identidad (id real, estado) cuando la coordenada coincide exactamente, marcando como `nuevo` lo que no coincide, y marcando como `eliminado` (si tenia id real) o descartando sin rastro (si era temporal) lo que ya no aparece. Mover un punto se ve, por construccion, igual que eliminar+crear (consistente con la regla de `moverPuntoBorrador`). En `MapaDiseñador.tsx` se conecto con un `useEffect` sobre `puntosActivos`, mas `cargarDesdeRuta`/`limpiarBorrador` en los mismos puntos donde ya se sincronizaban `puntos` y `detector` (seleccionar camion, editar, ver, eliminar, cambiar camion). El guardado real sigue exactamente igual (`rutasApi`, sin usar `construirPayloadSync` todavia) — el borrador por ahora solo se ve en un indicador informativo ("Hay cambios sin sincronizar contra backend"), sin bloquear ni cambiar nada del flujo existente. Probado con 7 casos (`tsc` + `assert`): sin cambios, punto agregado, punto quitado, punto movido, y descarte de temporales.

**Fase 8 - `sync` contra backend. [HECHO] (implementado, sin conectar a UI).** Se agrego `syncPuntosRecoleccion` (`POST /api/puntos-recoleccion/sync`, recibe el `PayloadSyncPuntos` que ya arma `construirPayloadSync` desde la Fase 6) y `sincronizarPuntosDeRuta` (llama al sync y despues recarga con `listarPuntosPorRuta`, tal como pide la seccion 5.2) en `puntosRecoleccionApi.ts`. Sigue el mismo patron `apiRequest` + `extraerData` que ya usan `crearPuntoRecoleccion`/`actualizarPuntoRecoleccion` en el mismo archivo. **No se llama desde ningun componente todavia**: el contrato exacto de este endpoint (payload, forma de la respuesta, si existe siquiera) sigue sin confirmar con backend (seccion 5.4), asi que activar esto en el guardado real queda pendiente de esa confirmacion (Fase 0). Verificado con `tsc -b` (el proyecto completo compila limpio); no se agrego una prueba automatizada de red porque ninguna funcion de `rutasApi.ts`/`puntosRecoleccionApi.ts` la tenia hasta ahora (todas dependen de `fetch` real) y el mock de red no forma parte de la infraestructura de pruebas actual.

**Fase 9 - Geometria vial. [HECHO], con salvedades.** Creado `rutaVialService.ts` (`obtenerGeometriaVial`, `parsearRespuestaOsrm`) hablando el formato HTTP de OSRM (`/route/v1/driving/...`), sin agregar ninguna dependencia nueva (solo `fetch`). Se conecto en la UI, pero **como accion explicita ("Calcular geometria oficial"), no automatica**: se decidio asi porque a diferencia de las fases anteriores, esta si implica una llamada de red en vivo a un servicio externo cada vez que se dibuja, y el `baseUrl` por defecto apunta al servidor de demostracion publico de OSRM (`router.project-osrm.org`), que el propio proyecto OSRM aclara que no es para produccion (sin SLA, sin limites de uso documentados). Mientras no se confirme un servidor propio o un proveedor con SLA (pregunta abierta en la seccion 10), la geometria oficial es una vista previa opcional: si el operador no presiona el boton, o si el calculo falla, todo se sigue viendo exactamente igual que antes (`generarGeometriaVisual`, Fase 5), sin romper el flujo actual. El resultado solo reemplaza el dibujo de la ruta que se esta editando en ese momento; las demas `rutasVisibles` no se tocan. Se limpia automaticamente en cuanto los puntos de control cambian (queda obsoleta) y hay que volver a pedirla. Probado con 5 casos de `parsearRespuestaOsrm` (respuesta valida, `code` de error, sin `routes`, sin geometria, JSON invalido) via `tsc` (modulo ES2020 + Node ESM, ya que este archivo usa `import.meta.env`) + `assert`.

**Fase 10 - Publicacion. [HECHO], solo en el cliente.** Agregado `puedePublicarse`/`publicarRuta`/`volverABorrador` a `rutaBorradorService.ts` y expuestos en `useRutaBorrador.ts` (`publicar`, `despublicar`). En `MapaDiseñador.tsx` se agrego el boton "Publicar ruta" (deshabilitado si la ruta no esta guardada todavia o si no hay geometria oficial valida calculada, regla exigida por la seccion 7 punto 6) y "Quitar publicacion" cuando ya esta `PUBLICADA`; se muestra el estado actual con una leyenda. Si se intenta publicar sin geometria oficial, el estado pasa a `ERROR` en vez de `PUBLICADA`. Si los puntos de control cambian despues de publicar, la ruta vuelve automaticamente a `BORRADOR` (la geometria oficial que se publico ya no corresponde a los puntos actuales).

**Salvedad importante:** backend no confirma (seccion 10) que maneje un estado de publicacion de ruta. Por eso `estadoPublicacion` es **puramente en memoria del frontend, no se persiste** al guardar (`guardar()` sigue exactamente igual, via `rutasApi`) ni se manda a ningun endpoint: es una demostracion funcional del flujo completo (calcular geometria -> publicar -> bloquear si falta geometria -> despublicar al editar), lista para conectarse a un campo real de backend en cuanto se confirme que existe. La UI dice esto explicitamente ("solo en esta sesion; backend todavia no confirma si guarda este estado") para no dar a entender que una ruta "publicada" aqui ya es visible para la app movil del conductor. Probado con 7 casos (`tsc` + `assert`): `puedePublicarse` con 0/1/2+ puntos, publicar sin geometria (-> ERROR), publicar con geometria valida (-> PUBLICADA), y `volverABorrador` sin tocar los puntos.

**Fase 11 - Verificacion y documentacion. [HECHO], con una salvedad de entorno.** `npx tsc -b --force` y `npm run lint` corren limpio sobre todo el proyecto (el `eslint` de este entorno de trabajo, que en sesiones anteriores se colgaba, ya funciono correctamente aqui). `npm run build` (`vite build`) y `npm test` (`vitest run`) siguen fallando con `Bus error (core dumped)` en este entorno especifico por un problema de esbuild ajeno al codigo (ya diagnosticado en sesiones previas reproduciendo el mismo error con una llamada `esbuild.transform()` trivial y no relacionada). **Accion recomendada para quien retome esto: correr `npm run build` y `npm test` en su propia maquina antes de dar por buena esta fase**, ya que aqui no se pudo confirmar. Se actualizo `MAPA-FUNCIONAMIENTO.md` con secciones nuevas para modo offline (4.1), modo detector (7.5), curvas automaticas (7.6), modo borrador (7.7), geometria vial (7.8) y publicacion (7.9), ademas de corregir referencias a archivos desactualizadas (rutas sin `ñ` que ya no coincidian con los archivos reales) y refrescar las secciones de archivos importantes, scripts, limitaciones y pendientes.

**Fase 12 - Conectar `puntosRecoleccionApi.ts`. [HECHO], con alcance ajustado.** Esta fase no existia todavia en este documento (se detenia en la Fase 11); se agrega aqui. El contrato de `POST /api/puntos-recoleccion/sync` sigue sin confirmar (seccion 5.4/10), asi que no se podia "conectar" a ciegas sin arriesgar romper el guardado real. Se hicieron dos cosas, separando lo seguro de lo experimental:

1. **Arreglo real, sin depender de ningun contrato nuevo:** en `MapaDiseñador.tsx`, `guardar()` ahora llama a `borrador.cargarDesdeRuta(rutaFinal)` justo despues de un guardado exitoso (con los datos que YA devuelve el `rutasApi.ts` confirmado de siempre). Esto cierra un hueco real que traia la Fase 7: antes, el indicador "Hay cambios sin sincronizar" se quedaba encendido para siempre despues de guardar, porque el borrador nunca se re-basaba contra lo que realmente quedo persistido.
2. **Intento EXPERIMENTAL y apagado por defecto:** se agrego `VITE_SYNC_PUNTOS_ENABLED` (default `false`, documentado en `.env.example`/`.env.development`). Si se activa, despues de un guardado exitoso de una ruta que ya existia (no aplica a una ruta recien creada) y que tenia cambios pendientes en el borrador, se intenta `sincronizarPuntosDeRuta` (Fase 8) con el payload de `construirPayloadSync`. Este intento es **no bloqueante**: el guardado normal de arriba ya se completo antes de intentarlo, y si el endpoint no existe o responde distinto a lo esperado, el error se muestra como un aviso no bloqueante (`errorSyncPuntos`) sin deshacer ni afectar el guardado real. Mientras el contrato no se confirme, esta variable debe quedar en `false`.

Probado con 2 casos (`tsc` + `assert`) que simulan el escenario real: agregar un punto, guardar, y verificar que el borrador re-baseado ya no marca cambios pendientes; mas verificacion de que `construirPayloadSync` sigue funcionando igual antes del re-baseline (sin regresion). `npx tsc -b --force` y `npm run lint` limpios despues del cambio.

**Fase 13 - Pruebas automatizadas completas. [HECHO], con la misma salvedad de entorno que la Fase 11.** Tampoco existia todavia como fase formal en este documento. Hasta este punto, la logica de `rutaBorradorService.ts` (fases 6, 7, 10, 12) y `rutaVialService.ts` (fase 9) solo se habia verificado con scripts sueltos (`tsc` + `assert` en `/tmp`, fuera del repositorio) — es decir, exista pero no quedaba como prueba automatizada real, a diferencia de `mapaGeoService.ts`, `listaRuta.ts` y `detectorRutaService.ts`, que si tienen su `*.test.ts` desde las fases 1-4. Se creo:

- `src/services/rutaBorradorService.test.ts`: 20 casos con `describe`/`it`/`expect` de `vitest`, cubriendo `rutaDiseñadaARutaBorrador`, `agregarPuntoBorrador`, `moverPuntoBorrador` (id real vs. temporal), `eliminarPuntoBorrador` (id real vs. temporal), `reordenarPuntoBorrador`, `tieneCambiosPendientes`, `puntosVisiblesDelBorrador`, `construirPayloadSync` (incluyendo el error sin `ruta_id`), `sincronizarConPuntos` (sin cambios, agregado, eliminado, movido, descarte de temporal), `rutaBorradorARutaDiseñada`, y `puedePublicarse`/`publicarRuta`/`volverABorrador`.
- `src/services/rutaVialService.test.ts`: 5 casos para `parsearRespuestaOsrm` (respuesta valida, `code` de error, sin `routes`, sin geometria, JSON invalido).

Mismo problema de entorno que la Fase 11: `npx vitest run` sigue terminando en `Bus error (core dumped)` aqui (esbuild), asi que estos archivos **no se pudieron ejecutar de verdad con vitest en este sandbox**. Para compensar, se re-verificaron los casos mas delicados (armado de payload de sync, reconciliacion de un punto "movido", reconstruccion de `RutaDiseñada` con ids temporales) con el mismo mecanismo de `tsc` + `assert` ya usado en fases anteriores, confirmando que las aserciones escritas en los `.test.ts` son correctas. `npx tsc -b --force` y `npm run lint` (que si funcionan en este entorno) pasan limpio con los archivos nuevos. **Accion recomendada: correr `npm test` en tu propia maquina para la confirmacion final real con vitest.**

**Fase 14 - Limpieza de codigo muerto. [HECHO].** Tampoco existia como fase formal en este documento. Antes de borrar nada se confirmo con `grep` en todo `src/` que cada archivo/exportacion realmente no tenia importadores (no alcanza con "parece no usarse"):

- `src/api/mockApi.ts` **eliminado**: cero importadores en todo el proyecto.
- `src/models/ModelosMapa.tsx` **eliminado**: el unico archivo que lo importaba era el propio `mockApi.ts`; al borrar ese, `ModelosMapa.tsx` (con sus clases `Ruta`, `PuntoRecoleccion`, `Camion` y su propio `EstadoCamion` duplicado) quedo sin ningun importador tambien.
- `src/data/DatosFalsos.tsx` **recortado, no eliminado**: tenia tres exportaciones. `Camion` (interfaz) y `listaCamiones` (arreglo simulado) solo los usaba `mockApi.ts`, asi que se quitaron. `EstadoCamion` (tipo) si se usa de verdad en `MapaMonitoreoView.tsx` y `utils/IconosCamion.ts`, asi que se conservo; borrar el archivo completo hubiera roto esos dos.

`npx tsc -b --force` y `npm run lint` limpios despues de la limpieza, y un `grep` final confirma que no queda ninguna referencia a `mockApi`/`ModelosMapa` en `src/`.

---

## 12. Decisiones ya confirmadas (no volver a preguntar)

- El "detector" es un boton manual en la UI, no GPS continuo ni hardware externo.
- El flujo detector vive dentro del Disenador actual, no en un modulo aparte ni solo en backend.
- `peso` es la clave de orden/posicion de la ruta, con base `10`.
- Insertar entre dos puntos conectados: `peso` = promedio de ambos.
- Extender despues de la cola: `peso` = peso de la cola + 10.
- Extender antes de la cabeza: `peso` = promedio entre `0` virtual y el peso de la cabeza.
- Sin vecino cercano dentro del umbral: `peso = 0`, punto pendiente de conectar.
- El orden final para dibujar y para el JSON sale de recorrer la lista enlazada, nunca de ordenar por `peso`.

---

## 13. Preguntas y decisiones pendientes (todas, en un solo lugar)

- Valor exacto de `UMBRAL_VECINO_METROS` (propuesto: 40 metros).
- Que hacer exactamente con los puntos `peso = 0` al guardar: mostrarlos sueltos sin mandarlos (recomendado), mandarlos igual como "sin ruta asignada", o usar un campo `conectado` aparte.
- Si "Detectar punto" toma el ultimo clic hecho en el mapa o si tambien debe poder usar la geolocalizacion del navegador.
- Si el modo detector debe convivir con dos botones visibles junto al modo de clic libre, o reemplazarlo por completo dentro del Disenador.
- Si backend necesita conocer `peso`, o si solo le interesa el `orden` ya resuelto.
- Umbral de grados para decidir cuando un tramo se dibuja como curva (propuesto: 15 a 75 grados sostenidos).
- Si se acepta generar curvas con puntos intermedios (sin dependencia nueva) o se prefiere una libreria como `leaflet.curve`.
- Toda la lista de contratos de backend pendientes de la seccion 10.

---

## 14. Reglas de trabajo (resumen aplicable a este documento)

- Leer este documento completo antes de tocar codigo del mapa; ya no hace falta saltar entre varios archivos de plan.
- Analizar antes de implementar, y trabajar en etapas pequenas (seccion 11).
- No asumir contratos de backend sin confirmarlos (seccion 10).
- No romper el flujo de clic libre actual mientras se construye el flujo detector ni el modo borrador.
- No introducir dependencias nuevas (por ejemplo, librerias de mapas o de curvas) sin justificarlo primero.
- Correr `npm run lint` y `npm run build` despues de cualquier cambio de codigo, y corregir lo que falle antes de entregar.
- Actualizar `MAPA-FUNCIONAMIENTO.md` cuando el comportamiento real del mapa cambie, para que ese documento siga describiendo lo que existe hoy.
