/**
 * Shared types for the frontend API client.
 *
 * These correspond to the routes documented in `Documentation/API_routes.md`.
 */

// ----------------------------
// Shared, reusable shapes
// ----------------------------

export type MessageResponse = { message: string };

// ----------------------------
// Core models
// ----------------------------

export type User = {
  id: string;
  email: string;
  username: string;
  pods?: string[];
  podData?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type UserResponse = { user: User };
export type UsersResponse = { users: User[] };

export type PodLocation = {
  id: string;
  nickname: string;
  latitude: number;
  longitude: number;
  visibility: "public" | "private";
  lastUpdated?: string;
};

export type PodLocationsResponse = { pods: PodLocation[] };

export type PodDataEntry = {
  id: string;
  timestamp: string;
  data: {
    sensor_data_id: string;
    pod_data_id: string;
    sensor_type: string;
    reading_value: number;
    reading_units: string;
    reading_timestamp: string;
    raw_data: Record<string, unknown>; // JSONB raw sensor payload
    created_at: string;
  };
  visibility: "public" | "private";
};

export type PodDataResponse = {
  id: string;
  nickname: string;
  latitude: number;
  longitude: number;
  visibility: "public" | "private";
  lastUpdated: string;
  data: PodDataEntry[];
};

// ----------------------------
// Authentication
// ----------------------------

export type AuthLoginRequest = { email: string; password: string };
export type AuthLoginResponse = { user: User; accessToken: string; refreshToken: string };

export type AuthRefreshRequest = { refreshToken: string };
export type AuthRefreshResponse = { accessToken: string; refreshToken: string };

export type AuthRegisterRequest = { email: string; password: string; username: string; phone_number: string };
export type AuthRegisterResponse = { user: User; accessToken: string; refreshToken: string };

export type AuthLogoutRequest = { refreshToken: string };
export type AuthForgotPasswordRequest = { email: string };
export type AuthResetPasswordRequest = { email: string; newPassword: string; token: string };

// ----------------------------
// User Management
// ----------------------------

export type UpdateUsernameRequest = { username: string };

export type RequestEmailChangeRequest = { newEmail: string };

export type VerifyAndUpdateEmailRequest = { newEmail: string; verificationCode: string };
export type VerifyAndUpdateEmailResponse = { message: string; user: Pick<User, "email"> };

export type UpdatePasswordRequest = { oldPassword: string; newPassword: string };

export type RegisterPodRequest = {
  podId: string;
  nickname: string;
  visibility: "public" | "private";
  latitude?: number;
  longitude?: number;
};

export type UpdatePodRequest = {
  podId: string;
  nickname?: string;
  visibility?: "public" | "private";
  latitude?: number;
  longitude?: number;
};

export type UnregisterPodRequest = { podId: string };

// ----------------------------
// Admin
// ----------------------------

export type AdminGenerateInvitationTokenResponse = {
  invitationToken: string;
  invitationURL: string;
  expiresAt: string;
};

export type AdminRevokeInvitationTokenRequest = { invitationToken: string };

export type AdminDeactivateUserRequest = { deactivate: boolean; removeData: boolean };

// ----------------------------
// Pod Data
// ----------------------------

export type GetPodLocationsRequest = {
  latitude: number;
  longitude: number;
  radius: number;
  fromDate?: string;
  toDate?: string;
};
export type UploadPodDataRequest = { podId: string; data: File; notes?: string };
export type UploadPodDataResponse = MessageResponse & { podDataId: string };

export type DeletePodDataRequest = { podDataId: string };
export type DeletePodDataResponse = MessageResponse & { podDataId: string };


