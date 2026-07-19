import { SUCHIAPA_BOUNDS } from "../constants/mapa";
import type { Coordenada, CoordenadaDTO } from "../models/geo";

export function normalizarCoordenada([latitud, longitud]: Coordenada): Coordenada {
  return [Number(latitud), Number(longitud)];
}

export function coordenadaToDTO(coordenada: Coordenada): CoordenadaDTO {
  const [latitud, longitud] = normalizarCoordenada(coordenada);
  return { latitud, longitud };
}

export function dtoToCoordenada({ latitud, longitud }: CoordenadaDTO): Coordenada {
  return normalizarCoordenada([latitud, longitud]);
}

export function rutaToDTO(ruta: Coordenada[]): CoordenadaDTO[] {
  return ruta.map(coordenadaToDTO);
}

export function estaDentroDeLimites(
  [latitud, longitud]: Coordenada,
  [puntoMin, puntoMax]: [Coordenada, Coordenada] = SUCHIAPA_BOUNDS
): boolean {
  const [latMin, lngMin] = puntoMin;
  const [latMax, lngMax] = puntoMax;

  return latitud >= latMin && latitud <= latMax && longitud >= lngMin && longitud <= lngMax;
}

export function estaDentroDeSuchiapa(coordenada: Coordenada): boolean {
  return estaDentroDeLimites(coordenada, SUCHIAPA_BOUNDS);
}

export function validarRutaEnSuchiapa(ruta: Coordenada[]): boolean {
  return ruta.every(estaDentroDeSuchiapa);
}

export function calcularDistanciaMetros(origen: Coordenada, destino: Coordenada): number {
  const radioTierraMetros = 6371000;
  const gradosARadianes = Math.PI / 180;
  const [latOrigen, lngOrigen] = origen;
  const [latDestino, lngDestino] = destino;
  const deltaLat = (latDestino - latOrigen) * gradosARadianes;
  const deltaLng = (lngDestino - lngOrigen) * gradosARadianes;
  const latOrigenRad = latOrigen * gradosARadianes;
  const latDestinoRad = latDestino * gradosARadianes;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latOrigenRad) * Math.cos(latDestinoRad) * Math.sin(deltaLng / 2) ** 2;

  return 2 * radioTierraMetros * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
