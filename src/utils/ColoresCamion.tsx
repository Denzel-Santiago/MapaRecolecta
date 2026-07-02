export type EstadoCamion =
  | "activo"
  | "retrasado"
  | "parado"
  | "mantenimiento"
  | "fallido";

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