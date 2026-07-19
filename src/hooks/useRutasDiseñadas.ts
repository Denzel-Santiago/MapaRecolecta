import { useCallback, useEffect, useMemo, useState } from "react";
import type { RutaDiseñada } from "../models/rutaDiseñada";
import { eliminarRutaBackend, listarRutas } from "../services/rutasApi";

export type ModoVisualizacionRutas = "todas" | "una";

function ordenarRutas(rutas: RutaDiseñada[]): RutaDiseñada[] {
  return [...rutas].sort((a, b) => a.camion_id - b.camion_id);
}

function coincideRuta(a: RutaDiseñada, b: RutaDiseñada): boolean {
  if (a.ruta_id !== null && b.ruta_id !== null) {
    return a.ruta_id === b.ruta_id;
  }

  return a.camion_id === b.camion_id;
}

export function useRutasDiseñadas() {
  const [rutasDiseñadas, setRutasDiseñadas] = useState<RutaDiseñada[]>([]);
  const [rutaSeleccionadaId, setRutaSeleccionadaId] = useState<number | null>(null);
  const [modoVisualizacion, setModoVisualizacion] = useState<ModoVisualizacionRutas>("todas");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarRutas = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const rutas = await listarRutas();
      setRutasDiseñadas(ordenarRutas(rutas.map((ruta) => ({ ...ruta, visible: true }))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las rutas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarRutas();
  }, [cargarRutas]);

  const guardarRuta = useCallback((ruta: RutaDiseñada) => {
    setRutasDiseñadas((actuales) => {
      const rutaNormalizada = { ...ruta, visible: ruta.visible ?? true };
      const existe = actuales.some((actual) => coincideRuta(actual, rutaNormalizada));
      const siguientes = existe
        ? actuales.map((actual) => (coincideRuta(actual, rutaNormalizada) ? rutaNormalizada : actual))
        : [...actuales, rutaNormalizada];

      return ordenarRutas(siguientes);
    });
  }, []);

  const eliminarRuta = useCallback(async (ruta: RutaDiseñada) => {
    if (ruta.ruta_id !== null) {
      await eliminarRutaBackend(ruta.ruta_id);
    }

    setRutasDiseñadas((actuales) => actuales.filter((actual) => !coincideRuta(actual, ruta)));

    if (rutaSeleccionadaId === ruta.ruta_id) {
      setRutaSeleccionadaId(null);
      setModoVisualizacion("todas");
    }
  }, [rutaSeleccionadaId]);

  const obtenerRutaPorCamion = useCallback(
    (camionId: number) => rutasDiseñadas.find(({ camion_id }) => camion_id === camionId),
    [rutasDiseñadas]
  );

  const seleccionarRuta = useCallback((rutaId: number | null) => {
    setRutaSeleccionadaId(rutaId);
    setModoVisualizacion(rutaId === null ? "todas" : "una");
  }, []);

  const verTodas = useCallback(() => {
    setRutaSeleccionadaId(null);
    setModoVisualizacion("todas");
  }, []);

  const rutasVisibles = useMemo(() => {
    if (modoVisualizacion === "todas" || rutaSeleccionadaId === null) {
      return rutasDiseñadas.filter((ruta) => ruta.visible ?? true);
    }

    return rutasDiseñadas.filter((ruta) => ruta.ruta_id === rutaSeleccionadaId);
  }, [modoVisualizacion, rutaSeleccionadaId, rutasDiseñadas]);

  return {
    rutasDiseñadas,
    rutasVisibles,
    rutaSeleccionadaId,
    modoVisualizacion,
    cargando,
    error,
    cargarRutas,
    guardarRuta,
    eliminarRuta,
    obtenerRutaPorCamion,
    seleccionarRuta,
    verTodas,
  };
}
