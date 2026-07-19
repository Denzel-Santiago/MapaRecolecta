import { useEffect, useMemo, useState } from "react";
import type { Coordenada } from "../models/geo";
import { calcularPorcentajeAvance, obtenerRutaRecorrida } from "../services/monitoreoService";

export function useMonitoreo(ruta: Coordenada[]) {
  const [indiceActual, setIndiceActual] = useState(0);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>("-");

  useEffect(() => {
    const reset = window.setTimeout(() => {
      setIndiceActual(0);
      setUltimaActualizacion(ruta.length < 2 ? "-" : new Date().toLocaleTimeString());
    }, 0);

    if (ruta.length < 2) {
      return () => window.clearTimeout(reset);
    }

    const intervalo = window.setInterval(() => {
      setIndiceActual((prev) => {
        const siguiente = prev + 1;

        if (siguiente >= ruta.length) {
          window.clearInterval(intervalo);
          return prev;
        }

        setUltimaActualizacion(new Date().toLocaleTimeString());
        return siguiente;
      });
    }, 1000);

    return () => {
      window.clearTimeout(reset);
      window.clearInterval(intervalo);
    };
  }, [ruta]);

  const indiceSeguro = ruta.length === 0 ? 0 : Math.min(indiceActual, ruta.length - 1);

  const posicionCamion = useMemo<Coordenada | null>(() => {
    if (ruta.length === 0) {
      return null;
    }

    return ruta[indiceSeguro];
  }, [indiceSeguro, ruta]);

  const rutaRecorrida = obtenerRutaRecorrida(ruta, indiceSeguro);
  const porcentajeAvance = calcularPorcentajeAvance(ruta, indiceSeguro);

  return {
    indiceActual: indiceSeguro,
    posicionCamion,
    rutaRecorrida,
    porcentajeAvance,
    ultimaActualizacion,
  };
}
