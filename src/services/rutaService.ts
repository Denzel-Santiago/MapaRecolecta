import type { Coordenada, CoordenadaDTO } from "../models/geo";
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
