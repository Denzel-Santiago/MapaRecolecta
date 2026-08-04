import type { Coordenada, CoordenadaDTO } from "../models/geo";
import type { DatosRutaForm, PuntoRuta, RutaDiseñada } from "../models/rutaDiseñada";
import { obtenerColorCamion } from "../utils/ColoresCamion";
import {
  coordenadaToDTO,
  estaDentroDeSuchiapa,
  rutaToDTO,
  validarRutaEnSuchiapa,
} from "./mapaGeoService";

export { coordenadaToDTO, estaDentroDeSuchiapa, rutaToDTO };

export function validarRuta(ruta: Coordenada[]): boolean {
  return validarRutaEnSuchiapa(ruta);
}

export function coordenadasAPuntos(ruta: Coordenada[]): PuntoRuta[] {
  return ruta.map(([lat, lon], index) => ({
    punto_id: null,
    cp: String(index + 1),
    orden: index + 1,
    lat,
    lon,
    lng: lon,
  }));
}

export function crearRutaDiseñada(
  camionId: number,
  datos: DatosRutaForm,
  ruta: Coordenada[],
  rutaId: number | null = null
): RutaDiseñada {
  return {
    ruta_id: rutaId,
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    camion_id: camionId,
    color: obtenerColorCamion(camionId),
    visible: true,
    puntos: coordenadasAPuntos(ruta),
  };
}

export function exportarRutas(rutas: RutaDiseñada[]): RutaDiseñada[] {
  return [...rutas]
    .sort((a, b) => (a.camion_id ?? Number.MAX_SAFE_INTEGER) - (b.camion_id ?? Number.MAX_SAFE_INTEGER))
    .map((ruta) => ({
      ...ruta,
      puntos: ruta.puntos.map((punto) => ({ ...punto })),
      geometria: ruta.geometria ? [...ruta.geometria] : undefined,
    }));
}

export type { CoordenadaDTO };
