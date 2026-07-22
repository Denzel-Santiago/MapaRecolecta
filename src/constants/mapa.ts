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

// Modo detector (ver PLAN_MAPA_COMPLETO.md, seccion 6): distancia maxima en
// metros para considerar que un punto detectado tiene un vecino cercano.
export const UMBRAL_VECINO_METROS = 40;

// Peso base para el primer punto de una ruta nueva y para renumerar la lista
// enlazada cuando la precision entre pesos consecutivos se agota.
export const PESO_BASE = 10;

// Fase 4 del modo detector: si el punto candidato esta a menos de esta
// distancia del vecino mas cercano (conectado o pendiente), se trata como
// una deteccion duplicada y se ignora, en vez de crear un punto redundante.
export const DISTANCIA_MINIMA_DUPLICADO_METROS = 3;

// Fase 5, curvas automaticas. El angulo se mide como desviacion de
// direccion entre dos segmentos consecutivos (0 grados = sigue derecho,
// 90 grados = esquina en angulo recto). Solo se trata como curva cuando el
// giro cae DENTRO de este rango; un giro casi recto (cerca de 0) o una
// esquina real (cerca de 90) se deja como linea recta.
export const UMBRAL_CURVA_MIN_GRADOS = 15;
export const UMBRAL_CURVA_MAX_GRADOS = 75;
