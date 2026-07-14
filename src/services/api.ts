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
    let message = `${response.status} ${response.statusText}`;

    try {
      const payload = (await response.json()) as ApiErrorPayload;
      message = getErrorMessage(payload, message);
    } catch {
      // Mantiene el mismo fallback de recolecta-web cuando el backend no envia JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
