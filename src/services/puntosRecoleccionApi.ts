import type { PuntoRuta } from "../models/rutaDiseñada";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { apiRequest } from "./api";
import { backendToPuntoRuta, type PuntoRutaBackend } from "./rutasApi";
import type { PayloadSyncPuntos } from "./rutaBorradorService";

export interface PuntoRecoleccionRequest {
  /** Secuencia/orden de visita del punto, como string (asi lo define el swagger real de backend). */
  cp: string;
  lat: number;
  lon: number;
  ruta_id: number;
}

type ApiListResponse<T> = T[] | { data: T[] };
type ApiItemResponse<T> = T | { data: T };

function extraerData<T>(respuesta: ApiItemResponse<T>): T {
  if (typeof respuesta === "object" && respuesta !== null && "data" in respuesta) {
    return respuesta.data as T;
  }

  return respuesta;
}

function extraerLista<T>(respuesta: ApiListResponse<T>): T[] {
  return Array.isArray(respuesta) ? respuesta : respuesta.data;
}

/**
 * `cp` siempre se deriva de `orden` (nunca de un valor de `cp` guardado por
 * separado): asi la secuencia que se manda a backend es siempre la posicion
 * real y actual del punto en la ruta, sin riesgo de quedar desincronizada
 * si el punto se reordeno despues de asignarsele un `cp` independiente.
 */
export function puntoToBackend(punto: PuntoRuta, rutaId: number): PuntoRecoleccionRequest {
  return {
    cp: String(punto.orden),
    lat: punto.lat,
    lon: obtenerLongitudPunto(punto),
    ruta_id: rutaId,
  };
}

export async function listarPuntosPorRuta(rutaId: number): Promise<PuntoRuta[]> {
  const respuesta = await apiRequest<ApiListResponse<PuntoRutaBackend>>(
    `/api/puntos-recoleccion?ruta_id=${rutaId}`
  );

  return extraerLista(respuesta).map(backendToPuntoRuta);
}

export async function crearPuntoRecoleccion(punto: PuntoRuta, rutaId: number): Promise<PuntoRuta> {
  const respuesta = await apiRequest<ApiItemResponse<PuntoRutaBackend>>("/api/puntos-recoleccion", {
    method: "POST",
    body: JSON.stringify(puntoToBackend(punto, rutaId)),
  });

  return backendToPuntoRuta(extraerData(respuesta), punto.orden - 1);
}

export async function actualizarPuntoRecoleccion(punto: PuntoRuta, rutaId: number): Promise<PuntoRuta> {
  if (!punto.punto_id) {
    throw new Error("No se puede actualizar un punto sin punto_id.");
  }

  const respuesta = await apiRequest<ApiItemResponse<PuntoRutaBackend>>(
    `/api/puntos-recoleccion/${punto.punto_id}`,
    {
      method: "PUT",
      body: JSON.stringify(puntoToBackend(punto, rutaId)),
    }
  );

  return backendToPuntoRuta(extraerData(respuesta), punto.orden - 1);
}

export async function eliminarPuntoRecoleccion(puntoId: number): Promise<void> {
  await apiRequest<void>(`/api/puntos-recoleccion/${puntoId}`, {
    method: "DELETE",
  });
}

export async function reemplazarPuntosDeRuta(rutaId: number, puntos: PuntoRuta[]): Promise<PuntoRuta[]> {
  const puntosActuales = await listarPuntosPorRuta(rutaId);

  await Promise.all(
    puntosActuales
      .map((punto) => punto.punto_id)
      .filter((puntoId): puntoId is number => typeof puntoId === "number")
      .map(eliminarPuntoRecoleccion)
  );

  return Promise.all(puntos.map((punto) => crearPuntoRecoleccion(punto, rutaId)));
}

/** Un punto tal como lo devuelve el endpoint de sync, con su id real ya asignado. */
export interface PuntoSincronizadoBackend {
  punto_id: number;
  cp: number;
  lat: number;
  lon: number;
  orden: number;
}

export interface SyncPuntosResponseBackend {
  nuevos?: PuntoSincronizadoBackend[];
  actualizados?: PuntoSincronizadoBackend[];
  eliminados?: number[];
}

/**
 * POST /api/puntos-recoleccion/sync (PLAN_MAPA_COMPLETO.md, seccion 5.2).
 *
 * CONTRATO NO CONFIRMADO CON BACKEND (seccion 5.4 / Fase 0 bloqueada): el
 * payload (`PayloadSyncPuntos`, definido en `rutaBorradorService.ts` a partir
 * de un `RutaBorrador`) y la forma de la respuesta de aqui abajo son la
 * mejor suposicion a partir de lo que describe el plan, no un contrato
 * verificado. Antes de usar esta funcion desde la UI hay que confirmar con
 * backend si el endpoint existe y con que forma exacta responde.
 */
export async function syncPuntosRecoleccion(
  payload: PayloadSyncPuntos
): Promise<SyncPuntosResponseBackend> {
  const respuesta = await apiRequest<ApiItemResponse<SyncPuntosResponseBackend>>(
    "/api/puntos-recoleccion/sync",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return extraerData(respuesta);
}

/**
 * Sincroniza los puntos de una ruta contra backend y despues recarga los
 * datos frescos (seccion 5.2: "despues del sync, el frontend debe recargar
 * los datos frescos desde backend, con los ids reales ya asignados, antes de
 * seguir"). Todavia no se llama desde ningun componente: queda lista para
 * cuando el contrato de `syncPuntosRecoleccion` se confirme (Fase 0).
 */
export async function sincronizarPuntosDeRuta(
  rutaId: number,
  payload: PayloadSyncPuntos
): Promise<PuntoRuta[]> {
  await syncPuntosRecoleccion(payload);
  return listarPuntosPorRuta(rutaId);
}
