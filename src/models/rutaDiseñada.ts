import type { Coordenada } from "./geo";
export type ZonaRuta = "Centro" | "Norte" | "Sur" | "Oriente" | "Poniente";
export type TurnoRuta = "Matutino" | "Vespertino" | "Nocturno";
export type EstadoRuta = "BORRADOR" | "ACTIVA" | "PAUSADA";
export interface PuntoRuta { orden: number; lat: number; lng: number; }
export interface RutaDiseñada { ruta_id: null; nombre: string; camion_id: number; zona: ZonaRuta; turno: TurnoRuta; fecha: string; estado: EstadoRuta; puntos: PuntoRuta[]; }
export interface DatosRutaForm { nombre: string; zona: ZonaRuta; turno: TurnoRuta; fecha: string; estado: EstadoRuta; }
export function puntosRutaACoordenadas(puntos: PuntoRuta[]): Coordenada[] {
  return [...puntos].sort((a, b) => a.orden - b.orden).map(({ lat, lng }) => [lat, lng]);
}
