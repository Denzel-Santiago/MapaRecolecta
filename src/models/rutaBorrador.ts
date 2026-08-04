import type { Coordenada } from "./geo";

export type EstadoPuntoBorrador = "sin_cambios" | "nuevo" | "movido" | "reordenado" | "eliminado";

export type EstadoPublicacionRuta = "BORRADOR" | "VALIDANDO" | "VALIDA" | "ERROR" | "PUBLICADA";

/**
 * Punto dentro de una edicion en memoria (RutaBorrador).
 *
 * `punto_id` es `number` cuando el punto ya existe en backend, o un id temporal
 * con forma `"temp_xxx"` (string) cuando fue creado en esta sesion de edicion y
 * todavia no se sincroniza. Ver `esIdTemporal`.
 */
export interface PuntoBorrador {
  punto_id: number | string;
  ruta_id: number;
  cp: number | string;
  lat: number;
  lon: number;
  orden: number;
  estado: EstadoPuntoBorrador;
}

export interface RutaBorrador {
  ruta_id: number | null;
  nombre: string;
  descripcion: string;
  camion_id: number | null;
  color?: string;
  puntos: PuntoBorrador[];
  estadoPublicacion: EstadoPublicacionRuta;
}

const PREFIJO_ID_TEMPORAL = "temp_";

let contadorIdTemporal = 0;

/**
 * Genera un id temporal unico para un punto que aun no existe en backend.
 * No depende de Date.now() en solitario para evitar colisiones si se llama
 * varias veces dentro del mismo milisegundo.
 */
export function generarIdTemporal(): string {
  contadorIdTemporal += 1;
  return `${PREFIJO_ID_TEMPORAL}${Date.now()}_${contadorIdTemporal}`;
}

export function esIdTemporal(id: number | string): id is string {
  return typeof id === "string" && id.startsWith(PREFIJO_ID_TEMPORAL);
}

export function coordenadaDePuntoBorrador(punto: PuntoBorrador): Coordenada {
  return [punto.lat, punto.lon];
}
