// F owned. The single place the browser talks to the NestJS API.
//
// The API answers in the envelope the group agreed on (plan.md section 9):
//   success -> { success: true, data }
//   failure -> { success: false, error: { code, message, details } }
// Nothing outside this file should ever see that envelope.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** "1" pins every page to its designed mock rows and makes no network calls. */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

const ACCESS_KEY = "df360.accessToken";
const REFRESH_KEY = "df360.refreshToken";

export type TokenPair = { accessToken: string; refreshToken: string };
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// localStorage throws in a few browser configurations; a missing token is a
// normal state (logged out), so failure to read one is never fatal here.
function readToken(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveTokens(tokens: TokenPair): void {
  try {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    /* session-only login */
  }
}

export function clearTokens(): void {
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* nothing stored */
  }
}

export function isSignedIn(): boolean {
  return readToken(ACCESS_KEY) !== null;
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (response.ok && body?.success) return body.data as T;

  const error = body?.error ?? {};
  throw new ApiError(
    response.status,
    error.code ?? "UNKNOWN",
    error.message ?? response.statusText ?? "Request failed.",
    error.details,
  );
}

async function send<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    // fetch only rejects when the request never reached the server. "Failed to
    // fetch" is useless to whoever is looking at the screen; name the address.
    throw new ApiError(0, "API_UNREACHABLE", `Cannot reach the API at ${BASE}. Is it running?`);
  }
  return unwrap<T>(response);
}

/**
 * Access tokens live 15 minutes, so a long-open tab will hit exactly one 401
 * and needs to spend its refresh token to carry on. Refresh tokens are
 * single-use on the server (rotation), so concurrent 401s must share one
 * refresh instead of racing and invalidating each other's replacement.
 */
let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refreshToken = readToken(REFRESH_KEY);
  if (!refreshToken) throw new ApiError(401, "UNAUTHENTICATED", "Signed out.");

  refreshing ??= send<TokenPair>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }, null)
    .then((tokens) => {
      saveTokens(tokens);
      return tokens.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (USE_MOCKS) throw new ApiError(0, "MOCKS_ENABLED", "NEXT_PUBLIC_USE_MOCKS is on.");

  try {
    return await send<T>(path, init, readToken(ACCESS_KEY));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    return send<T>(path, init, await refreshAccess());
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export type Session = { id: string; email: string; name: string; role: string };

/** Auth is the one pair of calls that must not carry (or refresh) a token. */
export const auth = {
  /** null when signed out or the stored token is no longer good. */
  me: async (): Promise<Session | null> => {
    if (!isSignedIn()) return null;
    try {
      return await request<Session>("/auth/me");
    } catch {
      return null;
    }
  },
  login: (email: string, password: string) =>
    send<TokenPair>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, null),
  signup: (email: string, name: string, password: string) =>
    send<TokenPair>("/auth/signup", { method: "POST", body: JSON.stringify({ email, name, password }) }, null),
};
