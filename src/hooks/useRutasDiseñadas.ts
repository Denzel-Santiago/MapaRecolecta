import { useCallback, useEffect, useMemo, useState } from "react";
import type { RutaDiseñada } from "../models/rutaDiseñada";
import { eliminarRutaBackend, listarRutas } from "../services/rutasApi";
import {
  eliminarAsignacion,
  obtenerAsignacionActivaPorRuta,
} from "../services/rutaCamionApi";
import { eliminarPuntoRecoleccion, listarPuntosPorRuta } from "../services/puntosRecoleccionApi";
import { obtenerColorCamion } from "../utils/ColoresCamion";

export type ModoVisualizacionRutas = "todas" | "una";

function ordenarRutas(rutas: RutaDiseñada[]): RutaDiseñada[] {
  return [...rutas].sort(
    (a, b) => (a.camion_id ?? Number.MAX_SAFE_INTEGER) - (b.camion_id ?? Number.MAX_SAFE_INTEGER)
  );
}

// El backend real no guarda camion_id dentro de Ruta, y api/rutas/ solo
// devuelve los puntos embebidos en json_ruta (sin punto_id real). Para
// cada ruta cargada, se resuelve por separado:
// - el camion asignado, via /api/ruta-camion (PLAN_DE_SEGUIMIENTO.md 14.2);
// - los puntos realmente persistidos en api/puntos-recoleccion, si existen
//   (PLAN_DE_SEGUIMIENTO.md 14.3).
// Si alguna consulta falla para una ruta puntual, esa ruta se mantiene
// visible con lo que ya traia desde json_ruta, en vez de romper toda la
// carga.
async function enriquecerRuta(ruta: RutaDiseñada): Promise<RutaDiseñada> {
  if (ruta.ruta_id === null) {
    return { ...ruta, visible: true };
  }

  const rutaId = ruta.ruta_id;
  const [asignacion, puntosPersistidos] = await Promise.all([
    obtenerAsignacionActivaPorRuta(rutaId).catch(() => null),
    listarPuntosPorRuta(rutaId).catch(() => []),
  ]);

  const camionId = asignacion?.camion_id ?? null;

  return {
    ...ruta,
    camion_id: camionId,
    color: obtenerColorCamion(camionId),
    puntos: puntosPersistidos.length > 0 ? puntosPersistidos : ruta.puntos,
    visible: true,
  };
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
      const rutasCompletas = await Promise.all(rutas.map(enriquecerRuta));
      setRutasDiseñadas(ordenarRutas(rutasCompletas));
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
      // Backend no elimina en cascada la asignacion ruta-camion al borrar
      // una ruta (ver PLAN_DE_SEGUIMIENTO.md seccion 14.2). Se intenta
      // limpiarla explicitamente; si falla, no se bloquea el borrado de
      // la ruta, solo queda un registro huerfano que backend debera
      // resolver a futuro.
      try {
        const asignacion = await obtenerAsignacionActivaPorRuta(ruta.ruta_id);
        if (asignacion?.ruta_camion_id) {
          await eliminarAsignacion(asignacion.ruta_camion_id);
        }
      } catch (err) {
        console.error("No se pudo eliminar la asignacion ruta-camion:", err);
      }

      // Backend tampoco elimina en cascada los puntos de recoleccion al
      // borrar una ruta (ver PLAN_DE_SEGUIMIENTO.md seccion 14.1). Se
      // eliminan explicitamente, en el mismo criterio best-effort de
      // arriba: si falla, no se bloquea el borrado de la ruta.
      try {
        const puntosDeRuta = await listarPuntosPorRuta(ruta.ruta_id);
        await Promise.all(
          puntosDeRuta
            .map((punto) => punto.punto_id)
            .filter((puntoId): puntoId is number => typeof puntoId === "number")
            .map((puntoId) => eliminarPuntoRecoleccion(puntoId))
        );
      } catch (err) {
        console.error("No se pudieron eliminar los puntos de la ruta:", err);
      }

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
