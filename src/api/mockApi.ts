import type { Coordenada } from "../models/geo";
import type { Camion } from "../models/ModelosMapa";
import { listaCamiones } from "../data/DatosFalsos";

export function obtenerRutasSimuladas(): Promise<Coordenada[][]> {
  return Promise.resolve([]);
}

export function obtenerCamionesSimulados(): Promise<Camion[]> {
  return Promise.resolve(listaCamiones);
}

export function subirRutaSimulada(): Promise<void> {
  return Promise.resolve();
}

export function actualizarCamionSimulado(): Promise<void> {
  return Promise.resolve();
}
