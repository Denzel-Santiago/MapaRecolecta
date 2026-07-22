import type { PuntoRuta, RutaDiseñada } from "../models/rutaDiseñada";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { obtenerColorCamion } from "../utils/ColoresCamion";
import { apiRequest } from "./api";
import {
  OFFLINE_MODE,
  offlineActualizarRuta,
  offlineEliminarRuta,
  offlineGuardarRuta,
  offlineListarRutas,
  offlineObtenerRuta,
} from "./offlineMode";

export interface PuntoRutaBackend {
  latitud?: number;
  longitud?: number;
  lat?: number;
  lon?: number;
  lng?: number;
  /** El backend real de puntos-recoleccion manda cp como string; se tolera number tambien por si acaso. */
  cp?: number | string;
  orden?: number;
  punto_id?: number;
  id?: number;
}

export interface RutaBackend {
  ruta_id?: number;
  id?: number;
  nombre: string;
  descripcion: string;
  camion_id?: number;
  camionId?: number;
  color?: string;
  visible?: boolean;
  json_ruta?: PuntoRutaBackend[];
  puntos?: PuntoRutaBackend[];
  eliminado?: boolean;
  created_at?: string;
}

export interface CrearRutaRequest {
  nombre: string;
  descripcion: string;
  camion_id: number;
  color: string;
  json_ruta: PuntoRutaBackend[];
}

export interface CrearRutaResponse {
  success?: boolean;
  data: RutaBackend;
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

function obtenerRutaId(ruta: RutaBackend): number | null {
  return ruta.ruta_id ?? ruta.id ?? null;
}

function obtenerCamionId(ruta: RutaBackend): number {
  return ruta.camion_id ?? ruta.camionId ?? 0;
}

function rutaOfflineComoBackend(ruta: RutaDiseñada): RutaBackend {
  return {
    ruta_id: ruta.ruta_id ?? undefined,
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    camion_id: ruta.camion_id,
    color: ruta.color,
    visible: ruta.visible,
    puntos: ruta.puntos.map((punto) => ({
      punto_id: punto.punto_id ?? undefined,
      cp: punto.cp,
      orden: punto.orden,
      lat: punto.lat,
      lon: obtenerLongitudPunto(punto),
    })),
  };
}

export function construirJsonRuta(ruta: RutaDiseñada): PuntoRutaBackend[] {
  return [...ruta.puntos]
    .sort((a, b) => a.orden - b.orden)
    .map((punto) => ({
      latitud: punto.lat,
      longitud: obtenerLongitudPunto(punto),
    }));
}

export function construirRutaBackend(ruta: RutaDiseñada): CrearRutaRequest {
  const color = ruta.color ?? obtenerColorCamion(ruta.camion_id);

  return {
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    camion_id: ruta.camion_id,
    color,
    json_ruta: construirJsonRuta(ruta),
  };
}

export function backendToPuntoRuta(punto: PuntoRutaBackend, index: number): PuntoRuta {
  const lon = punto.lon ?? punto.lng ?? punto.longitud ?? 0;
  // cp puede venir como string (asi lo manda /api/puntos-recoleccion real) o
  // number (json_ruta, modo offline); se normaliza a number para uso interno.
  const cpNumero =
    punto.cp !== undefined && punto.cp !== null && punto.cp !== "" ? Number(punto.cp) : undefined;
  const cpValido = cpNumero !== undefined && !Number.isNaN(cpNumero) ? cpNumero : undefined;

  return {
    punto_id: punto.punto_id ?? punto.id ?? null,
    cp: cpValido ?? punto.orden ?? index + 1,
    orden: punto.orden ?? cpValido ?? index + 1,
    lat: punto.lat ?? punto.latitud ?? 0,
    lon,
    lng: lon,
  };
}

export function backendToRutaDiseñada(ruta: RutaBackend): RutaDiseñada {
  const camionId = obtenerCamionId(ruta);
  const puntosBackend = ruta.puntos ?? ruta.json_ruta ?? [];

  return {
    ruta_id: obtenerRutaId(ruta),
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    camion_id: camionId,
    color: ruta.color ?? obtenerColorCamion(camionId),
    visible: ruta.visible ?? true,
    puntos: puntosBackend.map(backendToPuntoRuta),
  };
}

export async function listarRutas(): Promise<RutaDiseñada[]> {
  if (OFFLINE_MODE) {
    return offlineListarRutas();
  }

  const respuesta = await apiRequest<ApiListResponse<RutaBackend>>("/api/rutas/");
  return extraerLista(respuesta).map(backendToRutaDiseñada);
}

export async function obtenerRuta(rutaId: number): Promise<RutaDiseñada> {
  if (OFFLINE_MODE) {
    return offlineObtenerRuta(rutaId);
  }

  const respuesta = await apiRequest<ApiItemResponse<RutaBackend>>(`/api/rutas/${rutaId}`);
  return backendToRutaDiseñada(extraerData(respuesta));
}

export async function guardarRuta(ruta: RutaDiseñada): Promise<CrearRutaResponse> {
  if (OFFLINE_MODE) {
    return { success: true, data: rutaOfflineComoBackend(offlineGuardarRuta(ruta)) };
  }

  const payload = construirRutaBackend(ruta);

  return apiRequest<CrearRutaResponse>("/api/rutas/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function actualizarRuta(ruta: RutaDiseñada): Promise<RutaDiseñada> {
  if (ruta.ruta_id === null) {
    throw new Error("No se puede actualizar una ruta sin ruta_id.");
  }

  if (OFFLINE_MODE) {
    return offlineActualizarRuta(ruta);
  }

  const respuesta = await apiRequest<ApiItemResponse<RutaBackend>>(`/api/rutas/${ruta.ruta_id}`, {
    method: "PUT",
    body: JSON.stringify(construirRutaBackend(ruta)),
  });

  return backendToRutaDiseñada(extraerData(respuesta));
}

export async function eliminarRutaBackend(rutaId: number): Promise<void> {
  if (OFFLINE_MODE) {
    offlineEliminarRuta(rutaId);
    return;
  }

  await apiRequest<void>(`/api/rutas/${rutaId}`, {
    method: "DELETE",
  });
}
