import { useCallback, useState } from "react";
import type { RutaDiseñada } from "../models/rutaDiseñada";
export function useRutasDiseñadas() {
  const [rutasDiseñadas, setRutasDiseñadas] = useState<RutaDiseñada[]>([]);
  const guardarRuta = useCallback((ruta: RutaDiseñada) => setRutasDiseñadas((actuales) => {
    const existe = actuales.some(({ camion_id }) => camion_id === ruta.camion_id);
    const siguientes = existe ? actuales.map((actual) => actual.camion_id === ruta.camion_id ? ruta : actual) : [...actuales, ruta];
    return siguientes.sort((a, b) => a.camion_id - b.camion_id);
  }), []);
  const eliminarRuta = useCallback((camionId: number) => setRutasDiseñadas((actuales) => actuales.filter(({ camion_id }) => camion_id !== camionId)), []);
  const obtenerRutaPorCamion = useCallback((camionId: number) => rutasDiseñadas.find(({ camion_id }) => camion_id === camionId), [rutasDiseñadas]);
  return { rutasDiseñadas, guardarRuta, eliminarRuta, obtenerRutaPorCamion };
}
