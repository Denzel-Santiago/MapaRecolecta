import { apiRequest } from "./api";

/**
 * Servicio para el modulo real de backend `/api/ruta-camion`.
 *
 * Este recurso relaciona una ruta con un camion (asignacion), de forma
 * separada a `Ruta`. La entidad `Ruta` en backend NO tiene `camion_id`
 * embebido: hay que consultar este servicio para saber que camion tiene
 * asignada una ruta, o que ruta tiene asignada un camion.
 *
 * Ver PLAN_ADAPTACION_ADMIN.md seccion 4.2 y 6.1, y PLAN_DE_SEGUIMIENTO.md
 * seccion 14.2 para el detalle del contrato confirmado.
 */

export interface RutaCamionBackend {
  ruta_camion_id?: number;
  ruta_id: number;
  camion_id: number;
  fecha: string;
  created_at?: string;
  eliminado?: boolean;
}

export interface ExisteAsignacionResponse {
  id: number;
  exists: boolean;
}

function ordenarPorFechaDesc(asignaciones: RutaCamionBackend[]): RutaCamionBackend[] {
  return [...asignaciones].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

export async function listarAsignaciones(): Promise<RutaCamionBackend[]> {
  return apiRequest<RutaCamionBackend[]>("/api/ruta-camion/");
}

export async function obtenerAsignacionPorId(id: number): Promise<RutaCamionBackend> {
  return apiRequest<RutaCamionBackend>(`/api/ruta-camion/${id}`);
}

export async function obtenerAsignacionesPorRuta(rutaId: number): Promise<RutaCamionBackend[]> {
  return apiRequest<RutaCamionBackend[]>(`/api/ruta-camion/ruta/${rutaId}`);
}

export async function obtenerAsignacionesPorCamion(camionId: number): Promise<RutaCamionBackend[]> {
  return apiRequest<RutaCamionBackend[]>(`/api/ruta-camion/camion/${camionId}`);
}

/**
 * Devuelve la asignacion vigente (mas reciente por `fecha`) de una ruta,
 * o `null` si la ruta no tiene ningun camion asignado.
 *
 * `ruta_camion` puede acumular historial (varias fechas), por eso no se
 * asume que solo existe un registro por ruta.
 */
export async function obtenerAsignacionActivaPorRuta(rutaId: number): Promise<RutaCamionBackend | null> {
  const asignaciones = await obtenerAsignacionesPorRuta(rutaId);
  const vigentes = asignaciones.filter((asignacion) => !asignacion.eliminado);
  const [masReciente] = ordenarPorFechaDesc(vigentes);
  return masReciente ?? null;
}

export async function existeAsignacion(id: number): Promise<boolean> {
  const respuesta = await apiRequest<ExisteAsignacionResponse>(`/api/ruta-camion/exists/${id}`);
  return respuesta.exists;
}

export async function crearAsignacion(
  rutaId: number,
  camionId: number,
  fecha: string
): Promise<RutaCamionBackend> {
  return apiRequest<RutaCamionBackend>("/api/ruta-camion/", {
    method: "POST",
    body: JSON.stringify({ ruta_id: rutaId, camion_id: camionId, fecha }),
  });
}

export async function actualizarAsignacion(
  id: number,
  rutaId: number,
  camionId: number,
  fecha: string
): Promise<RutaCamionBackend> {
  return apiRequest<RutaCamionBackend>(`/api/ruta-camion/${id}`, {
    method: "PUT",
    body: JSON.stringify({ ruta_id: rutaId, camion_id: camionId, fecha }),
  });
}

export async function eliminarAsignacion(id: number): Promise<void> {
  await apiRequest<{ message: string }>(`/api/ruta-camion/${id}`, {
    method: "DELETE",
  });
}
