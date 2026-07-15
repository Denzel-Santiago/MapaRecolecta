import type { Coordenada } from "./geo";
export interface PuntoRuta { orden: number; lat: number; lng: number; }
export interface RutaDiseñada {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  camion_id: number;
  puntos: PuntoRuta[];
}
export interface DatosRutaForm { nombre: string; descripcion: string; }
export function puntosRutaACoordenadas(puntos: PuntoRuta[]): Coordenada[] {
  return [...puntos].sort((a, b) => a.orden - b.orden).map(({ lat, lng }) => [lat, lng]);
}
