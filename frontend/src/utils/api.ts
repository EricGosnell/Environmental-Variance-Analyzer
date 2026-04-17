/**
 * Frontend API client for routes documented in `Documentation/API_routes.md`.
 *
 * Base URL:
 * - Configure with Vite env var: `VITE_API_BASE_URL`
 * - Defaults to the local test backend in `simple_backend/app.py` (port 5000)
 */

import type {
  AddPodOwnerRequest,
  AddPodOwnerResponse,
  AdminDeactivateUserRequest,
  AdminGenerateInvitationTokenResponse,
  AdminRevokeInvitationTokenRequest,
  AuthForgotPasswordRequest,
  AuthLoginRequest,
  AuthLoginResponse,
  AuthLogoutRequest,
  AuthRefreshRequest,
  AuthRefreshResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  AuthResetPasswordRequest,
  DeletePodDataRequest,
  DeletePodDataResponse,
  GetPodOwnersResponse,
  MessageResponse,
  PodDataResponse,
  GetPodLocationsRequest,
  PodLocationsResponse,
  RegisterPodRequest,
  RequestEmailChangeRequest,
  SearchPodOwnerCandidatesResponse,
  UnregisterPodRequest,
  UpdatePasswordRequest,
  UpdatePodRequest,
  UpdateUsernameRequest,
  UploadPodDataRequest,
  UploadPodDataResponse,
  UserResponse,
  UsersResponse,
  VerifyAndUpdateEmailRequest,
  VerifyAndUpdateEmailResponse,
  PodLatestReadings
} from "./apiTypes";

// ----------------------------
// Config + token storage
// ----------------------------

const DEFAULT_API_BASE_URL = "http://localhost:3000/api";
export const API_BASE_URL: string =
  (import.meta as any)?.env?.VITE_API_BASE_URL?.toString?.() || DEFAULT_API_BASE_URL;

const ACCESS_TOKEN_KEY = "eva.accessToken";
const REFRESH_TOKEN_KEY = "eva.refreshToken";

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTokens(tokens: { accessToken?: string; refreshToken?: string }): void {
  try {
    if (typeof tokens.accessToken === "string") localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    if (typeof tokens.refreshToken === "string") localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } catch {
    // ignore (e.g. private browsing / disabled storage)
  }
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ----------------------------
// Global auth-lost handler
// ----------------------------

let authLostHandler: (() => void) | null = null;
let apiErrorHandler: ((message: string) => void) | null = null;

/**
 * Register a single global handler to run when the API layer determines the user is no longer authenticated
 * (e.g. refresh token missing/invalid).
 *
 * Intended to be set once from a top-level UI component (e.g. layout) to perform navigation.
 */
export function setAuthLostHandler(handler: (() => void) | null): void {
  authLostHandler = handler;
}

export function setApiErrorHandler(handler: ((message: string) => void) | null): void {
  apiErrorHandler = handler;
}

function triggerAuthLost(): void {
  clearTokens();
  try {
    authLostHandler?.();
  } catch {
    // avoid secondary crashes during navigation
  }
}

function triggerApiError(message: string): void {
  try {
    apiErrorHandler?.(message);
  } catch {
    // avoid secondary crashes during error display
  }
}

function shouldSuppressGlobalError(opts: RequestOptions, status?: number): boolean {
  if (!opts.suppressGlobalError) return false;
  if (opts.suppressGlobalError === true) return true;
  if (typeof status !== "number") return false;
  return opts.suppressGlobalError.includes(status);
}

function maybeTriggerApiError(opts: RequestOptions, message: string, status?: number, reason?: string): void {
  if (shouldSuppressGlobalError(opts, status)) return;
  if (reason) {
    const statusPart = typeof status === "number" ? ` status=${status}` : "";
    console.error(`[api-error] ${opts.method} ${opts.path}${statusPart} reason=${reason}`);
  }
  triggerApiError(message);
}

// ----------------------------
// Shared request helpers
// ----------------------------

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // e.g. "/users/me"
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  auth?: boolean; // attach Authorization header, auto-refresh on 401 if possible
  signal?: AbortSignal;
  suppressGlobalError?: boolean | number[];
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${p}`);

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
}

async function parseResponseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  try {
    return await res.text();
  } catch {
    return null;
  }
}

let refreshInFlight: Promise<AuthRefreshResponse> | null = null;

async function rawRequest<T>(opts: RequestOptions): Promise<T> {
  const url = buildUrl(opts.path, opts.query);

  const headers: Record<string, string> = {};
  const accessToken = opts.auth ? getAccessToken() : null;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const init: RequestInit = { method: opts.method, headers, signal: opts.signal };

  if (opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      init.body = opts.body;
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
  }

  const res = await fetch(url, init);
  if (res.ok) return (await parseResponseBody(res)) as T;

  const body = await parseResponseBody(res);
  let message =
    (body as any)?.error ||
    (body as any)?.message ||
    `Request failed: ${opts.method} ${opts.path} -> ${res.status}`;
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { details?: Array<{ message?: string }> }).details) &&
    ((body as { details: Array<{ message?: string }> }).details.length > 0)
  ) {
    const parts = (body as { details: Array<{ message?: string }> }).details
      .map((d) => d.message)
      .filter(Boolean);
    if (parts.length) message = parts.join(". ");
  }
  throw new ApiError(String(message), res.status, body);
}

/**
 * Request wrapper with optional auto-refresh on 401 (if refresh token is present).
 * This is safe even if your backend doesn't implement auth yet; it'll just behave like rawRequest.
 */
async function request<T>(opts: RequestOptions): Promise<T> {
  try {
    return await rawRequest<T>(opts);
  } catch (err) {
    if ((err as any)?.name === "AbortError") {
      throw err;
    }

    if (!opts.auth) {
      if (err instanceof ApiError) {
        if (err.status !== 400) maybeTriggerApiError(opts, err.message, err.status, "no_auth_route");
      } else {
        maybeTriggerApiError(opts, "Network request failed. Please try again.", undefined, "network_error");
      }
      throw err;
    }
    if (!(err instanceof ApiError)) {
      maybeTriggerApiError(opts, "Network request failed. Please try again.", undefined, "network_error");
      throw err;
    }
    if (err.status !== 401) {
      if (err.status !== 400) maybeTriggerApiError(opts, err.message, err.status, "auth_route_non_401");
      throw err;
    }
    if (opts.path.startsWith("/auth/refresh")) {
      maybeTriggerApiError(opts, "Your session has expired. Please log in again.", err.status, "refresh_endpoint_401");
      throw err;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      triggerAuthLost();
      maybeTriggerApiError(opts, "Your session has expired. Please log in again.", err.status, "missing_refresh_token");
      throw err;
    }

    // de-dupe refresh calls across concurrent requests
    if (!refreshInFlight) {
      refreshInFlight = rawRequest<AuthRefreshResponse>({
        method: "POST",
        path: "/auth/refresh",
        body: { refreshToken },
        auth: false,
      }).finally(() => {
        refreshInFlight = null;
      });
    }

    try {
      const refreshed = await refreshInFlight;
      setTokens(refreshed);
      return await rawRequest<T>(opts);
    } catch (refreshErr) {
      triggerAuthLost();
      if (refreshErr instanceof ApiError) {
        maybeTriggerApiError(opts, refreshErr.message, refreshErr.status, "refresh_failed");
      } else {
        maybeTriggerApiError(opts, "Network request failed. Please try again.", undefined, "refresh_network_error");
      }
      throw refreshErr;
    }
  }
}

export async function authLogin(payload: AuthLoginRequest, signal?: AbortSignal): Promise<AuthLoginResponse> {
  const res = await request<AuthLoginResponse>({
    method: "POST",
    path: "/auth/login",
    body: payload,
    auth: false,
    signal,
  });
  setTokens(res);
  return res;
}

export async function authRefresh(payload: AuthRefreshRequest, signal?: AbortSignal): Promise<AuthRefreshResponse> {
  const res = await request<AuthRefreshResponse>({
    method: "POST",
    path: "/auth/refresh",
    body: payload,
    auth: false,
    signal,
  });
  setTokens(res);
  return res;
}

export async function authRegister(payload: AuthRegisterRequest, signal?: AbortSignal): Promise<AuthRegisterResponse> {
  return await request<AuthRegisterResponse>({
    method: "POST",
    path: "/auth/register",
    body: payload,
    auth: false,
    signal,
  });
}

export async function authLogout(
  payload?: Partial<AuthLogoutRequest>,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  // allow caller to omit payload; we’ll use stored refresh token if present
  const refreshToken = payload?.refreshToken ?? getRefreshToken() ?? undefined;
  const res = await request<MessageResponse>({
    method: "POST",
    path: "/auth/logout",
    body: refreshToken ? { refreshToken } : undefined,
    auth: true,
    signal,
  });
  clearTokens();
  return res;
}

export async function authForgotPassword(
  payload: AuthForgotPasswordRequest,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/auth/forgot-password",
    body: payload,
    auth: false,
    signal,
  });
}

export async function authResetPassword(
  payload: AuthResetPasswordRequest,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/auth/reset-password",
    body: payload,
    auth: false,
    signal,
  });
}

export async function sendVerification(
  payload: { email: string },
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/auth/send-verification",
    body: payload,
    auth: false,
    signal,
  });
}

export async function verifyEmail(
  payload: { email: string; code: string },
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/auth/verify-email",
    body: payload,
    auth: false,
    signal,
  });
}

export async function getMe(signal?: AbortSignal): Promise<UserResponse> {
  return await request<UserResponse>({ method: "GET", path: "/users/me", auth: true, signal });
}

export async function getMeSilent(signal?: AbortSignal): Promise<UserResponse> {
  return await request<UserResponse>({
    method: "GET",
    path: "/users/me",
    auth: true,
    signal,
    suppressGlobalError: [401, 403],
  });
}

export async function getUserById(id: string, signal?: AbortSignal): Promise<UserResponse> {
  return await request<UserResponse>({
    method: "GET",
    path: `/users/${encodeURIComponent(id)}`,
    auth: true,
    signal,
  });
}
export async function updateMyUsername(payload: UpdateUsernameRequest, signal?: AbortSignal): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "PUT",
    path: "/users/me/username",
    body: payload,
    auth: true,
    signal,
  });
}
export async function requestEmailChange(
  payload: RequestEmailChangeRequest,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/users/me/email/request-change",
    body: payload,
    auth: true,
    signal,
  });
}
export async function verifyAndUpdateEmail(
  payload: VerifyAndUpdateEmailRequest,
  signal?: AbortSignal,
): Promise<VerifyAndUpdateEmailResponse> {
  return await request<VerifyAndUpdateEmailResponse>({
    method: "PUT",
    path: "/users/me/email",
    body: payload,
    auth: true,
    signal,
  });
}
export async function updateMyPassword(payload: UpdatePasswordRequest, signal?: AbortSignal): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "PUT",
    path: "/users/me/password",
    body: payload,
    auth: true,
    signal,
  });
}
export async function registerPod(payload: RegisterPodRequest, signal?: AbortSignal): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "POST",
    path: "/users/me/register-pod",
    body: payload,
    auth: true,
    signal,
  });
}
export async function updatePod(payload: UpdatePodRequest, signal?: AbortSignal): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "PUT",
    path: "/users/me/update-pod",
    body: payload,
    auth: true,
    signal,
  });
}
export async function unregisterPod(payload: UnregisterPodRequest, signal?: AbortSignal): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "DELETE",
    path: "/users/me/unregister-pod",
    body: payload,
    auth: true,
    signal,
  });
}

export async function getPodsLatestReadings(
  podIds: string[],
  signal?: AbortSignal,
): Promise<{ pods: PodLatestReadings[] }> {

  if (!podIds.length) {
    return { pods: [] };
  }

  return await request<{ pods: PodLatestReadings[] }>({
    method: "GET",
    path: "/pods/latest",
    query: {
      ids: podIds.join(","),
    },
    auth: true,
    signal,
  });
}

export async function adminGetAllUsers(signal?: AbortSignal): Promise<UsersResponse> {
  return await request<UsersResponse>({ method: "GET", path: "/admin/users", auth: true, signal });
}

export async function adminGenerateInvitationToken(
  signal?: AbortSignal,
): Promise<AdminGenerateInvitationTokenResponse> {
  return await request<AdminGenerateInvitationTokenResponse>({
    method: "GET",
    path: "/admin/users/invitation-token",
    auth: true,
    signal,
  });
}
export async function adminRevokeInvitationToken(
  payload: AdminRevokeInvitationTokenRequest,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "DELETE",
    path: "/admin/users/invitation-token",
    body: payload,
    auth: true,
    signal,
  });
}
export async function adminDeactivateUser(
  id: string,
  payload: AdminDeactivateUserRequest,
  signal?: AbortSignal,
): Promise<MessageResponse> {
  return await request<MessageResponse>({
    method: "PUT",
    path: `/admin/users/${encodeURIComponent(id)}/deactivate`,
    body: payload,
    auth: true,
    signal,
  });
}

/**
 * Docs list GET `/pods/locations` and show parameters; we send them as query string.
 */
export async function getPodLocations(
  params: GetPodLocationsRequest,
  signal?: AbortSignal,
): Promise<PodLocationsResponse> {
  return await request<PodLocationsResponse>({
    method: "GET",
    path: "/pods/locations",
    query: params,
    auth: true,
    signal,
  });
}
export async function getPodData(podId: string, signal?: AbortSignal): Promise<PodDataResponse> {
  return await request<PodDataResponse>({
    method: "GET",
    path: `/pods/${encodeURIComponent(podId)}/data`,
    auth: true,
    signal,
  });
}
export async function uploadPodData(payload: UploadPodDataRequest, signal?: AbortSignal): Promise<UploadPodDataResponse> {
  const formData = new FormData();
  formData.append("podId", payload.podId);
  formData.append("data", payload.data);
  if (payload.notes !== undefined) {
    formData.append("notes", payload.notes);
  }
  return await request<UploadPodDataResponse>({
    method: "POST",
    path: "/pods/upload-pod-data",
    body: formData,
    auth: true,
    signal,
  });
}
export async function deletePodData(payload: DeletePodDataRequest, signal?: AbortSignal): Promise<DeletePodDataResponse> {
  return await request<DeletePodDataResponse>({
    method: "DELETE",
    path: "/pods/delete-pod-data",
    body: payload,
    auth: true,
    signal,
  });
}

export async function searchUsers(
  username: string,
  signal?: AbortSignal,
): Promise<SearchPodOwnerCandidatesResponse> {
  return await request<SearchPodOwnerCandidatesResponse>({
    method: "GET",
    path: "/users/search",
    query: { username, limit: 10 },
    auth: true,
    signal,
  });
}

export async function addPodOwner(
  podId: string,
  payload: AddPodOwnerRequest,
  signal?: AbortSignal,
): Promise<AddPodOwnerResponse> {
  return await request<AddPodOwnerResponse>({
    method: "POST",
    path: `/pods/${encodeURIComponent(podId)}/owners`,
    body: payload,
    auth: true,
    signal,
  });
}

export async function getPodOwners(
  podId: string,
  signal?: AbortSignal,
): Promise<GetPodOwnersResponse> {
  return await request<GetPodOwnersResponse>({
    method: "GET",
    path: `/pods/${encodeURIComponent(podId)}/owners`,
    auth: true,
    signal,
  });
}
