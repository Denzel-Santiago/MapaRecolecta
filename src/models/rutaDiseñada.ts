import type { Coordenada } from "./geo";

export interface PuntoRuta {
  punto_id?: number | null;
  // string: asi lo espera el backend real (ver PLAN_DE_SEGUIMIENTO.md
  // seccion 5). El orden para ordenar/sincronizar se maneja con `orden`.
  cp?: string;
  orden: number;
  lat: number;
  lng?: number;
  lon?: number;
}

export interface RutaDiseñada {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  // Puede ser null mientras no se resuelve la asignacion real via
  // rutaCamionApi (backend no guarda camion_id dentro de Ruta).
  camion_id: number | null;
  color?: string;
  visible?: boolean;
  puntos: PuntoRuta[];
}

export interface DatosRutaForm {
  nombre: string;
  descripcion: string;
}

export function obtenerLongitudPunto(punto: PuntoRuta): number {
  return punto.lon ?? punto.lng ?? 0;
}

export function puntosRutaACoordenadas(puntos: PuntoRuta[]): Coordenada[] {
  return [...puntos]
    .sort((a, b) => a.orden - b.orden)
    .map((punto) => [punto.lat, obtenerLongitudPunto(punto)]);
}
