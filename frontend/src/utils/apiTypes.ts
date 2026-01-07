/**
 * Shared types for the frontend API client.
 *
 * These correspond to the routes documented in `Documentation/API_routes.md`.
 */

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

export type PodLocation = {
  id: string;
  nickname: string;
  latitude: number;
  longitude: number;
  visibility: "public" | "private";
  lastUpdated?: string;
};

export type PodDataEntry = {
  id: string;
  timestamp: string;
  data: Record<string, unknown>;
  visibility: "public" | "private";
};

// ----------------------------
// Authentication
// ----------------------------

export type AuthLoginRequest = { email: string; password: string };
export type AuthLoginResponse = { user: User; accessToken: string; refreshToken: string };

export type AuthRefreshRequest = { refreshToken: string };
export type AuthRefreshResponse = { accessToken: string; refreshToken: string };

export type AuthRegisterRequest = { email: string; password: string; username: string; invitationToken: string };
export type AuthRegisterResponse = { user: User; accessToken: string; refreshToken: string };

export type AuthLogoutRequest = { refreshToken: string };
export type AuthLogoutResponse = { message: string };

export type AuthForgotPasswordRequest = { email: string };
export type AuthForgotPasswordResponse = { message: string };

export type AuthResetPasswordRequest = { email: string; newPassword: string; token: string };
export type AuthResetPasswordResponse = { message: string };

// ----------------------------
// User Management
// ----------------------------

export type GetMeResponse = { user: User };
export type GetUserByIdResponse = { user: User };

export type UpdateUsernameRequest = { username: string };
export type UpdateUsernameResponse = { message: string };

export type RequestEmailChangeRequest = { newEmail: string };
export type RequestEmailChangeResponse = { message: string };

export type VerifyAndUpdateEmailRequest = { newEmail: string; verificationCode: string };
export type VerifyAndUpdateEmailResponse = { message: string; user: Pick<User, "email"> };

export type UpdatePasswordRequest = { oldPassword: string; newPassword: string };
export type UpdatePasswordResponse = { message: string };

export type RegisterPodRequest = {
  podId: string;
  nickname: string;
  visibility: "public" | "private";
  latitude?: number;
  longitude?: number;
};
export type RegisterPodResponse = { message: string };

export type UpdatePodRequest = {
  podId: string;
  nickname?: string;
  visibility?: "public" | "private";
  latitude?: number;
  longitude?: number;
};
export type UpdatePodResponse = { message: string };

export type UnregisterPodRequest = { podId: string };
export type UnregisterPodResponse = { message: string };

// ----------------------------
// Admin
// ----------------------------

export type AdminGetAllUsersResponse = { users: User[] };

export type AdminGenerateInvitationTokenResponse = {
  invitationToken: string;
  invitationURL: string;
  expiresAt: string;
};

export type AdminRevokeInvitationTokenRequest = { invitationToken: string };
export type AdminRevokeInvitationTokenResponse = { message: string };

export type AdminDeactivateUserRequest = { deactivate: boolean; removeData: boolean };
export type AdminDeactivateUserResponse = { message: string };

// ----------------------------
// Pod Data
// ----------------------------

export type GetPodLocationsRequest = {
  latitude: number;
  longitude: number;
  radius: number;
  fromDate: string;
  toDate: string;
};
export type GetPodLocationsResponse = { pods: PodLocation[] };

export type GetPodDataResponse = { data: PodDataEntry[] };

export type UploadPodDataRequest = { podId: string; data: Record<string, unknown> };
export type UploadPodDataResponse = { podDataId: string; message: string };

export type DeletePodDataRequest = { podDataId: string };
export type DeletePodDataResponse = { message: string; podDataId: string };


