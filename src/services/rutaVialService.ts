import type { Coordenada } from "../models/geo";

const OSRM_DEMO_BASE_URL = "https://router.project-osrm.org";

export interface GeometriaVialResultado {
  puntos: Coordenada[];
  distanciaMetros: number;
  duracionSegundos: number;
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

  const [ruta] = respuesta.routes;
  const coordenadasOsrm = ruta.geometry?.coordinates;

  if (!coordenadasOsrm || coordenadasOsrm.length === 0) {
    throw new ErrorGeometriaVial("La respuesta del motor de ruteo no incluyo geometria.");
  }

  return {
    puntos: coordenadasOsrm.map(([lon, lat]): Coordenada => [lat, lon]),
    distanciaMetros: ruta.distance ?? 0,
    duracionSegundos: ruta.duration ?? 0,
  };
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
  baseUrl: string = import.meta.env.VITE_OSRM_BASE_URL ?? OSRM_DEMO_BASE_URL
): Promise<GeometriaVialResultado> {
  if (puntos.length < 2) {
    throw new ErrorGeometriaVial("Se necesitan al menos 2 puntos para calcular la geometria vial.");
  }

  const coordenadasUrl = puntos.map(coordenadaAOsrm).join(";");
  const url = `${baseUrl}/route/v1/driving/${coordenadasUrl}?overview=full&geometries=geojson`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url);
  } catch {
    throw new ErrorGeometriaVial("No se pudo contactar al motor de ruteo (revisa tu conexion a internet).");
  }

  if (!respuesta.ok) {
    throw new ErrorGeometriaVial(`El motor de ruteo respondio con error (${respuesta.status}).`);
  }

  const json = await respuesta.json();
  return parsearRespuestaOsrm(json);
}
