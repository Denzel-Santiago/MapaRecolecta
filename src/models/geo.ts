export type Coordenada = [number, number];

export interface CoordenadaDTO {
  latitud: number;
  longitud: number;
}

export interface PuntoRecoleccionDTO {
  id: number;
  rutaId: number;
  posicion: CoordenadaDTO;
  estado: "pendiente" | "completado";
}
