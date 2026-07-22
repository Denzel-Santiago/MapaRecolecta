import { useCallback, useMemo, useState } from "react";
import { MIN_ROUTE_POINTS } from "../constants/mapa";
import type { Coordenada } from "../models/geo";
import type { PuntoConPeso } from "../models/listaRuta";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { estaDentroDeSuchiapa } from "../services/mapaGeoService";
import { procesarDeteccion } from "../services/detectorRutaService";

/**
 * Estado y flujo del modo detector dentro del Diseñador. Ver
 * PLAN_MAPA_COMPLETO.md, seccion 6, para el detalle de cada bloque:
 *
 * Inicio -> Esperar detector -> Guardar el punto para recalcular (KNN+peso)
 * -> Wipe -> Write points -> Connect points
 *
 * "Esperar detector" se traduce aqui en: un clic en el mapa solo marca un
 * candidato (`candidato`), y no se agrega nada a la ruta hasta que el
 * operador presiona "Detectar punto" (`detectarPunto`). "Wipe"/"Write
 * points"/"Connect points" no requieren logica propia: en React basta con
 * reemplazar el estado (`conectados`/`pendientes`), la vista se redibuja
 * sola.
 */
export function useDetectorRuta() {
  const [conectados, setConectados] = useState<PuntoConPeso[]>([]);
  const [pendientes, setPendientes] = useState<PuntoConPeso[]>([]);
  const [candidato, setCandidato] = useState<Coordenada | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marcarCandidato = useCallback((coordenada: Coordenada) => {
    if (!estaDentroDeSuchiapa(coordenada)) {
      setError("El punto se encuentra fuera de los límites de Suchiapa.");
      return;
    }

    setError(null);
    setCandidato(coordenada);
  }, []);

  const cancelarCandidato = useCallback(() => {
    setCandidato(null);
  }, []);

  const detectarPunto = useCallback(() => {
    if (!candidato) {
      return;
    }

    const resultado = procesarDeteccion(candidato, conectados, pendientes);

    if (resultado.duplicado) {
      setError("Ese punto esta demasiado cerca de uno ya guardado; se ignoro para no duplicarlo.");
      setCandidato(null);
      return;
    }

    setError(null);
    setConectados(resultado.conectados);
    setPendientes(resultado.pendientes);
    setCandidato(null);
  }, [candidato, conectados, pendientes]);

  const limpiarDetector = useCallback(() => {
    setConectados([]);
    setPendientes([]);
    setCandidato(null);
    setError(null);
  }, []);

  const reemplazarConectados = useCallback((puntos: PuntoConPeso[]) => {
    setError(null);
    setPendientes([]);
    setCandidato(null);
    setConectados(puntos);
  }, []);

  const puntosConectados = useMemo<Coordenada[]>(
    () => conectados.map((punto) => [punto.lat, obtenerLongitudPunto(punto)]),
    [conectados]
  );

  const puntosPendientes = useMemo<Coordenada[]>(
    () => pendientes.map((punto) => [punto.lat, obtenerLongitudPunto(punto)]),
    [pendientes]
  );

  const puedeGuardar = conectados.length >= MIN_ROUTE_POINTS;

  return {
    conectados,
    pendientes,
    candidato,
    error,
    marcarCandidato,
    cancelarCandidato,
    detectarPunto,
    limpiarDetector,
    reemplazarConectados,
    puntosConectados,
    puntosPendientes,
    puedeGuardar,
  };
}
