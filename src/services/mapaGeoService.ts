import {
  PESO_BASE,
  SUCHIAPA_BOUNDS,
  UMBRAL_CURVA_MAX_GRADOS,
  UMBRAL_CURVA_MIN_GRADOS,
} from "../constants/mapa";
import type { Coordenada, CoordenadaDTO } from "../models/geo";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import type { NodoPunto } from "../models/listaRuta";

export function normalizarCoordenada([latitud, longitud]: Coordenada): Coordenada {
  return [Number(latitud), Number(longitud)];
}

export function coordenadaToDTO(coordenada: Coordenada): CoordenadaDTO {
  const [latitud, longitud] = normalizarCoordenada(coordenada);
  return { latitud, longitud };
}

export function dtoToCoordenada({ latitud, longitud }: CoordenadaDTO): Coordenada {
  return normalizarCoordenada([latitud, longitud]);
}

export function rutaToDTO(ruta: Coordenada[]): CoordenadaDTO[] {
  return ruta.map(coordenadaToDTO);
}

export function estaDentroDeLimites(
  [latitud, longitud]: Coordenada,
  [puntoMin, puntoMax]: [Coordenada, Coordenada] = SUCHIAPA_BOUNDS
): boolean {
  const [latMin, lngMin] = puntoMin;
  const [latMax, lngMax] = puntoMax;

  return latitud >= latMin && latitud <= latMax && longitud >= lngMin && longitud <= lngMax;
}

export function estaDentroDeSuchiapa(coordenada: Coordenada): boolean {
  return estaDentroDeLimites(coordenada, SUCHIAPA_BOUNDS);
}

export function validarRutaEnSuchiapa(ruta: Coordenada[]): boolean {
  return ruta.every(estaDentroDeSuchiapa);
}

export function calcularDistanciaMetros(origen: Coordenada, destino: Coordenada): number {
  const radioTierraMetros = 6371000;
  const gradosARadianes = Math.PI / 180;
  const [latOrigen, lngOrigen] = origen;
  const [latDestino, lngDestino] = destino;
  const deltaLat = (latDestino - latOrigen) * gradosARadianes;
  const deltaLng = (lngDestino - lngOrigen) * gradosARadianes;
  const latOrigenRad = latOrigen * gradosARadianes;
  const latDestinoRad = latDestino * gradosARadianes;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latOrigenRad) * Math.cos(latDestinoRad) * Math.sin(deltaLng / 2) ** 2;

  return 2 * radioTierraMetros * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * K-Nearest-Neighbours con k=1: devuelve el punto ya guardado mas cercano al
 * candidato, o null si la lista esta vacia. Ver PLAN_MAPA_COMPLETO.md, seccion 6.
 * No hace falta un indice espacial: una ruta de recoleccion tiene decenas de
 * puntos, no miles.
 */
export function encontrarVecinoMasCercano<T extends { id: string; coordenada: Coordenada }>(
  candidato: Coordenada,
  puntos: T[]
): { id: string; distancia: number } | null {
  if (puntos.length === 0) {
    return null;
  }

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

export interface ResultadoRecalculoPeso {
  peso: number;
  insertarJuntoA: NodoPunto;
  posicion: "antes" | "despues";
}

function coordenadaDeNodo(nodo: NodoPunto): Coordenada {
  return [nodo.punto.lat, obtenerLongitudPunto(nodo.punto)];
}

/**
 * Calcula el peso (clave de orden) de un punto candidato una vez que
 * `encontrarVecinoMasCercano` ya devolvio el nodo mas cercano (`nodoA`).
 * Revisa los vecinos ESTRUCTURALES de `nodoA` en la lista enlazada
 * (`anterior`/`siguiente`), no vuelve a correr KNN ni necesita la lista
 * completa. Ver PLAN_MAPA_COMPLETO.md, seccion 6.3, para el detalle de cada
 * caso (entre dos vecinos, extender la cola, extender la cabeza).
 */
export function calcularPesoNuevoPunto(
  candidato: Coordenada,
  nodoA: NodoPunto
): ResultadoRecalculoPeso {
  const vecinoAntes = nodoA.anterior;
  const vecinoDespues = nodoA.siguiente;

  // Caso 1: nodoA tiene vecino real a ambos lados. El candidato cae entre
  // nodoA y alguno de esos dos vecinos; se compara a cual se acerca mas.
  if (vecinoAntes && vecinoDespues) {
    const candidatoVsAntes = calcularDistanciaMetros(candidato, coordenadaDeNodo(vecinoAntes));
    const candidatoVsDespues = calcularDistanciaMetros(candidato, coordenadaDeNodo(vecinoDespues));

    if (candidatoVsAntes <= candidatoVsDespues) {
      return {
        peso: (nodoA.punto.peso + vecinoAntes.punto.peso) / 2,
        insertarJuntoA: vecinoAntes,
        posicion: "despues",
      };
    }

    return {
      peso: (nodoA.punto.peso + vecinoDespues.punto.peso) / 2,
      insertarJuntoA: nodoA,
      posicion: "despues",
    };
  }

  // Caso 2: nodoA es la cabeza (solo tiene vecinoDespues). El candidato
  // puede caer entre nodoA y ese vecino, o extender la ruta antes de la
  // cabeza. Se compara la distancia del candidato al vecino contra la
  // distancia real entre nodoA y ese vecino: si el candidato queda mas
  // cerca del vecino que nodoA mismo, esta "entre" los dos; si queda mas
  // lejos, es porque el candidato se aleja de nodoA en direccion contraria
  // al vecino, es decir, extiende la ruta antes de la cabeza.
  if (vecinoDespues) {
    const distanciaNodoAVecino = calcularDistanciaMetros(coordenadaDeNodo(nodoA), coordenadaDeNodo(vecinoDespues));
    const candidatoVsVecino = calcularDistanciaMetros(candidato, coordenadaDeNodo(vecinoDespues));

    if (candidatoVsVecino <= distanciaNodoAVecino) {
      return {
        peso: (nodoA.punto.peso + vecinoDespues.punto.peso) / 2,
        insertarJuntoA: nodoA,
        posicion: "despues",
      };
    }

    return {
      peso: (0 + nodoA.punto.peso) / 2,
      insertarJuntoA: nodoA,
      posicion: "antes",
    };
  }

  // Caso 3: nodoA es la cola (solo tiene vecinoAntes). Simetrico al caso 2.
  if (vecinoAntes) {
    const distanciaNodoAVecino = calcularDistanciaMetros(coordenadaDeNodo(nodoA), coordenadaDeNodo(vecinoAntes));
    const candidatoVsVecino = calcularDistanciaMetros(candidato, coordenadaDeNodo(vecinoAntes));

    if (candidatoVsVecino <= distanciaNodoAVecino) {
      return {
        peso: (nodoA.punto.peso + vecinoAntes.punto.peso) / 2,
        insertarJuntoA: vecinoAntes,
        posicion: "despues",
      };
    }

    return {
      peso: nodoA.punto.peso + PESO_BASE,
      insertarJuntoA: nodoA,
      posicion: "despues",
    };
  }

  // Caso 4: nodoA no tiene ningun vecino (es el unico punto de la ruta).
  return {
    peso: nodoA.punto.peso + PESO_BASE,
    insertarJuntoA: nodoA,
    posicion: "despues",
  };
}

/**
 * Angulo de giro entre dos segmentos consecutivos (p1->p2 y p2->p3), en
 * grados. 0 grados significa que el segundo segmento sigue exactamente la
 * misma direccion que el primero (linea recta); 90 grados es un giro en
 * angulo recto (esquina real); 180 grados seria un giro en U. Ver
 * PLAN_MAPA_COMPLETO.md, seccion 6.5.
 */
export function calcularAnguloGiro(p1: Coordenada, p2: Coordenada, p3: Coordenada): number {
  const v1: Coordenada = [p2[0] - p1[0], p2[1] - p1[1]];
  const v2: Coordenada = [p3[0] - p2[0], p3[1] - p2[1]];

  const producto = v1[0] * v2[0] + v1[1] * v2[1];
  const magnitud1 = Math.hypot(v1[0], v1[1]);
  const magnitud2 = Math.hypot(v2[0], v2[1]);

  if (magnitud1 === 0 || magnitud2 === 0) {
    return 0;
  }

  const coseno = Math.min(1, Math.max(-1, producto / (magnitud1 * magnitud2)));
  return Math.acos(coseno) * (180 / Math.PI);
}

/**
 * Un giro se dibuja como curva solo si esta DENTRO del rango (ni casi recto
 * ni una esquina real de 90 grados). Fuera de ese rango se deja la conexion
 * recta de siempre.
 */
export function esGiroDeCurva(
  anguloGrados: number,
  minimo: number = UMBRAL_CURVA_MIN_GRADOS,
  maximo: number = UMBRAL_CURVA_MAX_GRADOS
): boolean {
  return anguloGrados >= minimo && anguloGrados <= maximo;
}

function puntoCatmullRom(p0: Coordenada, p1: Coordenada, p2: Coordenada, p3: Coordenada, t: number): Coordenada {
  const t2 = t * t;
  const t3 = t2 * t;

  const calcularEje = (v0: number, v1: number, v2: number, v3: number): number =>
    0.5 *
    (2 * v1 +
      (-v0 + v2) * t +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
      (-v0 + 3 * v1 - 3 * v2 + v3) * t3);

  return [calcularEje(p0[0], p1[0], p2[0], p3[0]), calcularEje(p0[1], p1[1], p2[1], p3[1])];
}

/**
 * Genera la geometria VISUAL a partir de los puntos de control reales. Los
 * tramos donde el giro cae en el rango de curva (`esGiroDeCurva`) se
 * reemplazan por puntos interpolados con Catmull-Rom; el resto se deja
 * igual que hoy, como linea recta entre puntos. No cambia lo que se guarda
 * ni lo que se manda a backend: eso sigue siendo `puntos` tal cual: esta
 * funcion solo se usa para dibujar la `Polyline`. Ver PLAN_MAPA_COMPLETO.md,
 * seccion 6.5.
 */
export function generarGeometriaVisual(puntos: Coordenada[], pasosPorCurva = 8): Coordenada[] {
  if (puntos.length < 3) {
    return puntos;
  }

  const resultado: Coordenada[] = [puntos[0]];

  for (let i = 0; i < puntos.length - 1; i += 1) {
    const anterior = puntos[i - 1] ?? puntos[i];
    const actual = puntos[i];
    const siguiente = puntos[i + 1];
    const posterior = puntos[i + 2] ?? puntos[i + 1];

    const anguloEnActual = i > 0 ? calcularAnguloGiro(puntos[i - 1], actual, siguiente) : 0;
    const anguloEnSiguiente = i + 2 < puntos.length ? calcularAnguloGiro(actual, siguiente, puntos[i + 2]) : 0;

    const esCurva = esGiroDeCurva(anguloEnActual) || esGiroDeCurva(anguloEnSiguiente);

    if (!esCurva) {
      resultado.push(siguiente);
      continue;
    }

    for (let paso = 1; paso <= pasosPorCurva; paso += 1) {
      // El ultimo paso deberia coincidir matematicamente con "siguiente",
      // pero por precision de punto flotante puede quedar con un error
      // minusculo; se usa el punto real para que la curva siempre encaje
      // exacto con los puntos de control.
      if (paso === pasosPorCurva) {
        resultado.push(siguiente);
        break;
      }

      const t = paso / pasosPorCurva;
      resultado.push(puntoCatmullRom(anterior, actual, siguiente, posterior, t));
    }
  }

  return resultado;
}
