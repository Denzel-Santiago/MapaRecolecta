import { apiRequest, clearToken, getToken, setToken } from "./api";
import {
  OFFLINE_CREDENCIALES,
  activarModoOffline,
  construirTokenOffline,
  estaModoOfflineActivo,
} from "./offlineMode";

export const ROLES = {
  ADMIN: 1,
  CONDUCTOR: 2,
  SUPERVISOR: 3,
  COORDINADOR: 4,
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

interface EmpleadoLogin {
  id: number;
  nombre: string;
  apellidos: string;
  mail: string;
  username: string;
  desactivado: boolean;
  rol_id: number;
}

interface LoginResponse {
  token?: string;
  access_token?: string;
  jwt?: string;
  data?: EmpleadoLogin;
}

export interface AuthSession {
  token: string;
  userId: number | null;
  roleId: number | null;
  expiresAt: number | null;
}

interface JwtPayload {
  user_id?: number;
  role_id?: number;
  exp?: number;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getAuthSession(): AuthSession | null {
  const token = getToken();

  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : null;

  if (expiresAt !== null && expiresAt <= Date.now()) {
    clearToken();
    return null;
  }

  return {
    token,
    userId: payload?.user_id ?? null,
    roleId: payload?.role_id ?? null,
    expiresAt,
  };
}

export function canAccessDesigner(roleId: number | null): boolean {
  return roleId === ROLES.ADMIN || roleId === ROLES.SUPERVISOR;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  if (estaModoOfflineActivo()) {
    const coincide =
      email.trim().toLowerCase() === OFFLINE_CREDENCIALES.email &&
      password === OFFLINE_CREDENCIALES.password;

    if (!coincide) {
      throw new Error(
        `Modo offline activo. Usa la credencial de prueba: ${OFFLINE_CREDENCIALES.email} / ${OFFLINE_CREDENCIALES.password}`
      );
    }

    setToken(construirTokenOffline());

    const sesionOffline = getAuthSession();

    if (!sesionOffline) {
      throw new Error("No se pudo crear la sesion offline.");
    }

    return sesionOffline;
  }

  const data = await apiRequest<LoginResponse>("/api/empleados/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const token = data.token ?? data.access_token ?? data.jwt ?? "";

  if (!token) {
    throw new Error("El backend no devolvio un token de autenticacion.");
  }

  setToken(token);

  const session = getAuthSession();

  if (!session) {
    throw new Error("El token recibido no es valido o ya expiro.");
  }

  return session;
}

export function loginOffline(): AuthSession {
  activarModoOffline();
  setToken(construirTokenOffline());

  const sesionOffline = getAuthSession();

  if (!sesionOffline) {
    throw new Error("No se pudo crear la sesion offline.");
  }

  return sesionOffline;
}

export function logout(): void {
  clearToken();
}
