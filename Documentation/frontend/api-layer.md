# API Layer

The frontend's API layer lives in `src/utils/api.ts` and `src/utils/apiTypes.ts`.

---

## Overview

`api.ts` is the single source of all backend communication. It handles:
- Token storage and retrieval
- Attaching auth headers to requests
- Automatic token refresh on 401 responses
- Global error and auth-lost event hooks
- All typed endpoint functions

---

## Token Management

Tokens are stored in `localStorage`:

```ts
const ACCESS_TOKEN_KEY = "eva_access_token";
const REFRESH_TOKEN_KEY = "eva_refresh_token";

function getAccessToken(): string | null
function setTokens(access: string, refresh: string): void
function clearTokens(): void
```

`setTokens` writes both tokens. `clearTokens` removes both. `getAccessToken` is used by request functions to attach the `Authorization` header.

---

## Global Event Handlers

Two optional handlers can be registered globally, typically by `MainLayout`:

```ts
function setAuthLostHandler(handler: () => void): void
function setApiErrorHandler(handler: (message: string) => void): void
```

- **Auth Lost Handler**: Called when a token refresh fails (the user's session is irrecoverably gone). `MainLayout` registers a handler that navigates to `/`.
- **API Error Handler**: Called for any unhandled API error (non-2xx response not handled by the caller). `MainLayout` registers a handler that calls `showError()` from `GlobalErrorContext`.

---

## Request Infrastructure

### `rawRequest(path, options)`

The lowest-level fetch wrapper. It:
1. Prepends the API base URL to `path`.
2. Attaches `Content-Type: application/json` and `Authorization: Bearer <token>` headers (if a token exists).
3. Returns `{ ok, status, data }` where `data` is the parsed JSON response body.

```ts
async function rawRequest(
  path: string,
  options?: RequestInit & { suppressGlobalError?: boolean }
): Promise<{ ok: boolean; status: number; data: unknown }>
```

### `request(path, options)`

Wraps `rawRequest` with 401 auto-refresh logic:

1. Calls `rawRequest`.
2. If response is 401:
   - Calls `authRefresh()` using the stored refresh token.
   - If refresh succeeds: retries the original request with the new access token.
   - If refresh fails: calls `clearTokens()` and `authLostHandler()`.
3. If response is non-2xx and not handled by the caller, calls `apiErrorHandler` (unless `suppressGlobalError` is set).
4. Returns the response.

**De-duplication**: If multiple concurrent requests all hit 401 at the same time, only one refresh call is made. The others wait for that refresh and then retry with the new token.

```ts
async function request(
  path: string,
  options?: RequestInit & { suppressGlobalError?: boolean }
): Promise<{ ok: boolean; status: number; data: unknown }>
```

---

## Auth Endpoints

```ts
// Login — returns access + refresh tokens
authLogin(body: AuthLoginRequest): Promise<AuthLoginResponse>

// Register new account
authRegister(body: AuthRegisterRequest): Promise<AuthRegisterResponse>

// Logout — invalidates refresh token server-side
authLogout(): Promise<void>

// Send password reset code to email
authForgotPassword(body: { email: string }): Promise<void>

// Confirm code and set new password
authResetPassword(body: AuthResetPasswordRequest): Promise<void>

// Send email verification code
sendVerification(email: string): Promise<void>

// Submit verification code
verifyEmail(body: { email: string; code: string }): Promise<void>

// Refresh access token using refresh token
authRefresh(body: AuthRefreshRequest): Promise<AuthRefreshResponse>
```

---

## User Endpoints

```ts
// Get current user's profile (throws on error — shows global error)
getMe(): Promise<User>

// Get current user's profile (silent — suppresses global error, used for auth state check)
getMeSilent(): Promise<User | null>

// Get a user by ID
getUserById(userId: number): Promise<User>

// Update username
updateMyUsername(body: UpdateUsernameRequest): Promise<void>

// Request email change (sends verification code)
requestEmailChange(body: RequestEmailChangeRequest): Promise<void>

// Confirm code and update email
verifyAndUpdateEmail(body: VerifyAndUpdateEmailRequest): Promise<VerifyAndUpdateEmailResponse>

// Update password
updateMyPassword(body: UpdatePasswordRequest): Promise<void>
```

---

## Pod Endpoints

```ts
// Register a new pod (associate with current user)
registerPod(body: RegisterPodRequest): Promise<UserPod>

// Update pod metadata (nickname, location, visibility)
updatePod(body: UpdatePodRequest): Promise<UserPod>

// Unregister (delete) a pod
unregisterPod(body: UnregisterPodRequest): Promise<void>

// Get pod locations visible on map (with filters)
getPodLocations(body: GetPodLocationsRequest): Promise<PodLocation[]>

// Get full data history for a pod
getPodData(podId: string): Promise<{
  data: PodDataEntry[];
  pod_meta: { id: string; nickname: string; location: string; visibility: string; lastUpdated: string };
  viewer: { isOwner: boolean; canManagePod: boolean };
}>

// Upload sensor data to a pod
uploadPodData(body: UploadPodDataRequest): Promise<UploadPodDataResponse>

// Delete sensor data from a pod
deletePodData(body: DeletePodDataRequest): Promise<DeletePodDataResponse>

// Get latest readings for a list of pod IDs
getPodsLatestReadings(podIds: string[]): Promise<PodLatestReadings[]>
```

---

## Collaboration Endpoints

```ts
// Search users by username (for sharing pods)
searchUsers(query: string, signal?: AbortSignal): Promise<PodOwnerCandidate[]>

// Add a user as a pod owner
addPodOwner(body: AddPodOwnerRequest): Promise<AddPodOwnerResponse>

// Get all owners of a pod
getPodOwners(podId: string): Promise<GetPodOwnersResponse>
```

---

## Admin Endpoints

```ts
// Get all users (admin only)
adminGetAllUsers(): Promise<User[]>

// Generate an invitation token
adminGenerateInvitationToken(): Promise<{ token: string }>

// Revoke an invitation token
adminRevokeInvitationToken(token: string): Promise<void>

// Deactivate a user account
adminDeactivateUser(userId: number): Promise<void>
```

---

## API Types (`apiTypes.ts`)

### Core Models

```ts
interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  pods: UserPod[];
  created_at: string;
}

interface UserPod {
  id: string;
  nickname: string;
  location: string;
  visibility: "public" | "private";
  created_at: string;
}

interface PodLocation {
  id: string;
  nickname: string;
  location: string;
  visibility: string;
  latest_readings: LatestSensorReading[];
}

interface PodDataEntry {
  id: number;
  pod_id: string;
  sensor_type: string;
  reading_value: number;
  units: string;
  recorded_at: string;   // ISO 8601
  notes?: string;
}

interface PodLatestReadings {
  pod_id: string;
  nickname: string;
  latest_readings: LatestSensorReading[];
}

interface LatestSensorReading {
  sensor_type: string;
  reading_value: number;
  units: string;
  recorded_at: string;
}
```

### Auth Request/Response Types

```ts
interface AuthLoginRequest { email: string; password: string; }
interface AuthLoginResponse { access_token: string; refresh_token: string; }

interface AuthRegisterRequest { username: string; email: string; phone?: string; password: string; }
interface AuthRegisterResponse { id: number; username: string; email: string; }

interface AuthRefreshRequest { refresh_token: string; }
interface AuthRefreshResponse { access_token: string; refresh_token: string; }

interface AuthResetPasswordRequest { email: string; code: string; newPassword: string; }
```

### Pod Request Types

```ts
interface RegisterPodRequest { nickname: string; location: string; visibility: string; }
interface UpdatePodRequest { pod_id: string; nickname?: string; location?: string; visibility?: string; }
interface UnregisterPodRequest { pod_id: string; }

interface GetPodLocationsRequest {
  lat: number;
  lng: number;
  radius: number;
  from_date?: string;
  to_date?: string;
  sensor_types?: string[];
}

interface UploadPodDataRequest { pod_id: string; file: File; location?: string; notes?: string; }
interface UploadPodDataResponse { inserted: number; skipped: number; }

interface DeletePodDataRequest { pod_id: string; entry_ids: number[]; }
interface DeletePodDataResponse { deleted: number; }
```

### Collaboration Types

```ts
interface PodOwnerCandidate { id: number; username: string; }
interface SearchPodOwnerCandidatesResponse { candidates: PodOwnerCandidate[]; }
interface AddPodOwnerRequest { pod_id: string; user_id: number; }
interface AddPodOwnerResponse { pod_id: string; user_id: number; }
interface GetPodOwnersResponse { owners: User[]; }
```

### User Management Types

```ts
interface UpdateUsernameRequest { username: string; }
interface RequestEmailChangeRequest { new_email: string; }
interface VerifyAndUpdateEmailRequest { new_email: string; code: string; }
interface VerifyAndUpdateEmailResponse { email: string; }
interface UpdatePasswordRequest { current_password: string; new_password: string; }
```
