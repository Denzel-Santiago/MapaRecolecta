const BASE_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "auth_token";

type ApiErrorPayload = {
  message?: string;
  error?: string | { message?: string; code?: string; details?: unknown };
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getErrorMessage(payload: ApiErrorPayload, fallback: string): string {
  if (typeof payload.error === "object" && payload.error?.message) {
    return payload.error.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.message ?? fallback;
}

function messageFromHtmlOrText(body: string, status: number, statusText: string): string {
  const trimmed = body.trim();
  const fallback = `${status} ${statusText}`;

  if (!trimmed) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();

  if (
    lower.includes("ngrok") ||
    lower.includes("err_ngrok") ||
    lower.includes("visit site") ||
    lower.includes("ngrok-skip-browser-warning")
  ) {
    return (
      "El tunel ngrok bloqueo la peticion (403). " +
      "En desarrollo local usa el proxy Vite hacia http://localhost:8081 " +
      "(VITE_API_URL vacio y VITE_API_PROXY_TARGET=http://localhost:8081)."
    );
  }

  if (lower.includes("blocked request") && lower.includes("host")) {
    return (
      "Vite bloqueo el Host de la peticion. " +
      "Revisa server.allowedHosts en vite.config.ts."
    );
  }

  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    return `${fallback}: el servidor devolvio HTML en lugar de JSON de la API.`;
  }

  const singleLine = trimmed.replace(/\s+/g, " ").slice(0, 180);
  return singleLine || fallback;
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`;
  const body = await response.text();

  if (!body.trim()) {
    return fallback;
  }

  try {
    const payload = JSON.parse(body) as ApiErrorPayload;
    return getErrorMessage(payload, fallback);
  } catch {
    return messageFromHtmlOrText(body, response.status, response.statusText);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
