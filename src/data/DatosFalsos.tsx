// Tipo de estado del camion. Usado por MapaMonitoreoView.tsx y
// utils/IconosCamion.ts (ver PLAN_MAPA_COMPLETO.md, Fase 14: la lista
// simulada de camiones y la interfaz Camion que vivian aqui se eliminaron
// por ser codigo muerto, sin importadores reales; este tipo si se usa).
export type EstadoCamion =
  | "activo"
  | "retrasado"
  | "parado"
  | "mantenimiento"
  | "fallido";
