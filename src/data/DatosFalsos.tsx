// 🔵 Tipo de estado del camión
export type EstadoCamion =
  | "activo"
  | "retrasado"
  | "parado"
  | "mantenimiento"
  | "fallido";

// 🔵 Modelo básico de camión
export interface Camion {
  id: number;
  nombre: string;
  estado: EstadoCamion;
  posicionActual: [number, number];
  velocidad: number;
  rutaId: number;
}

// 🔵 Lista simulada (como si viniera de BD)
export const listaCamiones: Camion[] = [
  {
    id: 1,
    nombre: "Camión Norte",
    estado: "activo",
    posicionActual: [16.6166, -93.1],
    velocidad: 35,
    rutaId: 1,
  },
  {
    id: 2,
    nombre: "Camión Centro",
    estado: "retrasado",
    posicionActual: [16.618, -93.102],
    velocidad: 20,
    rutaId: 2,
  },
  {
    id: 3,
    nombre: "Camión Sur",
    estado: "mantenimiento",
    posicionActual: [16.615, -93.098],
    velocidad: 0,
    rutaId: 3,
  },
  {
    id: 4,
    nombre: "Camión Emergencia",
    estado: "fallido",
    posicionActual: [16.6195, -93.105],
    velocidad: 0,
    rutaId: 4,
  },
];
