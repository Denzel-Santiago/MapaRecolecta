import type { Coordenada } from "../models/geo";

export function calcularPorcentajeAvance(
  ruta: Coordenada[],
  indiceActual: number
): number {
  if (ruta.length < 2) return 0;
  const avance = Math.max(0, Math.min(indiceActual, ruta.length - 1));
  return Number(((avance / (ruta.length - 1)) * 100).toFixed(0));
}

export function obtenerRutaRecorrida(ruta: Coordenada[], indiceActual: number): Coordenada[] {
  return ruta.slice(0, Math.min(indiceActual + 1, ruta.length));
}
