import { DISTANCIA_MINIMA_DUPLICADO_METROS, PESO_BASE, UMBRAL_VECINO_METROS } from "../constants/mapa";
import type { Coordenada } from "../models/geo";
import { ListaRuta, type PuntoConPeso } from "../models/listaRuta";
import type { PuntoRuta } from "../models/rutaDiseñada";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { calcularPesoNuevoPunto, encontrarVecinoMasCercano } from "./mapaGeoService";

/**
 * Orquesta el bloque "Guardar el punto para recalcular (KNN + peso)" del
 * modo detector. Ver PLAN_MAPA_COMPLETO.md, seccion 6.
 *
 * `conectados` es la cadena ya enlazada (peso > 0, en su orden real).
 * `pendientes` son puntos sin vecino cercano (peso = 0), sueltos, sin
 * Polyline, hasta que otra deteccion los conecte.
 *
 * Esta funcion no toca React ni estado global: recibe arreglos, arma una
 * ListaRuta temporal, la muta con las operaciones ya probadas de Fase 1/2, y
 * devuelve arreglos nuevos. Eso la hace facil de probar con Node puro.
 */
export interface ResultadoDeteccion {
  conectados: PuntoConPeso[];
  pendientes: PuntoConPeso[];
  /**
   * true si la deteccion se ignoro por estar demasiado cerca de un punto ya
   * guardado (Fase 4: evitar puntos redundantes). Cuando es true,
   * `conectados` y `pendientes` se devuelven sin cambios.
   */
  duplicado?: boolean;
}

function coordenadaDePunto(punto: PuntoConPeso): Coordenada {
  return [punto.lat, obtenerLongitudPunto(punto)];
}

function puntoCandidatoBase(candidato: Coordenada, peso: number): PuntoConPeso {
  return {
    punto_id: null,
    // orden es solo un valor temporal mientras se esta en modo detector; el
    // orden real sale de recorrer la lista al guardar (seccion 6.4).
    orden: 0,
    lat: candidato[0],
    lon: candidato[1],
    lng: candidato[1],
    peso,
  };
}

export function procesarDeteccion(
  candidato: Coordenada,
  conectados: PuntoConPeso[],
  pendientes: PuntoConPeso[],
  umbralMetros: number = UMBRAL_VECINO_METROS,
  distanciaMinimaDuplicado: number = DISTANCIA_MINIMA_DUPLICADO_METROS
): ResultadoDeteccion {
  const lista = ListaRuta.desdeArray(conectados);
  const nodos = lista.nodosEnOrden();

  const candidatosTotales = [
    ...nodos.map((nodo, indice) => ({ id: `lista-${indice}`, coordenada: coordenadaDePunto(nodo.punto) })),
    ...pendientes.map((punto, indice) => ({ id: `pendiente-${indice}`, coordenada: coordenadaDePunto(punto) })),
  ];

  const vecino = encontrarVecinoMasCercano(candidato, candidatosTotales);

  // El candidato esta demasiado cerca de un punto ya guardado (conectado o
  // pendiente): se ignora la deteccion en vez de crear un punto redundante.
  if (vecino && vecino.distancia < distanciaMinimaDuplicado) {
    return { conectados, pendientes, duplicado: true };
  }

  // Ruta completamente vacia: el candidato es el primer punto de la ruta.
  if (!vecino) {
    lista.insertarAlFinal(puntoCandidatoBase(candidato, PESO_BASE));
    return { conectados: lista.aArrayEnOrden(), pendientes };
  }

  // Ningun vecino dentro del umbral: el punto queda pendiente de conectar.
  if (vecino.distancia > umbralMetros) {
    return { conectados, pendientes: [...pendientes, puntoCandidatoBase(candidato, 0)] };
  }

  // El vecino mas cercano es un punto pendiente: se reconecta a la cadena.
  // Simplificacion deliberada (ver PLAN_MAPA_COMPLETO.md, seccion 7): en vez
  // de calcular la posicion geometrica optima para el punto que estaba
  // pendiente, se le agrega al final de la cadena y el candidato lo sigue.
  if (vecino.id.startsWith("pendiente-")) {
    const indice = Number(vecino.id.split("-")[1]);
    const pendiente = pendientes[indice];
    const restoPendientes = pendientes.filter((_, i) => i !== indice);

    const pesoPromovido = lista.cola ? lista.cola.punto.peso + PESO_BASE : PESO_BASE;
    lista.insertarAlFinal({ ...pendiente, peso: pesoPromovido });
    lista.insertarAlFinal(puntoCandidatoBase(candidato, pesoPromovido + PESO_BASE));

    return { conectados: lista.aArrayEnOrden(), pendientes: restoPendientes };
  }

  // Caso normal: el vecino mas cercano ya esta conectado en la cadena.
  const indiceNodo = Number(vecino.id.split("-")[1]);
  const nodoA = nodos[indiceNodo];
  const resultado = calcularPesoNuevoPunto(candidato, nodoA);
  const nuevo = puntoCandidatoBase(candidato, resultado.peso);

  if (resultado.posicion === "despues") {
    lista.insertarDespuesDe(resultado.insertarJuntoA, nuevo);
  } else {
    lista.insertarAntesDe(resultado.insertarJuntoA, nuevo);
  }

  if (lista.necesitaRenumerar()) {
    lista.renumerarPesos();
  }

  return { conectados: lista.aArrayEnOrden(), pendientes };
}

/**
 * Convierte los puntos ya persistidos de una ruta (orden secuencial) a
 * `PuntoConPeso`, para poder cargarlos en el modo detector al editar una
 * ruta existente. Se asigna un peso limpio en multiplos de PESO_BASE
 * respetando el orden ya guardado; no se corre KNN aqui porque el orden ya
 * es confiable.
 */
export function puntosRutaAConPeso(puntos: PuntoRuta[]): PuntoConPeso[] {
  return [...puntos]
    .sort((a, b) => a.orden - b.orden)
    .map((punto, indice) => ({
      ...punto,
      peso: PESO_BASE * (indice + 1),
    }));
}
