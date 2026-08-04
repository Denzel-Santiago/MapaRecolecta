import type { Coordenada } from "../models/geo";
import {
  ajustarPuntoACalleLocal,
  construirGeometriaLocalPorCalles,
  type PuntoSobreCalle,
} from "./callejeroLocalService";

const OSRM_DEMO_BASE_URL = "https://router.project-osrm.org";
const OSRM_DEFAULT_PROFILE = "driving";

export interface GeometriaVialResultado {
  puntos: Coordenada[];
  distanciaMetros: number;
  duracionSegundos: number;
  origen: "osrm" | "local";
}

interface RespuestaNearestOsrm {
  code?: string;
  waypoints?: Array<{
    location?: [number, number];
    distance?: number;
    name?: string;
  }>;
}

/** Error especifico de este servicio, para poder distinguirlo de otros fallos de red en la UI. */
export class ErrorGeometriaVial extends Error {}

interface RespuestaOsrm {
  code?: string;
  routes?: Array<{
    geometry?: { coordinates?: Array<[number, number]> };
    distance?: number;
    duration?: number;
  }>;
}

function coordenadaAOsrm(coordenada: Coordenada): string {
  // OSRM espera "lon,lat" (al reves que nuestro Coordenada = [lat, lon]).
  return `${coordenada[1]},${coordenada[0]}`;
}

function obtenerPerfilOsrm(perfil?: string): string {
  return perfil || import.meta.env.VITE_OSRM_PROFILE || OSRM_DEFAULT_PROFILE;
}

/**
 * Convierte la respuesta cruda de OSRM (`GET /route/v1/driving/...`) a
 * nuestro formato interno. Funcion pura, separada de `obtenerGeometriaVial`
 * para poder probarla sin hacer una llamada de red real.
 */
export function parsearRespuestaOsrm(json: unknown): GeometriaVialResultado {
  if (typeof json !== "object" || json === null) {
    throw new ErrorGeometriaVial("Respuesta invalida del motor de ruteo.");
  }

  const respuesta = json as RespuestaOsrm;

  if (respuesta.code !== "Ok" || !respuesta.routes || respuesta.routes.length === 0) {
    throw new ErrorGeometriaVial("El motor de ruteo no encontro una ruta valida entre los puntos.");
  }

  const ruta = [...respuesta.routes].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0];
  const coordenadasOsrm = ruta.geometry?.coordinates;

  if (!coordenadasOsrm || coordenadasOsrm.length === 0) {
    throw new ErrorGeometriaVial("La respuesta del motor de ruteo no incluyo geometria.");
  }

  return {
    puntos: coordenadasOsrm.map(([lon, lat]): Coordenada => [lat, lon]),
    distanciaMetros: ruta.distance ?? 0,
    duracionSegundos: ruta.duration ?? 0,
    origen: "osrm",
  };
}

export function parsearRespuestaNearestOsrm(json: unknown): PuntoSobreCalle {
  if (typeof json !== "object" || json === null) {
    throw new ErrorGeometriaVial("Respuesta invalida al validar calle.");
  }

  const respuesta = json as RespuestaNearestOsrm;
  const [waypoint] = respuesta.waypoints ?? [];
  const [lon, lat] = waypoint?.location ?? [];

  if (respuesta.code !== "Ok" || lat === undefined || lon === undefined) {
    throw new ErrorGeometriaVial("No se encontro una calle valida cerca del punto.");
  }

  return {
    coordenada: [lat, lon],
    distanciaMetros: waypoint.distance ?? 0,
    calleId: waypoint.name ?? "osrm",
    nombreCalle: waypoint.name || "Calle detectada",
    tipo: "horizontal",
  };
}

export async function ajustarPuntoACalle(
  punto: Coordenada,
  baseUrl: string = import.meta.env.VITE_OSRM_BASE_URL ?? OSRM_DEMO_BASE_URL,
  perfil?: string
): Promise<PuntoSobreCalle> {
  const fallbackLocal = ajustarPuntoACalleLocal(punto);
  const perfilOsrm = obtenerPerfilOsrm(perfil);

  try {
    const respuesta = await fetch(`${baseUrl}/nearest/v1/${perfilOsrm}/${coordenadaAOsrm(punto)}?number=1`);
    if (!respuesta.ok) {
      throw new ErrorGeometriaVial(`El validador vial respondio con error (${respuesta.status}).`);
    }

    return parsearRespuestaNearestOsrm(await respuesta.json());
  } catch {
    if (fallbackLocal.valido && fallbackLocal.punto) {
      return fallbackLocal.punto;
    }

    throw new ErrorGeometriaVial(fallbackLocal.mensaje ?? "El punto no esta sobre una calle valida.");
  }
}

/**
 * Pide la geometria oficial por calles para una secuencia de puntos de
 * control (PLAN_MAPA_COMPLETO.md, secciones 5.3 y 7, Fase 9), usando un
 * motor de ruteo compatible con la API HTTP de OSRM (`/route/v1/{profile}/
 * {coords}`).
 *
 * DECISION PENDIENTE DE CONFIRMAR (secciones 5.4 y 10): se eligio hablar el
 * formato de OSRM porque es un estandar abierto ampliamente soportado (varios
 * servidores self-hosted y algunos proveedores pagos lo implementan) y no
 * agrega ninguna dependencia nueva al proyecto (usa `fetch`, nada mas). Por
 * defecto apunta al servidor de demostracion publico de OSRM
 * (`router.project-osrm.org`), configurable via `VITE_OSRM_BASE_URL`.
 *
 * Ese servidor de demo sirve para probar el flujo completo, pero el propio
 * proyecto OSRM aclara que no esta pensado para trafico de produccion (sin
 * garantia de disponibilidad ni limites de uso documentados). Antes de
 * depender de esto en produccion hace falta decidir y configurar un servidor
 * propio (OSRM self-hosted) o un proveedor con SLA (GraphHopper,
 * OpenRouteService), y confirmar si ese calculo lo hace el frontend (como
 * aqui) o si backend expone su propio endpoint (pregunta abierta en la
 * seccion 10).
 */
export async function obtenerGeometriaVial(
  puntos: Coordenada[],
  baseUrl: string = import.meta.env.VITE_OSRM_BASE_URL ?? OSRM_DEMO_BASE_URL,
  perfil?: string
): Promise<GeometriaVialResultado> {
  if (puntos.length < 2) {
    throw new ErrorGeometriaVial("Se necesitan al menos 2 puntos para calcular la geometria vial.");
  }

  const perfilOsrm = obtenerPerfilOsrm(perfil);
  const puntosAjustados = await Promise.all(puntos.map((punto) => ajustarPuntoACalle(punto, baseUrl, perfilOsrm)));
  const coordenadasUrl = puntosAjustados.map((punto) => coordenadaAOsrm(punto.coordenada)).join(";");
  const url = `${baseUrl}/route/v1/${perfilOsrm}/${coordenadasUrl}?overview=full&geometries=geojson&alternatives=true`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url);
  } catch {
    const fallback = construirGeometriaLocalPorCalles(puntos);
    if (fallback.valido && fallback.geometria) {
      return {
        puntos: fallback.geometria,
        distanciaMetros: 0,
        duracionSegundos: 0,
        origen: "local",
      };
    }

    throw new ErrorGeometriaVial(fallback.mensaje ?? "No se pudo contactar al motor de ruteo.");
  }

  if (!respuesta.ok) {
    const fallback = construirGeometriaLocalPorCalles(puntos);
    if (fallback.valido && fallback.geometria) {
      return {
        puntos: fallback.geometria,
        distanciaMetros: 0,
        duracionSegundos: 0,
        origen: "local",
      };
    }

    throw new ErrorGeometriaVial(`El motor de ruteo respondio con error (${respuesta.status}).`);
  }

  const json = await respuesta.json();
  return parsearRespuestaOsrm(json);
}
