import { useEffect, useState } from "react";
import type { Coordenada } from "../models/geo";
import { calcularPorcentajeAvance, obtenerRutaRecorrida } from "../services/monitoreoService";

export function useMonitoreo(ruta: Coordenada[]) {
  const [indiceActual, setIndiceActual] = useState(0);
  const [posicionCamion, setPosicionCamion] = useState<Coordenada | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string>("-");

  useEffect(() => {
    if (ruta.length < 2) {
      setIndiceActual(0);
      setPosicionCamion(null);
      setUltimaActualizacion("-");
      return;
    }

    setIndiceActual(0);
    setPosicionCamion(ruta[0]);
    setUltimaActualizacion(new Date().toLocaleTimeString());

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

    return () => window.clearInterval(intervalo);
  }, [ruta]);

  useEffect(() => {
    if (ruta.length === 0) {
      setPosicionCamion(null);
      return;
    }

    setPosicionCamion(ruta[Math.min(indiceActual, ruta.length - 1)]);
  }, [indiceActual, ruta]);

  const rutaRecorrida = obtenerRutaRecorrida(ruta, indiceActual);
  const porcentajeAvance = calcularPorcentajeAvance(ruta, indiceActual);

  return {
    indiceActual,
    posicionCamion,
    rutaRecorrida,
    porcentajeAvance,
    ultimaActualizacion,
  };
}
