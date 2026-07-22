import { useCallback, useState } from "react";
import type { Coordenada } from "../models/geo";
import type { RutaBorrador } from "../models/rutaBorrador";
import type { RutaDiseñada } from "../models/rutaDiseñada";
import {
  publicarRuta,
  puedePublicarse,
  rutaDiseñadaARutaBorrador,
  sincronizarConPuntos,
  tieneCambiosPendientes,
  volverABorrador,
} from "../services/rutaBorradorService";

const BORRADOR_VACIO: RutaBorrador = {
  ruta_id: null,
  nombre: "",
  descripcion: "",
  camion_id: 0,
  puntos: [],
  estadoPublicacion: "BORRADOR",
};

/**
 * Capa de borrador (PLAN_MAPA_COMPLETO.md, seccion 5.1 y Fase 7). Envuelve,
 * sin modificarlos, el resultado de cualquiera de los dos flujos de captura
 * que ya existen en el Diseñador (clic libre via useRutaDiseñador, o el modo
 * detector via useDetectorRuta): no reemplaza a ninguno de los dos, solo
 * observa la lista de coordenadas activa (via `sincronizarPuntos`) y
 * mantiene un RutaBorrador al dia.
 *
 * Por ahora esto es solo para tener el borrador listo y visible (ej. un
 * indicador de "cambios sin sincronizar"); el guardado real sigue yendo por
 * el mismo camino de siempre (rutasApi) como respaldo, hasta que la Fase 8
 * conecte de verdad `construirPayloadSync` contra backend.
 */
export function useRutaBorrador() {
  const [borrador, setBorrador] = useState<RutaBorrador>(BORRADOR_VACIO);

  const cargarDesdeRuta = useCallback((ruta: RutaDiseñada | undefined) => {
    setBorrador(ruta ? rutaDiseñadaARutaBorrador(ruta) : BORRADOR_VACIO);
  }, []);

  const sincronizarPuntos = useCallback((coordenadas: Coordenada[]) => {
    setBorrador((actual) => sincronizarConPuntos(actual, coordenadas));
  }, []);

  const limpiarBorrador = useCallback(() => setBorrador(BORRADOR_VACIO), []);

  // Fase 10: publicar/despublicar son transiciones locales (en memoria),
  // porque backend todavia no confirma si maneja un estado de publicacion
  // de ruta (seccion 10 del plan). No se persisten al guardar.
  const publicar = useCallback((geometriaOficial: Coordenada[] | null | undefined) => {
    setBorrador((actual) => publicarRuta(actual, geometriaOficial));
  }, []);

  const despublicar = useCallback(() => {
    setBorrador((actual) => volverABorrador(actual));
  }, []);

  return {
    borrador,
    cargarDesdeRuta,
    sincronizarPuntos,
    limpiarBorrador,
    publicar,
    despublicar,
    puedePublicarse,
    tieneCambiosPendientes: tieneCambiosPendientes(borrador),
  };
}
