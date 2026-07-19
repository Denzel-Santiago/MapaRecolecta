export type EstadoCamion =
  | "activo"
  | "retrasado"
  | "parado"
  | "mantenimiento"
  | "fallido";

const COLORES_CAMION = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#4d7c0f",
];

export function obtenerColorCamion(camionId: number): string {
  const indice = Math.abs(camionId - 1) % COLORES_CAMION.length;
  return COLORES_CAMION[indice];
}

export function obtenerColorPorEstado(estado: EstadoCamion): string {
  switch (estado) {
    case "activo":
      return "green";
    case "retrasado":
      return "yellow";
    case "parado":
      return "red";
    case "mantenimiento":
      return "orange";
    case "fallido":
      return "black";
    default:
      return "gray";
  }
}
