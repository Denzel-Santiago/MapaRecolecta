import type { Coordenada } from "../models/geo";
import type { PuntoRuta } from "../models/rutaDiseñada";
import type { EstadoPuntoBorrador, PuntoBorrador, RutaBorrador } from "../models/rutaBorrador";
import { esIdTemporal, generarIdTemporal } from "../models/rutaBorrador";
import { estaDentroDeSuchiapa } from "./mapaGeoService";
import { MIN_ROUTE_POINTS } from "../constants/mapa";
import {
  actualizarPuntoRecoleccion,
  crearPuntoRecoleccion,
  eliminarPuntoRecoleccion,
  listarPuntosPorRuta,
} from "./puntosRecoleccionApi";

/**
 * Servicio de borrador: Fase 2 de PLAN_ADAPTACION_ADMIN.md.
 *
 * Funciones puras que reciben un RutaBorrador y devuelven un nuevo
 * RutaBorrador con el cambio aplicado (agregar, mover, reordenar, eliminar
 * puntos), mas la construccion del payload para el futuro endpoint
 * POST /api/puntos-recoleccion/sync (todavia no existe en backend, ver
 * PLAN_DE_SEGUIMIENTO.md seccion 14.4).
 *
 * Nada de este archivo se conecta a la UI todavia: esa es la Fase 3. El
 * flujo actual de guardado (MapaDiseñador.tsx + reemplazarPuntosDeRuta)
 * no se toca ni se reemplaza en esta fase.
 */

function puntosOrdenados(puntos: PuntoBorrador[]): PuntoBorrador[] {
  return [...puntos].sort((a, b) => a.orden - b.orden);
}

/**
 * Calcula un valor de orden flotante entre dos vecinos, sin necesidad de
 * renumerar el resto de los puntos (PLAN_ADAPTACION_ADMIN.md secciones 1
 * y 7.2: "ordenamiento flotante").
 */
export function generarOrdenFlotante(anterior?: number, siguiente?: number): number {
  if (anterior === undefined && siguiente === undefined) {
    return 1;
  }

  if (anterior === undefined) {
    return (siguiente as number) - 1;
  }

  if (siguiente === undefined) {
    return anterior + 1;
  }

  return (anterior + siguiente) / 2;
}

/**
 * Geometria provisional: union simple de los puntos vivos ordenados por
 * `orden`. No es geometria oficial por calles (eso es la Fase 5, motor
 * vial); es el fallback documentado en PLAN_ADAPTACION_ADMIN.md seccion 3
 * mientras no exista un motor de ruteo.
 */
export function calcularGeometriaProvisional(puntos: PuntoBorrador[]): Coordenada[] {
  return puntosOrdenados(puntos)
    .filter((punto) => punto.estado !== "eliminado")
    .map((punto): Coordenada => [punto.lat, punto.lon]);
}

function validarMinimos(puntos: PuntoBorrador[]): string[] {
  const vivos = puntos.filter((punto) => punto.estado !== "eliminado");

  if (vivos.length < MIN_ROUTE_POINTS) {
    return [`La ruta necesita al menos ${MIN_ROUTE_POINTS} puntos.`];
  }

  return [];
}

/**
 * Recalcula geometriaPrevia y errores/estado despues de cualquier cambio
 * en los puntos del borrador. Centraliza esta logica para que las
 * funciones de agregar/mover/reordenar/eliminar no la repitan.
 */
function recalcular(borrador: RutaBorrador): RutaBorrador {
  const errores = validarMinimos(borrador.puntos);

  return {
    ...borrador,
    geometriaPrevia: calcularGeometriaProvisional(borrador.puntos),
    errores,
    estado: errores.length > 0 ? "error" : "editando",
  };
}

/**
 * Agrega un punto nuevo al borrador (PLAN_ADAPTACION_ADMIN.md seccion
 * 7.2). Valida limites de Suchiapa antes de agregar; si el punto queda
 * fuera, devuelve el borrador sin cambios salvo por el mensaje en
 * `errores`.
 */
export function agregarPuntoBorrador(borrador: RutaBorrador, coordenada: Coordenada): RutaBorrador {
  if (!estaDentroDeSuchiapa(coordenada)) {
    return { ...borrador, errores: ["El punto se encuentra fuera de los límites de Suchiapa."] };
  }

  const ordenados = puntosOrdenados(borrador.puntos.filter((punto) => punto.estado !== "eliminado"));
  const ultimo = ordenados[ordenados.length - 1];
  const orden = generarOrdenFlotante(ultimo?.orden, undefined);
  const [lat, lon] = coordenada;

  const puntoNuevo: PuntoBorrador = {
    punto_id: generarIdTemporal(),
    ruta_id: borrador.ruta_id,
    cp: String(orden),
    lat,
    lon,
    orden,
    estado: "nuevo",
  };

  return recalcular({ ...borrador, puntos: [...borrador.puntos, puntoNuevo] });
}

/**
 * Mueve un punto existente (PLAN_ADAPTACION_ADMIN.md seccion 7.3).
 *
 * Regla del administrador: un punto real movido se convierte en
 * "eliminado + nuevo" (cambia su punto_id). Un punto temporal (todavia no
 * persistido) simplemente actualiza su posicion en el mismo registro.
 */
export function moverPuntoBorrador(
  borrador: RutaBorrador,
  puntoId: number | string,
  nuevaCoordenada: Coordenada
): RutaBorrador {
  if (!estaDentroDeSuchiapa(nuevaCoordenada)) {
    return { ...borrador, errores: ["El punto se encuentra fuera de los límites de Suchiapa."] };
  }

  const punto = borrador.puntos.find((p) => p.punto_id === puntoId);
  if (!punto) {
    return borrador;
  }

  const [lat, lon] = nuevaCoordenada;

  if (esIdTemporal(punto.punto_id)) {
    const puntos = borrador.puntos.map((p) => (p.punto_id === puntoId ? { ...p, lat, lon } : p));
    return recalcular({ ...borrador, puntos });
  }

  const puntoIdReal = punto.punto_id as number;
  const puntoNuevo: PuntoBorrador = {
    punto_id: generarIdTemporal(),
    ruta_id: borrador.ruta_id,
    cp: punto.cp,
    lat,
    lon,
    orden: punto.orden,
    estado: "nuevo",
  };

  const puntos = borrador.puntos.filter((p) => p.punto_id !== puntoId).concat(puntoNuevo);

  return recalcular({
    ...borrador,
    puntos,
    puntosEliminados: [...borrador.puntosEliminados, puntoIdReal],
  });
}

/**
 * Reordena un punto a una nueva posicion dentro de la lista ordenada de
 * puntos vivos (PLAN_ADAPTACION_ADMIN.md seccion 7.4). `nuevoIndice` es la
 * posicion deseada dentro de esa lista (0 = primero).
 */
export function reordenarPuntoBorrador(
  borrador: RutaBorrador,
  puntoId: number | string,
  nuevoIndice: number
): RutaBorrador {
  const vivos = puntosOrdenados(borrador.puntos.filter((p) => p.estado !== "eliminado"));
  const indiceActual = vivos.findIndex((p) => p.punto_id === puntoId);

  if (indiceActual === -1) {
    return borrador;
  }

  const sinPunto = vivos.filter((p) => p.punto_id !== puntoId);
  const indiceDestino = Math.max(0, Math.min(nuevoIndice, sinPunto.length));
  const anterior = sinPunto[indiceDestino - 1]?.orden;
  const siguiente = sinPunto[indiceDestino]?.orden;
  const nuevoOrden = generarOrdenFlotante(anterior, siguiente);

  const puntos = borrador.puntos.map((p) => {
    if (p.punto_id !== puntoId) {
      return p;
    }

    const estado: EstadoPuntoBorrador = esIdTemporal(p.punto_id) ? "nuevo" : "reordenado";
    return { ...p, orden: nuevoOrden, estado };
  });

  return recalcular({ ...borrador, puntos });
}

/**
 * Elimina un punto del borrador (PLAN_ADAPTACION_ADMIN.md seccion 7.5). Si
 * tiene id real, se registra en puntosEliminados para el guardado
 * posterior. Si es temporal, simplemente desaparece del borrador.
 */
export function eliminarPuntoBorrador(borrador: RutaBorrador, puntoId: number | string): RutaBorrador {
  const punto = borrador.puntos.find((p) => p.punto_id === puntoId);
  if (!punto) {
    return borrador;
  }

  const puntos = borrador.puntos.filter((p) => p.punto_id !== puntoId);
  const puntosEliminados = esIdTemporal(punto.punto_id)
    ? borrador.puntosEliminados
    : [...borrador.puntosEliminados, punto.punto_id as number];

  return recalcular({ ...borrador, puntos, puntosEliminados });
}

/**
 * Reasigna valores de orden limpios (1, 2, 3, ...) a todos los puntos
 * vivos. Util cuando el ordenamiento flotante acumula demasiadas
 * inserciones y los valores empiezan a perder precision
 * (PLAN_ADAPTACION_ADMIN.md seccion 6.3, "normalizar orden").
 */
export function normalizarOrden(borrador: RutaBorrador): RutaBorrador {
  const vivos = puntosOrdenados(borrador.puntos.filter((p) => p.estado !== "eliminado"));
  const eliminados = borrador.puntos.filter((p) => p.estado === "eliminado");

  const vivosNormalizados = vivos.map((punto, index) => ({
    ...punto,
    orden: index + 1,
  }));

  return recalcular({ ...borrador, puntos: [...vivosNormalizados, ...eliminados] });
}

/**
 * Payload propuesto para el futuro endpoint
 * POST /api/puntos-recoleccion/sync (PLAN_ADAPTACION_ADMIN.md seccion
 * 6.2). El endpoint todavia no existe en backend (ver
 * PLAN_DE_SEGUIMIENTO.md seccion 14.4); esta funcion solo construye el
 * payload para cuando se confirme el contrato y se implemente la Fase 4.
 */
export interface SyncPuntosRecoleccionRequest {
  ruta_id: number;
  puntos_nuevos: Array<{
    direccion: string;
    lat: number;
    lon: number;
    orden: number;
  }>;
  puntos_actualizados: Array<{
    punto_id: number;
    orden: number;
  }>;
  puntos_eliminados: number[];
}

export function construirPayloadSync(borrador: RutaBorrador): SyncPuntosRecoleccionRequest {
  const vivos = borrador.puntos.filter((punto) => punto.estado !== "eliminado");

  const puntos_nuevos = vivos
    .filter((punto) => punto.estado === "nuevo")
    .map((punto) => ({
      direccion: punto.cp,
      lat: punto.lat,
      lon: punto.lon,
      orden: punto.orden,
    }));

  const puntos_actualizados = vivos
    .filter((punto) => punto.estado === "reordenado" && typeof punto.punto_id === "number")
    .map((punto) => ({
      punto_id: punto.punto_id as number,
      orden: punto.orden,
    }));

  return {
    ruta_id: borrador.ruta_id,
    puntos_nuevos,
    puntos_actualizados,
    puntos_eliminados: [...borrador.puntosEliminados],
  };
}

/**
 * Guarda un RutaBorrador contra el flujo interino de CRUD individual,
 * mientras no exista `POST /api/puntos-recoleccion/sync` (ver
 * PLAN_DE_SEGUIMIENTO.md seccion 14.4).
 *
 * A diferencia de `reemplazarPuntosDeRuta` (que borra y recrea TODOS los
 * puntos de la ruta), esta funcion es mas precisa: solo crea los puntos
 * nuevos, intenta actualizar los reordenados (hoy sin efecto real en
 * backend porque la columna `orden` todavia no se persiste, ver
 * PLAN_DE_SEGUIMIENTO.md seccion 14.3, pero se envia igual para cuando
 * backend la soporte) y elimina los puntos marcados en
 * `puntosEliminados`. Al final recarga los puntos reales desde backend
 * (PLAN_ADAPTACION_ADMIN.md seccion 8, paso 4).
 */
export async function guardarPuntosBorrador(borrador: RutaBorrador): Promise<PuntoRuta[]> {
  const rutaId = borrador.ruta_id;
  const vivos = borrador.puntos.filter((punto) => punto.estado !== "eliminado");

  const nuevos = vivos.filter((punto) => punto.estado === "nuevo");
  const reordenados = vivos.filter(
    (punto): punto is PuntoBorrador & { punto_id: number } =>
      punto.estado === "reordenado" && typeof punto.punto_id === "number"
  );

  await Promise.all(
    nuevos.map((punto) =>
      crearPuntoRecoleccion(
        { punto_id: null, cp: punto.cp, orden: punto.orden, lat: punto.lat, lon: punto.lon },
        rutaId
      )
    )
  );

  await Promise.all(
    reordenados.map((punto) =>
      actualizarPuntoRecoleccion(
        { punto_id: punto.punto_id, cp: punto.cp, orden: punto.orden, lat: punto.lat, lon: punto.lon },
        rutaId
      )
    )
  );

  await Promise.all(borrador.puntosEliminados.map((puntoId) => eliminarPuntoRecoleccion(puntoId)));

  return listarPuntosPorRuta(rutaId);
}
