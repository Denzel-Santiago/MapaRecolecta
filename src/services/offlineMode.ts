import type { PuntoRuta, RutaDiseñada } from "../models/rutaDiseñada";
import { obtenerColorCamion } from "../utils/ColoresCamion";

// Modo offline: permite usar el mapa completo (login, Diseñador, Monitoreo)
// sin backend, para pruebas internas o revisar cambios. Ver PLAN_MAPA_COMPLETO.md,
// sección 0. Apagado por defecto; no afecta el flujo real contra la API.

export const OFFLINE_MODE = import.meta.env.VITE_OFFLINE_MODE === "true";

export const OFFLINE_CREDENCIALES = {
  email: "offline@recolecta.local",
  password: "offline123",
};

function base64UrlEncode(valor: string): string {
  return btoa(valor).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Token con la misma forma que un JWT (header.payload.firma) para que
 * `decodeJwtPayload` en authService.ts lo pueda leer sin cambios. No es un
 * JWT real, nunca se manda a un backend, solo vive en localStorage.
 */
export function construirTokenOffline(): string {
  const encabezado = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      user_id: 0,
      role_id: 1, // ADMIN, para poder entrar al Diseñador
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 dias
    })
  );

  return `${encabezado}.${payload}.offline`;
}

function clonarPuntos(puntos: PuntoRuta[]): PuntoRuta[] {
  return puntos.map((punto) => ({ ...punto }));
}

function rutasDeEjemplo(): RutaDiseñada[] {
  return [
    {
      ruta_id: 1001,
      nombre: "Ruta Centro (offline)",
      descripcion: "Ruta de ejemplo para pruebas sin backend.",
      camion_id: 1,
      color: obtenerColorCamion(1),
      visible: true,
      puntos: [
        { punto_id: 1, cp: 1, orden: 1, lat: 16.6175, lng: -93.1015, lon: -93.1015 },
        { punto_id: 2, cp: 2, orden: 2, lat: 16.617, lng: -93.099, lon: -93.099 },
        { punto_id: 3, cp: 3, orden: 3, lat: 16.6158, lng: -93.0975, lon: -93.0975 },
        { punto_id: 4, cp: 4, orden: 4, lat: 16.6145, lng: -93.099, lon: -93.099 },
      ],
    },
    {
      ruta_id: 1002,
      nombre: "Ruta Norte (offline)",
      descripcion: "Segunda ruta de ejemplo para pruebas sin backend.",
      camion_id: 2,
      color: obtenerColorCamion(2),
      visible: true,
      puntos: [
        { punto_id: 5, cp: 1, orden: 1, lat: 16.621, lng: -93.103, lon: -93.103 },
        { punto_id: 6, cp: 2, orden: 2, lat: 16.6225, lng: -93.1005, lon: -93.1005 },
        { punto_id: 7, cp: 3, orden: 3, lat: 16.6235, lng: -93.098, lon: -93.098 },
      ],
    },
  ];
}

let rutasOffline: RutaDiseñada[] = rutasDeEjemplo();
let siguienteRutaIdOffline = 1003;

export function offlineListarRutas(): RutaDiseñada[] {
  return rutasOffline.map((ruta) => ({ ...ruta, puntos: clonarPuntos(ruta.puntos) }));
}

export function offlineObtenerRuta(rutaId: number): RutaDiseñada {
  const ruta = rutasOffline.find((actual) => actual.ruta_id === rutaId);

  if (!ruta) {
    throw new Error(`No existe la ruta offline ${rutaId}.`);
  }

  return { ...ruta, puntos: clonarPuntos(ruta.puntos) };
}

export function offlineGuardarRuta(ruta: RutaDiseñada): RutaDiseñada {
  const nueva: RutaDiseñada = { ...ruta, ruta_id: siguienteRutaIdOffline };
  siguienteRutaIdOffline += 1;
  rutasOffline = [...rutasOffline, nueva];
  return nueva;
}

export function offlineActualizarRuta(ruta: RutaDiseñada): RutaDiseñada {
  rutasOffline = rutasOffline.map((actual) => (actual.ruta_id === ruta.ruta_id ? ruta : actual));
  return ruta;
}

export function offlineEliminarRuta(rutaId: number): void {
  rutasOffline = rutasOffline.filter((actual) => actual.ruta_id !== rutaId);
}
