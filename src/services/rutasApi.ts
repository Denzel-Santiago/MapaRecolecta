import type { PuntoRuta, RutaDiseñada } from "../models/rutaDiseñada";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { obtenerColorCamion } from "../utils/ColoresCamion";
import { apiRequest } from "./api";

export interface PuntoRutaBackend {
  latitud?: number;
  longitud?: number;
  lat?: number;
  lon?: number;
  lng?: number;
  // string: asi lo declara la entidad real PuntoRecoleccion en backend.
  cp?: string;
  // orden: la tabla ya tiene esta columna, pero el backend todavia no la
  // lee/escribe (ver PLAN_DE_SEGUIMIENTO.md seccion 14.3). Se deja aqui
  // por si backend empieza a devolverla.
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

// Backend real hoy no guarda camion_id dentro de Ruta (confirmado en
// PLAN_DE_SEGUIMIENTO.md seccion 14.1). Si en el futuro empieza a
// devolverlo, se recoge aqui como fallback; mientras tanto, la resolucion
// real de camion_id se hace por separado con rutaCamionApi.
function obtenerCamionId(ruta: RutaBackend): number | null {
  return ruta.camion_id ?? ruta.camionId ?? null;
}

export function construirJsonRuta(ruta: RutaDiseñada): PuntoRutaBackend[] {
  return [...ruta.puntos]
    .sort((a, b) => a.orden - b.orden)
    .map((punto) => ({
      latitud: punto.lat,
      longitud: obtenerLongitudPunto(punto),
    }));
}

// El backend real de /api/rutas/ solo acepta nombre, descripcion y
// json_ruta (ver PLAN_DE_SEGUIMIENTO.md seccion 5): camion_id y color no
// se envian porque se ignorarian silenciosamente. La asignacion de camion
// se persiste aparte con rutaCamionApi.
export function construirRutaBackend(ruta: RutaDiseñada): CrearRutaRequest {
  return {
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    json_ruta: construirJsonRuta(ruta),
  };
}

export function backendToPuntoRuta(punto: PuntoRutaBackend, index: number): PuntoRuta {
  const lon = punto.lon ?? punto.lng ?? punto.longitud ?? 0;
  const cpComoNumero = punto.cp !== undefined ? Number(punto.cp) : undefined;
  const cpEsNumeroValido = cpComoNumero !== undefined && !Number.isNaN(cpComoNumero);

  return {
    punto_id: punto.punto_id ?? punto.id ?? null,
    cp: punto.cp ?? String(punto.orden ?? index + 1),
    orden: punto.orden ?? (cpEsNumeroValido ? cpComoNumero : index + 1),
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
  const respuesta = await apiRequest<ApiListResponse<RutaBackend>>("/api/rutas/");
  return extraerLista(respuesta).map(backendToRutaDiseñada);
}

export async function obtenerRuta(rutaId: number): Promise<RutaDiseñada> {
  const respuesta = await apiRequest<ApiItemResponse<RutaBackend>>(`/api/rutas/${rutaId}`);
  return backendToRutaDiseñada(extraerData(respuesta));
}

export async function guardarRuta(ruta: RutaDiseñada): Promise<CrearRutaResponse> {
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

  const respuesta = await apiRequest<ApiItemResponse<RutaBackend>>(`/api/rutas/${ruta.ruta_id}`, {
    method: "PUT",
    body: JSON.stringify(construirRutaBackend(ruta)),
  });

  return backendToRutaDiseñada(extraerData(respuesta));
}

export async function eliminarRutaBackend(rutaId: number): Promise<void> {
  await apiRequest<void>(`/api/rutas/${rutaId}`, {
    method: "DELETE",
  });
}
