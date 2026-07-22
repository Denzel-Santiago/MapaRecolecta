# PLAN_FLUJO_DETECTOR

Nota de coordinacion: este documento es un plan complementario, igual que `PLAN_ADAPTACION_ADMIN.md`. No reemplaza `PLAN_DE_SEGUIMIENTO.md` ni `PLAN_ADAPTACION_ADMIN.md`. Debe leerse junto con ellos antes de implementar codigo, siguiendo `REGLAS_PARA_EL_AGENTE.md`.

Este documento es analisis y diseno. No se modifico codigo del proyecto para producirlo.

## 1. Objetivo

Definir, dentro del Disenador de rutas ya existente, un nuevo modo de captura de puntos ("modo detector") en el que cada punto no se agrega libremente por clic y se ancla siempre al final, sino que pasa por un flujo de bloques:

```
Inicio -> Esperar detector -> Guardar punto para recalcular (KNN) -> Wipe -> Write points -> Connect points
```

Los puntos se mantienen en una lista enlazada, y al finalizar (o en cada paso, segun se decida) se produce un JSON de la ruta reutilizando el envio que ya existe hacia backend.

## 2. Respuestas ya confirmadas (no se repiten preguntas)

- El "detector" es un boton manual en la UI, no GPS continuo ni hardware externo.
- El flujo vive dentro del Disenador actual (`MapaDiseñador.tsx`), no en un modulo aparte ni solo en backend.
- El KNN sirve para decidir si el punto nuevo tiene vecinos cercanos entre los puntos ya guardados de esa ruta. Si no hay ningun punto cerca, el punto se guarda con `peso = 0` (pendiente de conectar).
- La clave de orden dentro de la ruta es un campo nuevo llamado `peso`, no directamente `orden`. Regla de calculo (version revisada, ver seccion 9 para el origen del cambio):
  - Peso base del primer punto de una ruta nueva, sin nada que promediar: `10`.
  - Si el punto candidato cae entre dos puntos que ya estan conectados entre si en la lista (un vecino antes y otro despues), su `peso` es el promedio de los pesos de esos dos vecinos.
  - Si el punto candidato va **despues de la cola** (extiende la ruta al final, el caso mas comun), su `peso` es `peso de la cola + PESO_BASE` (10, 20, 30...).
  - Si el punto candidato va **antes de la cabeza** (extiende la ruta al inicio), su `peso` es el promedio entre un "inicio virtual" de `0` y el peso actual de la cabeza. Por ejemplo, si la cabeza pesa 10, el nuevo punto queda en 5.
  - Si no hay ningun vecino a menos de `UMBRAL_VECINO_METROS`, `peso = 0` y el punto queda sin conectar.
  - Cuando la diferencia entre pesos consecutivos se vuelve demasiado pequena (por insertar muchas veces entre los mismos dos puntos), se debe renumerar toda la lista en multiplos de `PESO_BASE` para recuperar espacio de precision.

## 3. Bloques solicitados y su traduccion tecnica

| Bloque pedido | Que hace en este proyecto |
|---|---|
| Inicio | Se activa el modo detector para el camion seleccionado; se parte de la lista enlazada de la ruta en edicion (vacia o cargada si el camion ya tenia ruta). |
| Esperar detector | La UI queda a la espera de que el operador presione "Detectar punto". No se agrega nada hasta ese clic. |
| Guardar el punto para recalcular (KNN) | Se toma la coordenada candidata y se compara contra los puntos ya guardados usando distancia real (Haversine), buscando el vecino mas cercano. |
| Wipe | Se limpia el arreglo derivado que alimenta los `Marker`/`Polyline` antes de reescribirlo con el resultado ya recalculado. |
| Write points | Se vuelve a construir el arreglo de puntos (marcadores) a partir de la lista enlazada actualizada. |
| Connect points | Se dibuja la `Polyline` conectando los puntos que si tienen orden real, en su orden. |
| Lista enlazada | Estructura de datos nueva que reemplaza el arreglo plano como fuente de verdad mientras se esta en modo detector. |
| JSON de la ruta | Se recorre la lista enlazada, se convierte a `PuntoRuta[]` y se envia con el mismo mecanismo que ya existe en `rutasApi.ts`. |

## 4. Que se reutiliza del proyecto actual (no se reinventa)

- `calcularDistanciaMetros(origen, destino)` en `src/services/mapaGeoService.ts`: ya calcula distancia real entre dos coordenadas con formula Haversine. Es exactamente lo que necesita el paso KNN, no hace falta escribir otra formula de distancia.
- `estaDentroDeSuchiapa` en el mismo servicio: se sigue usando para validar el punto candidato antes de correr KNN.
- `PuntoRuta` y `RutaDiseñada` en `src/models/rutaDiseñada.ts`: se mantienen como formato final. El `orden` del modelo ya existente es el campo que se usa para el caso especial `orden = 0`.
- `crearRutaDiseñada`, `coordenadasAPuntos` en `src/services/rutaService.ts`: siguen siendo el punto de conversion final de coordenadas a `PuntoRuta[]`.
- `construirRutaBackend`, `guardarRuta`, `actualizarRuta` en `src/services/rutasApi.ts`: siguen siendo el unico camino para mandar el JSON al backend (`POST /api/rutas/` o `PUT /api/rutas/:id`). El nuevo flujo no debe crear un segundo formato de envio.
- `MapaDiseñadorView.tsx`: ya redibuja marcadores y `Polyline` completos cada vez que cambia el arreglo `puntos`. Esto es importante: en React, "wipe" no requiere tocar el DOM de Leaflet a mano, basta con reemplazar el estado que se le pasa a la vista.
- `puntosRutaACoordenadas` en `rutaDiseñada.ts`: sirve de referencia para el paso "connect points", pero el flujo detector NO puede reusarla tal cual porque ordena con `Array.sort` (ver seccion 7 sobre por que `peso` no es una clave de sort segura).
- El concepto de "orden flotante" ya documentado en `PLAN_ADAPTACION_ADMIN.md` (seccion 7.2 y 5.2) es el mismo problema que resuelve `peso` aqui: insertar un punto entre dos existentes sin renumerar toda la ruta. La diferencia es que en este flujo el valor no es un numero de orden arbitrario, sino literalmente el promedio de los dos vecinos, con base `10`.

## 5. Que hace falta crear

1. Constantes nuevas en `src/constants/mapa.ts`:

```ts
export const UMBRAL_VECINO_METROS = 40; // valor propuesto, pendiente de confirmar con el equipo
export const PESO_BASE = 10; // peso del primer punto de una ruta nueva, sin vecinos que promediar
```

2. Utilidad KNN en `src/services/mapaGeoService.ts` (usa `calcularDistanciaMetros` ya existente). Devuelve el vecino mas cercano (k=1) entre todos los puntos ya guardados, conectados o pendientes:

```ts
export function encontrarVecinoMasCercano(
  candidato: Coordenada,
  puntos: { id: string; coordenada: Coordenada }[]
): { id: string; distancia: number } | null {
  if (puntos.length === 0) return null;

  let mejor = puntos[0];
  let mejorDistancia = calcularDistanciaMetros(candidato, mejor.coordenada);

  for (const punto of puntos.slice(1)) {
    const distancia = calcularDistanciaMetros(candidato, punto.coordenada);
    if (distancia < mejorDistancia) {
      mejor = punto;
      mejorDistancia = distancia;
    }
  }

  return { id: mejor.id, distancia: mejorDistancia };
}
```

Con la cantidad de puntos que tiene una ruta de recoleccion (decenas, no miles), no hace falta un indice espacial: recorrer el arreglo es suficiente.

3. Calculo de `peso` para el punto candidato, una vez que `encontrarVecinoMasCercano` devolvio el nodo mas cercano (`nodoA`). Esta funcion mira los vecinos estructurales de `nodoA` dentro de la lista enlazada (no vuelve a correr KNN, usa los punteros `anterior`/`siguiente`):

```ts
function calcularPesoNuevoPunto(
  candidato: Coordenada,
  nodoA: NodoPunto,
  lista: ListaRuta
): { peso: number; insertarJuntoA: NodoPunto; posicion: "antes" | "despues" } {
  const vecinoAntes = nodoA.anterior;
  const vecinoDespues = nodoA.siguiente;

  // Si nodoA tiene vecino de un lado, comparar distancias para saber
  // si el candidato cae "entre" nodoA y ese vecino.
  const candidatoVsAntes = vecinoAntes
    ? calcularDistanciaMetros(candidato, vecinoAntes.punto.coordenada)
    : Infinity;
  const candidatoVsDespues = vecinoDespues
    ? calcularDistanciaMetros(candidato, vecinoDespues.punto.coordenada)
    : Infinity;

  if (vecinoAntes && candidatoVsAntes <= candidatoVsDespues) {
    return {
      peso: (nodoA.punto.peso + vecinoAntes.punto.peso) / 2,
      insertarJuntoA: vecinoAntes,
      posicion: "despues",
    };
  }

  if (vecinoDespues) {
    return {
      peso: (nodoA.punto.peso + vecinoDespues.punto.peso) / 2,
      insertarJuntoA: nodoA,
      posicion: "despues",
    };
  }

  // nodoA es un extremo de la ruta (cabeza o cola): no hay segundo
  // vecino real, se usa un limite virtual en vez de heredar el mismo
  // peso (heredar genera empates, ver seccion 7).
  const esCola = nodoA === lista.cola;
  const pesoVirtual = esCola
    ? nodoA.punto.peso + PESO_BASE          // extender al final: 10, 20, 30...
    : (0 + nodoA.punto.peso) / 2;           // extender al inicio: promedio con "0" virtual

  return {
    peso: pesoVirtual,
    insertarJuntoA: nodoA,
    posicion: esCola ? "despues" : "antes",
  };
}
```

Nota sobre precision: si se inserta muchas veces entre los mismos dos vecinos (por ejemplo, siempre "en medio de la calle" entre las mismas dos esquinas), los promedios se acercan cada vez mas. Cuando la diferencia entre dos pesos consecutivos sea menor a un epsilon razonable (por ejemplo `0.0001`), se debe recorrer la lista con `aArrayEnOrden` y reasignar pesos limpios en multiplos de `PESO_BASE` (10, 20, 30...), igual que hacen herramientas como Trello para reordenar tarjetas sin perder precision.

4. Lista enlazada nueva, por ejemplo `src/models/listaRuta.ts`. El punto dentro de cada nodo necesita cargar su `peso`:

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

5. Hook nuevo `src/hooks/useDetectorRuta.ts`, separado de `useRutaDiseñador` para no romper el flujo de clic libre que ya funciona (regla de "no romper lo que ya funciona" de `REGLAS_PARA_EL_AGENTE.md`).

6. Cambios de UI en `MapaDiseñador.tsx` y `MapaDiseñadorView.tsx`:
   - un boton "Modo detector" que alterna entre el flujo actual (clic libre, `ClickParaPuntos`) y el flujo nuevo.
   - un boton "Detectar punto" que toma la ultima coordenada marcada en el mapa y dispara el pipeline.
   - distincion visual entre puntos conectados (`peso > 0`, con `Polyline`) y puntos pendientes (`peso = 0`, solo marcador, sin conectar).

## 6. Diagrama del flujo completo

```
Inicio (modo detector activado para el camion X)
   |
   v
Esperar detector  <---------------------------+
   | (operador presiona "Detectar punto")      |
   v                                           |
Validar punto dentro de Suchiapa               |
   | (si no es valido -> error, vuelve a       |
   |  esperar detector)                        |
   v                                           |
Guardar punto para recalcular (KNN + peso)     |
   | 1. buscar vecino mas cercano (nodoA)      |
   |    entre TODOS los puntos ya guardados    |
   |    (conectados + pendientes) usando       |
   |    calcularDistanciaMetros                |
   |                                           |
   +-- nodoA a mas de UMBRAL_VECINO_METROS     |
   |     -> peso = 0 (pendiente de conectar)   |
   |                                           |
   +-- nodoA a <= UMBRAL_VECINO_METROS         |
   |     2. mirar los vecinos ESTRUCTURALES    |
   |        de nodoA en la lista (anterior/    |
   |        siguiente), no volver a correr KNN |
   |                                           |
   |     +-- el candidato cae entre nodoA y    |
   |     |   otro nodo ya conectado a el       |
   |     |   -> peso = promedio de ambos pesos |
   |     |   -> se inserta entre los dos       |
   |     |                                     |
   |     +-- nodoA es la cola (fin de ruta)     |
   |     |   -> peso = peso(cola) + PESO_BASE  |
   |     |   -> se inserta despues de la cola  |
   |     |                                     |
   |     +-- nodoA es la cabeza (inicio ruta)  |
   |         -> peso = promedio(0, peso(nodoA))|
   |         -> se inserta antes de la cabeza  |
   v                                           |
Wipe (se limpia el arreglo que alimenta        |
   el mapa antes de reescribirlo)              |
   v                                           |
Write points (se reconstruye el arreglo de     |
   marcadores desde la lista enlazada)         |
   v                                           |
Connect points (se dibuja la Polyline          |
   recorriendo la lista de cabeza a cola,      |
   NO ordenando por peso; ver seccion 7)       |
   |                                           |
   +-------------------------------------------+
   |
   v
Usuario decide finalizar
   |
   v
Construir JSON de la ruta (recorrer lista
   enlazada -> PuntoRuta[] -> RutaDiseñada)
   |
   v
Enviar con rutasApi.ts (POST/PUT ya existentes)
```

## 7. Punto critico: no depender de `Array.sort` sobre `peso`

La version revisada de la seccion 2 (peso = cola + `PESO_BASE` al extender al final, promedio con `0` virtual al extender al inicio) ya evita que los puntos agregados en secuencia normal terminen con el mismo `peso`. Eso corrige el problema que yo mismo habia senalado antes con la regla de "heredar el mismo peso".

Aun asi, se recomienda no depender de `Array.sort(peso)` para reconstruir el orden final, por dos razones:

1. Sigue siendo posible provocar un empate si, por ejemplo, dos operaciones de renumeracion quedan mal sincronizadas, o si se inserta un punto exactamente en el punto medio dos veces seguidas antes de renumerar.
2. Los puntos con `peso = 0` (sin vecino cercano, pendientes de conectar) siempre empatan entre si por definicion.

El orden real siempre esta en la estructura de la lista enlazada: cada `insertarDespuesDe` deja el nodo fisicamente en su lugar correcto (antes o despues de su vecino), sin importar si el `peso` quedo repetido. Entonces:

- `peso` se usa unicamente durante el calculo de insercion (paso "guardar el punto para recalcular"), para decidir el valor que carga cada nodo.
- El orden que se dibuja ("connect points") y el orden que se manda en el JSON final se obtienen recorriendo la lista de `cabeza` a `cola`, nunca ordenando por `peso`.
- Al construir el JSON final, se recorre la lista y se asigna `orden`/`cp` secuencial (1, 2, 3...) en ese momento, tomando la posicion real de cada nodo. `peso` no se manda a backend salvo que confirmes que el contrato de `api/rutas` o `api/puntos-recoleccion` lo va a aceptar (ahora mismo no esta documentado en `REGLAS_PARA_EL_AGENTE.md`).

Sobre el caso sin ningun vecino cercano (`peso = 0`), sigue pendiente una decision aparte, ya definida en el punto anterior de este documento:

1. Los puntos con `peso = 0` se muestran como marcadores sueltos (sin `Polyline`) y no se incluyen en el JSON final hasta que otra deteccion los conecte a la cadena.
2. Los puntos con `peso = 0` se permiten enviar igual, y el backend o la app movil los interpreta como "puntos sin ruta asignada".
3. Se usa un campo aparte, por ejemplo `conectado: boolean`, para no depender solo de `peso = 0` como senal.

Se recomienda la opcion 1, igual que antes, por ser la mas segura.

## 8. Relacion con `PLAN_ADAPTACION_ADMIN.md`

Este flujo de detector no reemplaza el modo borrador (`RutaBorrador`, `PuntoBorrador`, `sync`) que ya esta planeado en `PLAN_ADAPTACION_ADMIN.md`. Son compatibles: el modo detector decide en que orden entran los puntos durante la captura en campo; el modo borrador decide como se sincronizan esos puntos contra backend (`POST /api/puntos-recoleccion/sync`) una vez capturados. El JSON final que arma este flujo puede alimentar tanto el `POST /api/rutas/` actual como, mas adelante, el payload de `sync`.

## 9. Origen de esta revision

Se recibio un audio explicando el manejo de pesos y un resumen escrito de una consulta previa (hecha por el profesor a otra IA) sobre el mismo problema. El audio no se pudo transcribir en este entorno: no hay herramienta de voz-a-texto disponible y el acceso de red esta limitado a un numero corto de dominios (pypi funciona; Google Speech, Hugging Face, OpenAI y GitHub releases estan bloqueados), asi que no fue posible instalar ni descargar un modelo de reconocimiento de voz. Si en algun momento se cuenta con una transcripcion de ese audio, conviene volver a revisar esta seccion por si agrega algo que el resumen escrito no cubre.

Del resumen escrito, esto es lo que cambio respecto a la primera version de este documento:

- **Insercion en los extremos.** La primera version de este documento proponia que un punto en un extremo de la ruta heredara el mismo `peso` que su unico vecino. Eso generaba empates (ver seccion 7). El resumen propone usar un limite virtual en vez de heredar: `0` virtual para insertar antes de la cabeza, y `peso de la cola + PESO_BASE` para insertar despues de la cola. Ya se aplico este cambio en las secciones 2, 5 y 6.
- **Precision y renumeracion periodica.** Confirma un riesgo que ya estaba anotado como pendiente: si se inserta muchas veces entre los mismos dos puntos, los promedios pierden separacion. La solucion (renumerar en multiplos de `PESO_BASE` cuando la diferencia se hace muy pequena) ya se agrego en la seccion 5.
- **Automatizar si el punto va al inicio, en medio o al final, usando proximidad y direccion.** Esto no cambia nada: es lo que ya hace `encontrarVecinoMasCercano` + `calcularPesoNuevoPunto` revisando los vecinos estructurales del nodo mas cercano.
- **Curvas automaticas.** Esto si es nuevo, no estaba contemplado antes. Se desarrolla en la seccion 10.

## 10. Curvas automaticas para "connect points"

Hoy "connect points" (seccion 3 y 6) dibuja una `Polyline` recta entre puntos consecutivos. Suchiapa tiene calles en angulo recto casi todo el tiempo, pero tambien hay calles curvas, y el resumen propone que el sistema decida solo, sin intervencion manual, cuando dibujar una curva.

### 10.1 Que guarda la lista enlazada

Sin cambios: la lista enlazada sigue guardando unicamente puntos de control (los puntos reales detectados), igual que hoy. Lo que cambia es solo la forma de dibujar entre dos o tres puntos consecutivos, no el modelo de datos.

### 10.2 Como decidir "curva" vs "linea recta"

Para cada trio de puntos consecutivos de la lista (`p1`, `p2`, `p3`), calcular el angulo entre los vectores `p1->p2` y `p2->p3`. Si el angulo esta cerca de 180 grados (casi la misma direccion) o cerca de 90 grados (esquina real, calle en angulo recto), se deja la conexion recta. Si el cambio de direccion es intermedio y progresivo entre varios puntos seguidos, se trata como curva.

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

Esto es una aproximacion discreta de la curvatura (la "derivada segunda" que menciona el resumen), suficiente para puntos de recoleccion espaciados por calle; no hace falta procesamiento de imagenes.

### 10.3 Como dibujar la curva sin agregar una dependencia nueva

`REGLAS_PARA_EL_AGENTE.md` pide justificar cualquier dependencia nueva. Leaflet no dibuja splines ni Bezier de forma nativa en su `Polyline`, y agregar un plugin (por ejemplo `leaflet.curve`) es una opcion, pero no la unica.

Alternativa sin dependencia nueva: cuando un tramo se marca como curva, generar en `mapaGeoService.ts` una serie de puntos intermedios interpolados con Catmull-Rom entre los puntos de control, y pasarle ese arreglo mas denso al mismo `Polyline` que ya existe. Visualmente se ve como una curva suave, aunque tecnicamente sigue siendo muchos segmentos rectos muy cortos. Esto no cambia lo que se guarda ni lo que se manda a backend: el JSON final sigue llevando solo los puntos de control reales, la interpolacion es puramente de dibujo en el mapa.

### 10.4 Pendiente de confirmar

- Umbral de grados para decidir "es curva" (propuesta inicial: tramos con giro entre 15 y 75 grados sostenido en varios puntos seguidos se tratan como curva; fuera de ese rango, linea recta).
- Si se prefiere usar una libreria como `leaflet.curve` en vez de generar puntos intermedios a mano.
- Si este bloque se implementa en la misma etapa que el resto del flujo detector, o se deja para una etapa posterior (es independiente del calculo de `peso`, no bloquea lo demas).

## 11. Archivos que se tocarian al implementar (ninguno modificado todavia)

- `src/constants/mapa.ts`: agregar `UMBRAL_VECINO_METROS` y `PESO_BASE`.
- `src/services/mapaGeoService.ts`: agregar `encontrarVecinoMasCercano` (KNN k=1), `calcularPesoNuevoPunto` y `calcularAnguloGiro`.
- `src/models/listaRuta.ts` (nuevo): nodo (con `peso`) y clase de lista enlazada, incluyendo `aArrayEnOrden` que recorre por estructura, no por sort.
- `src/hooks/useDetectorRuta.ts` (nuevo): estado del flujo Inicio/Esperar/Recalcular/Wipe/Write/Connect.
- `src/components/MapaDiseñador.tsx`: boton de modo detector, boton "Detectar punto", pasar props nuevas a la vista.
- `src/components/MapaDiseñadorView.tsx`: distinguir puntos conectados de pendientes al dibujar, y generar puntos intermedios (Catmull-Rom) en los tramos marcados como curva antes de pasarlos al `Polyline`.
- `MAPA-FUNCIONAMIENTO.md` y `PLAN_DE_SEGUIMIENTO.md`: actualizar cuando el flujo quede implementado, segun regla 11 de `REGLAS_PARA_EL_AGENTE.md`.

## 12. Orden recomendado de implementacion (etapas pequenas)

1. Confirmar la decision pendiente sobre `peso = 0` (seccion 7).
2. Confirmar `UMBRAL_VECINO_METROS` (valor propuesto: 40 metros, ajustable).
3. Agregar `encontrarVecinoMasCercano` y `calcularPesoNuevoPunto` a `mapaGeoService.ts` sin tocar nada mas, y probarlos aislados.
4. Crear `listaRuta.ts` con pruebas manuales simples (insertar, recorrer con `aArrayEnOrden`, convertir a arreglo).
5. Crear `useDetectorRuta.ts` reutilizando `estaDentroDeSuchiapa`, `encontrarVecinoMasCercano`, `calcularPesoNuevoPunto` y `ListaRuta`.
6. Integrar el boton "Modo detector" en `MapaDiseñador.tsx` sin quitar el flujo de clic libre actual.
7. Conectar el boton "Detectar punto" al hook nuevo.
8. Ajustar `MapaDiseñadorView.tsx` para pintar distinto los puntos con `peso = 0`.
9. Al guardar, recorrer la lista con `aArrayEnOrden` y asignar `orden`/`cp` secuencial antes de llamar a `rutasApi.ts`, sin mandar `peso` a backend salvo que se confirme el contrato.
10. (Etapa aparte, no bloqueante) Agregar `calcularAnguloGiro` y la interpolacion Catmull-Rom para curvas, una vez confirmado el umbral de grados de la seccion 10.4.
11. Ejecutar `npm run lint` y `npm run build`.

## 13. Preguntas pendientes antes de programar

- Valor exacto de `UMBRAL_VECINO_METROS`.
- Que hacer con los puntos `peso = 0` al momento de guardar (seccion 7).
- Si "Detectar punto" toma el ultimo clic hecho en el mapa o si ademas debe ofrecer usar la geolocalizacion del navegador como origen del punto candidato.
- Si el modo detector debe convivir de forma visible con el modo de clic libre actual (dos botones) o si debe reemplazarlo por completo dentro del Disenador.
- Si backend necesita conocer `peso` (por ejemplo para recalcular la ruta despues, en otra sesion) o si basta con mandar el `orden` secuencial ya resuelto y `peso` se descarta despues de construir el JSON.
- Umbral de grados para decidir cuando un tramo es curva (seccion 10.4).
- Si se acepta generar la curva con puntos intermedios (sin dependencia nueva) o se prefiere agregar una libreria como `leaflet.curve`.
- Si llega una transcripcion del audio, revisar si agrega algo distinto a lo ya cubierto por el resumen escrito.
