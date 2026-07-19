import type { Coordenada } from "./geo";

export interface PuntoRuta {
  punto_id?: number | null;
  cp?: number;
  orden: number;
  lat: number;
  lng?: number;
  lon?: number;
}

export interface RutaDiseñada {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  camion_id: number;
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
