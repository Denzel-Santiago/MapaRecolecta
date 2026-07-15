import type { RutaDiseñada } from "../models/rutaDiseñada";
import { apiRequest } from "./api";

export interface PuntoRutaBackend {
  latitud: number;
  longitud: number;
}

export interface CrearRutaRequest {
  nombre: string;
  descripcion: string;
  json_ruta: PuntoRutaBackend[];
}

export interface CrearRutaResponse {
  success: boolean;
  data: {
    ruta_id: number;
    nombre: string;
    descripcion: string;
    json_ruta: PuntoRutaBackend[];
    eliminado: boolean;
    created_at: string;
  };
}

export function construirJsonRuta(ruta: RutaDiseñada): PuntoRutaBackend[] {
  return [...ruta.puntos]
    .sort((a, b) => a.orden - b.orden)
    .map(({ lat, lng }) => ({
      latitud: lat,
      longitud: lng,
    }));
}

export function construirRutaBackend(ruta: RutaDiseñada): CrearRutaRequest {
  return {
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    json_ruta: construirJsonRuta(ruta),
  };
}

export async function guardarRuta(ruta: RutaDiseñada): Promise<CrearRutaResponse> {
  const payload = construirRutaBackend(ruta);
  const body = JSON.stringify(payload);

  console.group("[rutasApi] POST /api/rutas/");
  console.log("ruta local (antes de mapear):", ruta);
  console.log("JSON enviado (objeto):", payload);
  console.log("JSON enviado (string):", body);
  console.log("puntos en json_ruta:", payload.json_ruta.length);
  console.groupEnd();

  try {
    const respuesta = await apiRequest<CrearRutaResponse>("/api/rutas/", {
      method: "POST",
      body,
    });

    console.group("[rutasApi] respuesta OK");
    console.log(respuesta);
    console.groupEnd();

    return respuesta;
  } catch (error) {
    console.group("[rutasApi] error al guardar");
    console.error(error);
    console.groupEnd();
    throw error;
  }
}
