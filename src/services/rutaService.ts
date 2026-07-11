import type { Coordenada, CoordenadaDTO } from "../models/geo";
import type { DatosRutaForm, PuntoRuta, RutaDiseñada } from "../models/rutaDiseñada";
import { SUCHIAPA_BOUNDS } from "../constants/mapa";

export function coordenadaToDTO([latitud, longitud]: Coordenada): CoordenadaDTO {
  return { latitud, longitud };
}

export function rutaToDTO(ruta: Coordenada[]): CoordenadaDTO[] {
  return ruta.map(coordenadaToDTO);
}

export function estaDentroDeSuchiapa([latitud, longitud]: Coordenada): boolean {
  const [puntoMin, puntoMax] = SUCHIAPA_BOUNDS;
  const [latMin, lngMin] = puntoMin;
  const [latMax, lngMax] = puntoMax;

  return latitud >= latMin && latitud <= latMax && longitud >= lngMin && longitud <= lngMax;
}

export function validarRuta(ruta: Coordenada[]): boolean {
  return ruta.every(estaDentroDeSuchiapa);
}

export function coordenadasAPuntos(ruta: Coordenada[]): PuntoRuta[] {
  return ruta.map(([lat, lng], index) => ({ orden: index + 1, lat, lng }));
}
export function crearRutaDiseñada(camionId: number, datos: DatosRutaForm, ruta: Coordenada[]): RutaDiseñada {
  return { ruta_id: null, nombre: datos.nombre, camion_id: camionId, zona: datos.zona, turno: datos.turno, fecha: datos.fecha, estado: datos.estado, puntos: coordenadasAPuntos(ruta) };
}
export function exportarRutas(rutas: RutaDiseñada[]): RutaDiseñada[] {
  return [...rutas].sort((a, b) => a.camion_id - b.camion_id).map((ruta) => ({ ...ruta, puntos: ruta.puntos.map((punto) => ({ ...punto })) }));
}
