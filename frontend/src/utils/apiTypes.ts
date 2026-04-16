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

export type UserPod = {
  id: number;
  name: string;
  visibility: boolean;
  lat: string;
  long: string;
};


export type User = {
  id: string;
  email: string;
  username: string;
  pods?: UserPod[];
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
  isOwner?: boolean;
};

export type PodLocationsResponse = { pods: PodLocation[] };

export type PodDataEntry = {
  id: string;
  timestamp: string;
  data: {
    sensor_type: string;
    reading_value: number;
    reading_units: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  visibility: "public" | "private";
};

export type PodDataResponse = {
  id: string;
  nickname: string;
  latitude: number | null;
  longitude: number | null;
  visibility: "public" | "private";
  lastUpdated: string | null;
  data: PodDataEntry[];
  viewer?: {
    isAuthenticated: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    canManagePod: boolean;
  };
};

// ----------------------------
// Authentication
// ----------------------------

export type AuthLoginRequest = { email: string; password: string };
export type AuthLoginResponse = { user: User; accessToken: string; refreshToken: string };

export type AuthRefreshRequest = { refreshToken: string };
export type AuthRefreshResponse = { accessToken: string; refreshToken: string };

export type AuthRegisterRequest = { email: string; password: string; username: string; phone_number: string };
export type AuthRegisterResponse = { user: User; message: string };

export type AuthLogoutRequest = { refreshToken: string };
export type AuthForgotPasswordRequest = { email: string; traceId?: string };
export type AuthResetPasswordRequest = { email: string; newPassword: string; token: string; traceId?: string };

// ----------------------------
// User Management
// ----------------------------

export type UpdateUsernameRequest = { username: string };

export type RequestEmailChangeRequest = { newEmail: string; traceId?: string };

export type VerifyAndUpdateEmailRequest = { newEmail: string; verificationCode: string };
export type VerifyAndUpdateEmailResponse = { message: string; user: Pick<User, "email"> };

export type UpdatePasswordRequest = { oldPassword: string; newPassword: string };

export type RegisterPodRequest = {
  podId?: string;
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

export type PodActionHistoryChange = {
  field: "nickname" | "visibility" | "latitude" | "longitude";
  from: string | number | null;
  to: string | number | null;
};

export type PodActionHistoryEntry = {
  id: number;
  podId: number;
  podName: string;
  action: "added" | "edited" | "deleted";
  actionDetails: {
    changes?: PodActionHistoryChange[];
    nickname?: string;
    visibility?: "public" | "private";
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  byUser: {
    id: number;
    username: string;
  };
  atTime: string;
};

export type PodActionHistoryResponse = {
  history: PodActionHistoryEntry[];
};

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

export type LatestSensorReading = {
  id: string;
  metric: string;
  value: number;
  units: string | null;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
};

export type PodLatestReadings = {
  podId: string;
  podName: string | null;
  visibility: "public" | "private";
  latestReadings: Record<string, LatestSensorReading>;
};

export type UploadPodDataRequest = { podId: string; data: File; notes?: string };
export type UploadPodDataResponse = MessageResponse & { podDataId: string };

export type DeletePodDataRequest = { podDataId: string };
export type DeletePodDataResponse = MessageResponse & { podDataId: string };

export type PodOwnerCandidate = {
  id: number;
  username: string;
};

export type SearchPodOwnerCandidatesResponse = {
  users: PodOwnerCandidate[];
};

export type AddPodOwnerRequest = {
  userId: number;
};

export type AddPodOwnerResponse = MessageResponse & {
  podId: string;
  userId: string;
};

export type GetPodOwnersResponse = {
  owners: PodOwnerCandidate[];
};
