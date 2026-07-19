import type { Coordenada } from "../models/geo";

export const SUCHIAPA_CENTER: Coordenada = [16.6166, -93.1];

export const SUCHIAPA_BOUNDS: [Coordenada, Coordenada] = [
  [16.58, -93.15],
  [16.66, -93.05],
];

export const SUCHIAPA_REGION_NAME = "Suchiapa, Chiapas";

export const MIN_ROUTE_POINTS = 2;

export const MAP_INITIAL_ZOOM = 14;

export const MAP_MIN_ZOOM = 13;

export const MAP_MAX_ZOOM = 18;

export const MAP_BOUNDS_VISCOSITY = 1.0;

export const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION = "&copy; OpenStreetMap contributors";
