import { useCallback, useState } from "react";
import type { Coordenada } from "../models/geo";
import { estaDentroDeSuchiapa } from "../services/rutaService";
import { MIN_ROUTE_POINTS } from "../constants/mapa";

export function useRutaDiseñador(initialRuta: Coordenada[] = []) {
  const [puntos, setPuntos] = useState<Coordenada[]>(initialRuta);
  const [error, setError] = useState<string | null>(null);

  const agregarPunto = useCallback((punto: Coordenada) => {
    if (!estaDentroDeSuchiapa(punto)) {
      setError("El punto se encuentra fuera de los límites de Suchiapa.");
      return false;
    }

    setError(null);
    setPuntos((prev) => [...prev, punto]);
    return true;
  }, []);

  const deshacerUltimo = useCallback(() => {
    setError(null);
    setPuntos((prev) => prev.slice(0, -1));
  }, []);

  const limpiarRuta = useCallback(() => {
    setError(null);
    setPuntos([]);
  }, []);

  const reemplazarPuntos = useCallback((ruta: Coordenada[]) => { setError(null); setPuntos(ruta); }, []);
  const editarPunto = useCallback((indice: number, punto: Coordenada) => {
    if (!estaDentroDeSuchiapa(punto)) { setError("El punto se encuentra fuera de los límites de Suchiapa."); return; }
    setError(null);
    setPuntos((prev) => prev.map((actual, posicion) => posicion === indice ? punto : actual));
  }, []);

  const puedeGuardar = puntos.length >= MIN_ROUTE_POINTS;

  return {
    puntos,
    error,
    agregarPunto,
    deshacerUltimo,
    limpiarRuta,
    reemplazarPuntos,
    editarPunto,
    puedeGuardar,
  };
}
