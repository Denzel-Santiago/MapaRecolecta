import type { PuntoRuta } from "../models/rutaDiseñada";
import { obtenerLongitudPunto } from "../models/rutaDiseñada";
import { apiRequest } from "./api";
import { backendToPuntoRuta, type PuntoRutaBackend } from "./rutasApi";

export interface PuntoRecoleccionRequest {
  // string: la entidad real PuntoRecoleccion en backend declara `cp` como
  // string (ver PLAN_DE_SEGUIMIENTO.md seccion 5). Enviar numero puede
  // fallar el binding JSON en el backend.
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

export function puntoToBackend(punto: PuntoRuta, rutaId: number): PuntoRecoleccionRequest {
  return {
    cp: punto.cp ?? String(punto.orden),
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
