// Estados posibles del camión
export type EstadoCamion =
  | "activo"
  | "retrasado"
  | "parado"
  | "mantenimiento"
  | "fallido";


// Clase Ruta

export class Ruta {
  id: number;
  nombre: string;
  coordenadas: [number, number][];
  activa: boolean;

  constructor(
    id: number,
    nombre: string,
    coordenadas: [number, number][],
    activa: boolean
  ) {
    this.id = id;
    this.nombre = nombre;
    this.coordenadas = coordenadas;
    this.activa = activa;
  }
}


// Clase Punto de Recolección

export class PuntoRecoleccion {
  id: number;
  rutaId: number;
  posicion: [number, number];
  estado: "pendiente" | "completado";

  constructor(
    id: number,
    rutaId: number,
    posicion: [number, number],
    estado: "pendiente" | "completado"
  ) {
    this.id = id;
    this.rutaId = rutaId;
    this.posicion = posicion;
    this.estado = estado;
  }
}

// Clase Camion
export class Camion {
  id: number;
  nombre: string;
  estado: EstadoCamion;
  posicionActual: [number, number];
  rutaId: number;

  constructor(
    id: number,
    nombre: string,
    estado: EstadoCamion,
    posicionActual: [number, number],
    rutaId: number
  ) {
    this.id = id;
    this.nombre = nombre;
    this.estado = estado;
    this.posicionActual = posicionActual;
    this.rutaId = rutaId;
  }
}