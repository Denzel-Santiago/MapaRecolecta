import type { Coordenada } from "../models/geo";
import { obtenerLongitudPunto, type PuntoRuta, type RutaDiseñada } from "../models/rutaDiseñada";
import {
  esIdTemporal,
  generarIdTemporal,
  type EstadoPuntoBorrador,
  type PuntoBorrador,
  type RutaBorrador,
} from "../models/rutaBorrador";

/**
 * Regla de publicacion (PLAN_MAPA_COMPLETO.md, secciones 5.3 y 7, punto 6):
 * una ruta solo puede pasar a PUBLICADA si tiene geometria oficial valida
 * (al menos 2 puntos), no una curva provisional. `geometriaOficial` viene de
 * `rutaVialService.obtenerGeometriaVial` (Fase 9).
 */
export function puedePublicarse(geometriaOficial: Coordenada[] | null | undefined): boolean {
  return Array.isArray(geometriaOficial) && geometriaOficial.length >= 2;
}

/**
 * Intenta publicar el borrador. Si no hay geometria oficial valida, queda en
 * ERROR en vez de PUBLICADA (seccion 5.3: publicar es una accion separada de
 * guardar, y no toda ruta guardada esta lista para publicarse).
 */
export function publicarRuta(borrador: RutaBorrador, geometriaOficial: Coordenada[] | null | undefined): RutaBorrador {
  if (!puedePublicarse(geometriaOficial)) {
    return { ...borrador, estadoPublicacion: "ERROR" };
  }

  return { ...borrador, estadoPublicacion: "PUBLICADA" };
}

/** Vuelve a BORRADOR (ej. si el operador quiere seguir editando una ruta ya publicada). */
export function volverABorrador(borrador: RutaBorrador): RutaBorrador {
  return { ...borrador, estadoPublicacion: "BORRADOR" };
}

/**
 * Convierte una RutaDiseñada (la que ya maneja el resto de la app hoy) a un
 * RutaBorrador para editar en memoria sin tocar backend punto por punto.
 * Los puntos que ya tienen punto_id quedan en estado "sin_cambios"; los que
 * no (por ejemplo, si vinieran de un flujo que aun no persiste) se tratan
 * como "nuevo".
 */
export function rutaDiseñadaARutaBorrador(ruta: RutaDiseñada): RutaBorrador {
  const puntosOrdenados = [...ruta.puntos].sort((a, b) => a.orden - b.orden);

  return {
    ruta_id: ruta.ruta_id,
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    camion_id: ruta.camion_id,
    color: ruta.color,
    estadoPublicacion: "BORRADOR",
    puntos: puntosOrdenados.map((punto, index) => ({
      punto_id: punto.punto_id ?? generarIdTemporal(),
      ruta_id: ruta.ruta_id ?? 0,
      cp: punto.cp ?? punto.orden ?? index + 1,
      lat: punto.lat,
      lon: obtenerLongitudPunto(punto),
      orden: punto.orden ?? index + 1,
      estado: punto.punto_id ? "sin_cambios" : "nuevo",
    })),
  };
}

/** Agrega un punto nuevo al borrador con id temporal, al final de la lista. */
export function agregarPuntoBorrador(
  borrador: RutaBorrador,
  coordenada: Coordenada,
  cp?: number
): RutaBorrador {
  const orden = borrador.puntos.length > 0 ? Math.max(...borrador.puntos.map((p) => p.orden)) + 1 : 1;

  const nuevo: PuntoBorrador = {
    punto_id: generarIdTemporal(),
    ruta_id: borrador.ruta_id ?? 0,
    cp: cp ?? orden,
    lat: coordenada[0],
    lon: coordenada[1],
    orden,
    estado: "nuevo",
  };

  return { ...borrador, puntos: [...borrador.puntos, nuevo] };
}

/**
 * Mueve un punto existente a una nueva coordenada.
 *
 * Regla del plan (seccion 5.1): si el punto ya tiene id real, backend no
 * puede "mover" conservando identidad, asi que se marca el viejo como
 * eliminado y se crea uno nuevo con id temporal. Si el punto es temporal
 * (nunca se persistio), se actualiza en su lugar sin generar basura.
 */
export function moverPuntoBorrador(
  borrador: RutaBorrador,
  puntoId: number | string,
  nuevaCoordenada: Coordenada
): RutaBorrador {
  const objetivo = borrador.puntos.find((p) => p.punto_id === puntoId);
  if (!objetivo) return borrador;

  if (esIdTemporal(objetivo.punto_id)) {
    return {
      ...borrador,
      puntos: borrador.puntos.map((p) =>
        p.punto_id === puntoId ? { ...p, lat: nuevaCoordenada[0], lon: nuevaCoordenada[1] } : p
      ),
    };
  }

  const marcadoEliminado: PuntoBorrador = { ...objetivo, estado: "eliminado" };
  const reemplazo: PuntoBorrador = {
    punto_id: generarIdTemporal(),
    ruta_id: objetivo.ruta_id,
    cp: objetivo.cp,
    lat: nuevaCoordenada[0],
    lon: nuevaCoordenada[1],
    orden: objetivo.orden,
    estado: "nuevo",
  };

  return {
    ...borrador,
    puntos: borrador.puntos
      .map((p) => (p.punto_id === puntoId ? marcadoEliminado : p))
      .concat(reemplazo),
  };
}

/**
 * Elimina un punto del borrador.
 *
 * Si nunca se persistio (id temporal), se quita del arreglo sin dejar
 * rastro. Si ya existe en backend, se marca como "eliminado" para que
 * `construirPayloadSync` lo incluya en la lista de bajas.
 */
export function eliminarPuntoBorrador(borrador: RutaBorrador, puntoId: number | string): RutaBorrador {
  const objetivo = borrador.puntos.find((p) => p.punto_id === puntoId);
  if (!objetivo) return borrador;

  if (esIdTemporal(objetivo.punto_id)) {
    return { ...borrador, puntos: borrador.puntos.filter((p) => p.punto_id !== puntoId) };
  }

  return {
    ...borrador,
    puntos: borrador.puntos.map((p) =>
      p.punto_id === puntoId ? { ...p, estado: "eliminado" as EstadoPuntoBorrador } : p
    ),
  };
}

/**
 * Cambia el `orden` de un punto (orden flotante, sin renumerar el resto).
 * Un punto que todavia no se persiste sigue siendo "nuevo"; uno que ya
 * existia en backend pasa a "reordenado" para que el sync mande su nuevo
 * orden.
 */
export function reordenarPuntoBorrador(
  borrador: RutaBorrador,
  puntoId: number | string,
  nuevoOrden: number
): RutaBorrador {
  return {
    ...borrador,
    puntos: borrador.puntos.map((p) => {
      if (p.punto_id !== puntoId) return p;
      const estado: EstadoPuntoBorrador = p.estado === "nuevo" ? "nuevo" : "reordenado";
      return { ...p, orden: nuevoOrden, estado };
    }),
  };
}

export function tieneCambiosPendientes(borrador: RutaBorrador): boolean {
  return borrador.puntos.some((p) => p.estado !== "sin_cambios");
}

/** Puntos que se deben mostrar en el mapa: todos menos los eliminados, en su orden. */
export function puntosVisiblesDelBorrador(borrador: RutaBorrador): PuntoBorrador[] {
  return borrador.puntos.filter((p) => p.estado !== "eliminado").sort((a, b) => a.orden - b.orden);
}

export interface PayloadSyncPuntos {
  ruta_id: number;
  nuevos: Array<{ cp: string; lat: number; lon: number; orden: number }>;
  actualizados: Array<{ punto_id: number; cp: string; lat: number; lon: number; orden: number }>;
  eliminados: number[];
}

/**
 * Arma el payload para `POST /api/puntos-recoleccion/sync` (seccion 5.2 del
 * plan). Formato provisional: pendiente de confirmar contra el contrato real
 * de backend (seccion 5.4 / Fase 0).
 *
 * `cp` se manda siempre como `String(p.orden)` -- nunca el `p.cp` guardado
 * aparte -- para que la secuencia que recibe backend sea siempre la
 * posicion real y actual del punto, sin riesgo de quedar desincronizada si
 * el punto se reordeno. Coincide con el tipo `string` que define el swagger
 * real de `PuntoRecoleccion`/`CreatePuntoRecoleccionRequest`.
 */
export function construirPayloadSync(borrador: RutaBorrador): PayloadSyncPuntos {
  if (borrador.ruta_id === null) {
    throw new Error("No se puede sincronizar puntos de una ruta sin ruta_id.");
  }

  const nuevos = borrador.puntos
    .filter((p) => p.estado === "nuevo")
    .map((p) => ({ cp: String(p.orden), lat: p.lat, lon: p.lon, orden: p.orden }));

  const actualizados = borrador.puntos
    .filter((p): p is PuntoBorrador & { punto_id: number } => p.estado === "reordenado" && !esIdTemporal(p.punto_id))
    .map((p) => ({ punto_id: p.punto_id, cp: String(p.orden), lat: p.lat, lon: p.lon, orden: p.orden }));

  const eliminados = borrador.puntos
    .filter((p): p is PuntoBorrador & { punto_id: number } => p.estado === "eliminado" && !esIdTemporal(p.punto_id))
    .map((p) => p.punto_id);

  return { ruta_id: borrador.ruta_id, nuevos, actualizados, eliminados };
}

function clavePorCoordenada(coordenada: Coordenada): string {
  return `${coordenada[0].toFixed(6)},${coordenada[1].toFixed(6)}`;
}

/**
 * Reconcilia el RutaBorrador con la lista de coordenadas actualmente activa
 * en la UI (la que produce useRutaDiseñador en modo clic libre, o
 * useDetectorRuta en modo detector). Esta funcion es la pieza que permite
 * envolver ambos flujos con el borrador (Fase 7) sin tocar su logica interna:
 * ninguno de los dos hooks sabe que existe RutaBorrador, solo se observa su
 * salida (Coordenada[]) despues de cada cambio.
 *
 * Reglas de reconciliacion:
 * - Si una coordenada activa coincide exactamente (hasta 6 decimales) con un
 *   punto ya presente en el borrador, se conserva su identidad (punto_id,
 *   estado) y solo se actualiza su `orden`.
 * - Si no hay coincidencia, se trata como un punto nuevo (id temporal).
 * - Cualquier punto del borrador que ya no aparece en las coordenadas
 *   activas se considera removido: si tenia id temporal desaparece sin dejar
 *   rastro, si tenia id real se marca "eliminado" para que el futuro sync
 *   (Fase 8) lo incluya en la baja.
 *
 * Nota: por eso mover un punto (que cambia sus coordenadas) se ve, desde
 * este mecanismo, igual que "eliminar el viejo y crear uno nuevo" -- es
 * consistente con la regla de `moverPuntoBorrador` en la seccion 5.1 del
 * plan, que dice que un punto con id real nunca conserva su identidad al
 * moverse.
 */
export function sincronizarConPuntos(borrador: RutaBorrador, coordenadas: Coordenada[]): RutaBorrador {
  const restantes = new Map<string, PuntoBorrador>();
  for (const punto of borrador.puntos) {
    if (punto.estado === "eliminado") continue;
    restantes.set(clavePorCoordenada([punto.lat, punto.lon]), punto);
  }

  const puntosActivos: PuntoBorrador[] = coordenadas.map((coordenada, index) => {
    const clave = clavePorCoordenada(coordenada);
    const existente = restantes.get(clave);

    if (existente) {
      restantes.delete(clave);
      return { ...existente, orden: index + 1 };
    }

    return {
      punto_id: generarIdTemporal(),
      ruta_id: borrador.ruta_id ?? 0,
      cp: index + 1,
      lat: coordenada[0],
      lon: coordenada[1],
      orden: index + 1,
      estado: "nuevo",
    };
  });

  const eliminados: PuntoBorrador[] = [...restantes.values()]
    .filter((punto) => !esIdTemporal(punto.punto_id))
    .map((punto) => ({ ...punto, estado: "eliminado" as EstadoPuntoBorrador }));

  return { ...borrador, puntos: [...puntosActivos, ...eliminados] };
}

/**
 * Vuelve a RutaDiseñada para reutilizar el resto de la app (dibujo, guardado
 * actual via rutasApi) mientras el flujo de sync todavia no esta conectado.
 * Los ids temporales se devuelven como null (todavia sin id real).
 */
export function rutaBorradorARutaDiseñada(borrador: RutaBorrador): RutaDiseñada {
  const visibles = puntosVisiblesDelBorrador(borrador);

  return {
    ruta_id: borrador.ruta_id,
    nombre: borrador.nombre,
    descripcion: borrador.descripcion,
    camion_id: borrador.camion_id,
    color: borrador.color,
    puntos: visibles.map((p, index): PuntoRuta => ({
      punto_id: esIdTemporal(p.punto_id) ? null : p.punto_id,
      cp: p.cp,
      orden: index + 1,
      lat: p.lat,
      lon: p.lon,
    })),
  };
}
