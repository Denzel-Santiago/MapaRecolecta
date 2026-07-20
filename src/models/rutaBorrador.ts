import type { PuntoRuta, RutaDiseñada } from "./rutaDiseñada";
import { obtenerLongitudPunto } from "./rutaDiseñada";

/**
 * Modelo de borrador definido por PLAN_ADAPTACION_ADMIN.md (seccion 5).
 *
 * Esta es la Fase 1 de ese plan: solo modelos y el adaptador desde
 * RutaDiseñada. La deteccion de cambios (nuevo/movido/reordenado/eliminado)
 * y la construccion del payload de sincronizacion se hacen en la Fase 2
 * (src/services/rutaBorradorService.ts), todavia no implementada.
 *
 * El flujo actual de guardado (MapaDiseñador.tsx + reemplazarPuntosDeRuta)
 * no se toca en esta fase: sigue funcionando igual. Este modelo se agrega
 * en paralelo, sin romper nada existente (PLAN_ADAPTACION_ADMIN.md seccion 4,
 * "Principio de compatibilidad").
 */

export type EstadoPuntoBorrador =
  | "sin_cambios"
  | "nuevo"
  | "movido"
  | "reordenado"
  | "eliminado";

export interface PuntoBorrador {
  punto_id: number | string;
  ruta_id: number;
  cp: string;
  lat: number;
  lon: number;
  orden: number;
  latOriginal?: number;
  lonOriginal?: number;
  ordenOriginal?: number;
  estado: EstadoPuntoBorrador;
}

export type EstadoRutaBorrador = "editando" | "calculando" | "valida" | "error";

export interface RutaBorrador {
  ruta_id: number;
  // Se agrega respecto al modelo original del plan: RutaDiseñada.camion_id
  // ya es number | null (se resuelve via rutaCamionApi, ver
  // PLAN_DE_SEGUIMIENTO.md seccion 14.2), asi que el borrador lo hereda.
  camion_id: number | null;
  puntos: PuntoBorrador[];
  puntosEliminados: number[];
  geometriaPrevia: [number, number][];
  distanciaMetros: number;
  duracionSegundos: number;
  estado: EstadoRutaBorrador;
  errores: string[];
}

/**
 * Estado de publicacion de una ruta (PLAN_ADAPTACION_ADMIN.md seccion 5.4).
 * Backend todavia no soporta esto (ver PLAN_DE_SEGUIMIENTO.md seccion 14.4).
 * Se documenta aqui para cuando exista; no se usa todavia en ningun flujo.
 */
export type EstadoPublicacionRuta =
  | "BORRADOR"
  | "VALIDANDO"
  | "VALIDA"
  | "ERROR"
  | "PUBLICADA";

let contadorIdTemporal = 0;

/**
 * Genera un identificador temporal solo-frontend para un punto nuevo,
 * con el formato `temp_xxx` descrito en PLAN_ADAPTACION_ADMIN.md seccion
 * 7.2. Nunca debe enviarse a backend como si fuera un id real.
 */
export function generarIdTemporal(): string {
  contadorIdTemporal += 1;
  return `temp_${Date.now()}_${contadorIdTemporal}`;
}

export function esIdTemporal(puntoId: number | string): puntoId is string {
  return typeof puntoId === "string" && puntoId.startsWith("temp_");
}

/**
 * Convierte un PuntoRuta ya persistido (o cargado desde el disenador
 * actual) a un PuntoBorrador en estado "sin_cambios", guardando sus
 * valores originales para poder detectar despues si se movio o
 * reordeno (PLAN_ADAPTACION_ADMIN.md seccion 7).
 *
 * Si el punto no tiene punto_id real (caso raro para una ruta ya
 * guardada), se le asigna un id temporal en vez de fallar.
 */
export function puntoRutaABorrador(punto: PuntoRuta, rutaId: number): PuntoBorrador {
  const lon = obtenerLongitudPunto(punto);
  const puntoId = punto.punto_id ?? generarIdTemporal();

  return {
    punto_id: puntoId,
    ruta_id: rutaId,
    cp: punto.cp ?? String(punto.orden),
    lat: punto.lat,
    lon,
    orden: punto.orden,
    latOriginal: punto.lat,
    lonOriginal: lon,
    ordenOriginal: punto.orden,
    estado: "sin_cambios",
  };
}

/**
 * Adaptador principal de esta fase: convierte una RutaDiseñada (modelo
 * actual, ya persistida) en un RutaBorrador listo para editar.
 *
 * Requiere que la ruta ya tenga ruta_id. No aplica a una ruta que todavia
 * no se guardo nunca contra backend (esa sigue el flujo de creacion
 * normal, no el de edicion en borrador).
 */
export function rutaDiseñadaABorrador(ruta: RutaDiseñada): RutaBorrador {
  if (ruta.ruta_id === null) {
    throw new Error("No se puede crear un borrador de una ruta sin ruta_id.");
  }

  const rutaId = ruta.ruta_id;

  return {
    ruta_id: rutaId,
    camion_id: ruta.camion_id,
    puntos: ruta.puntos.map((punto) => puntoRutaABorrador(punto, rutaId)),
    puntosEliminados: [],
    geometriaPrevia: [],
    distanciaMetros: 0,
    duracionSegundos: 0,
    estado: "editando",
    errores: [],
  };
}

/**
 * Convierte los puntos de un borrador de vuelta al modelo persistido
 * PuntoRuta (excluyendo los marcados como eliminados), para poder
 * dibujarlos en el mapa o reutilizar el flujo interino de guardado
 * (reemplazarPuntosDeRuta) mientras no exista el endpoint `sync`.
 *
 * Los puntos con id temporal (`temp_xxx`) se envian con punto_id: null,
 * igual que un punto nuevo en el flujo actual.
 */
export function borradorAPuntosRuta(borrador: RutaBorrador): PuntoRuta[] {
  return borrador.puntos
    .filter((punto) => punto.estado !== "eliminado")
    .map((punto) => ({
      punto_id: typeof punto.punto_id === "number" ? punto.punto_id : null,
      cp: punto.cp,
      orden: punto.orden,
      lat: punto.lat,
      lon: punto.lon,
      lng: punto.lon,
    }));
}
