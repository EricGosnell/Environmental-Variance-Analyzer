# API Routes

This document outlines the API routes for the project.

# Table of Contents

- [Authentication](#authentication)
  - [Login: `/auth/login`](#login-authlogin)
  - [Refresh: `/auth/refresh`](#refresh-authrefresh)
  - [Register: `/auth/register`](#register-authregister)
  - [Send Verification: `/auth/send-verification`](#send-verification-authsend-verification)
  - [Verify Email: `/auth/verify-email`](#verify-email-authverify-email)
  - [Logout: `/auth/logout`](#logout)
  - [Forgot Password: `/auth/forgot-password`](#forgot-password)
  - [Reset Password: `/auth/reset-password`](#reset-password)
- [User Management](#user-management)
  - [Get User: `/users/me`](#get-user)
  - [Search Users by Username: `/users/search`](#search-users-by-username)
  - [Get User by ID: `/users/{id}`](#get-user-by-id)
  - [Update User Username: `/users/me/username`](#update-user-username)
  - [Update User Email:](#update-user-email)
    - [Request Email Change: `/users/me/email/request-change`](#request-email-change)
    - [Verify and Update Email: `/users/me/email`](#verify-and-update-email)
  - [Update User Phone Number: `/users/me/phone-number`](#update-user-phone-number)
  - [Update User Password: `/users/me/password`](#update-user-password)
  - [Register Pod: `/users/me/register-pod`](#register-pod)
  - [Update Pod: `/users/me/update-pod`](#update-pod)
  - [Unregister Pod: `/users/me/unregister-pod`](#unregister-pod)
- [User Management (Admin)](#user-management-admin)
  - [Get All Users: `/admin/users`](#get-all-users)
  - [Generate Invitation Token: `/admin/users/invitation-token`](#generate-invitation-token)
  - [Revoke Invitation Token: `/admin/users/invitation-token`](#revoke-invitation-token)
  - [Deactivate User: `/admin/users/{id}/deactivate`](#deactivate-user)
- [Pod Data](#pod-data)
  - [Get Pod Locations: `/pods/locations`](#get-pod-locations)
  - [Get Pod Data: `/pods/{id}/data`](#get-pod-data)
  - [Upload Pod Data: `/pods/upload-pod-data`](#upload-pod-data)
  - [Add Pod Owner: `/pods/{id}/owners`](#add-pod-owner)
  - [Get Pod Owners: `/pods/{id}/owners`](#get-pod-owners)
  - [Delete Pod Data: `/pods/delete-pod-data`](#delete-pod-data)
- [Organizations](#organizations)
  - [Get User Orgs: `/orgs`](#user-orgs)
  - [Get All Orgs: `/orgs/all`](#all-orgs)
  - [Get Org Info: `/orgs/:orgId`](#org-info)
  - [Get User Join Status: `/orgs/:orgId/status`](#user-join-status)
  - [Create Org: `/orgs/create-org`](#create-org)
  - [Create Invite: `/orgs/:orgId/invite`](#create-invite)
  - [Create Request: `/orgs/:orgId/request`](#create-request)
  - [Update Org: `/orgs/change-org`](#change-org)
  - [Change Org Role: `/orgs/:orgId/members/:userId/change-role`](#change-org-role)
  - [Leave Org: `/orgs/:orgId/leave`](#leave-org)
  - [Remove Member: `/orgs/:orgId/members/:userId`](#remove-member)
  - [Delete Org: `/orgs:orgId/delete-org`](#delete-org)
- [Messages](#messages)
  - [Get All Messages: `/messages`](#all-messages)
  - [Respond to Message: `/messages/:messageId/respond`](#message-response)
  - [Delete Message: `/messages/:messageId`](#delete-message)

## Authentication

All API routes should require authentication. Routes that do not require authentication are marked with `[public]`.

### Login

```
POST /auth/login
```

Request Parameters:

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| email     | string | Yes      | User email address |
| password  | string | Yes      | User password      |

Request Body:

```json
{
  "email": "user@example.com", // Required
  "password": "password" // Required
}
```

Response (200 OK):

```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "user",
    "phone_number": "123456789"
  },
  "accessToken": "access_token",
  "refreshToken": "refresh_token"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid email or password format"
}
```

Response (401 Unauthorized):

```json
{
  "error": "Invalid credentials"
}
```

Response (403 Forbidden):

```json
{
  "error": "Email not verified"
}
```

Response (423 Locked):

```json
{
  "error": "Account locked by admin"
}
```

This endpoint verifies user credentials and issues both an access token and a refresh token.

### Refresh

```
POST /auth/refresh
```

Request Parameters:

| Parameter    | Type   | Required | Description   |
| ------------ | ------ | -------- | ------------- |
| refreshToken | string | Yes      | Refresh token |

Request Body:

```json
{
  "refreshToken": "refresh_token" // Required
}
```

Response (200 OK):

```json
{
  "accessToken": "access_token",
  "refreshToken": "new_refresh_token" // Refresh token rotation
}
```

Response (400 Bad Request):

```json
{
  "error": "Refresh token is required"
}
```

Response (401 Unauthorized):

```json
{
  "error": "Invalid or expired refresh token"
}
```

This endpoint issues a new access token using the refresh token.

### Register

```
POST /auth/register
```

Request Parameters:

| Parameter    | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| email        | string | Yes      | User email address |
| password     | string | Yes      | User password      |
| username     | string | Yes      | Username           |
| phone_number | string | No       | User phone number  |

Request Body:

```json
{
  "email": "user@example.com", // Required
  "password": "password", // Required
  "username": "user", // Required
  "phone_number": "1234567890" // Optional
}
```

Response (201 Created):

```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "user"
  },
  "message": "Registration successful. Please verify your email."
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (409 Conflict):

```json
{
  "error": "Email or username already exists"
}
```

This endpoint creates a new user account and marks it as unverified. It does not issue login tokens.  
After registration, call `/auth/send-verification` and then `/auth/verify-email` before login.

### Send verification

```
POST /auth/send-verification
```

Request Body:

```json
{
  "email": "user@example.com" // Required
}
```

Response (200 OK):

```json
{
  "message": "If the email exists, a verification code was sent."
}
```

Response (400 Bad Request):

```json
{
  "errors": [
    {
      "msg": "Validation failed"
    }
  ]
}
```

Notes:

- This endpoint always returns a generic success message to avoid account enumeration.
- Resend throttling is enforced internally.
- Verification state is persisted only after the email provider accepts the send request.

### Verify email

```
POST /auth/verify-email
```

Request Body:

```json
{
  "email": "user@example.com", // Required
  "code": "123456" // Required, 6 digits
}
```

Response (200 OK):

```json
{
  "message": "Email verified"
}
```

Response (400 Bad Request):

```json
{
  "error": "No verification code found"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid code"
}
```

Response (400 Bad Request):

```json
{
  "error": "Code expired"
}
```

Response (429 Too Many Requests):

```json
{
  "error": "Too many attempts"
}
```

### Logout

```
POST /auth/logout
```

Request Parameters:

| Parameter    | Type   | Required | Description                 |
| ------------ | ------ | -------- | --------------------------- |
| refreshToken | string | Yes      | Refresh token to invalidate |

Request Body:

```json
{
  "refreshToken": "refresh_token" // Required
}
```

Response (200 OK):

```json
{
  "message": "Logged out successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Refresh token is required"
}
```

Response (401 Unauthorized):

```json
{
  "error": "Invalid refresh token"
}
```

This endpoint logs out the user by invalidating the refresh token.

### Forgot password

```
POST /auth/forgot-password
```

Request Parameters:

| Parameter | Type   | Required | Description        |
| --------- | ------ | -------- | ------------------ |
| email     | string | Yes      | User email address |

Request Body:

```json
{
  "email": "user@example.com" // Required
}
```

Response (200 OK):

```json
{
  "message": "Password reset email sent"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid email format"
}
```

Response (404 Not Found):

```json
{
  "error": "Email not found"
}
```

This endpoint sends a password reset email to the user's email address.

### Reset password

```
POST /auth/reset-password
```

Request Parameters:

| Parameter   | Type   | Required | Description          |
| ----------- | ------ | -------- | -------------------- |
| email       | string | Yes      | User email address   |
| newPassword | string | Yes      | New password         |
| token       | string | Yes      | Password reset token |

Request Body:

```json
{
  "email": "user@example.com", // Required
  "newPassword": "new_password", // Required
  "token": "123456" // Required
}
```

Response (200 OK):

```json
{
  "message": "Password reset successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid or expired reset token"
}
```

Response (404 Not Found):

```json
{
  "error": "Email not found"
}
```

## User Management

### Get User

```
GET /users/me
```

Response (200 OK):

```json
{
  "user": {
    "id": 123,
    "email": "user@example.com",
    "phone_number": "1234567890",
    "username": "user",
    "pods": [
      {
        "id": 1,
        "name": "My Pod",
        "visibility": true,
        "lat": "40.014",
        "long": "-105.270"
      }
    ]
  }
}
```

Response (404 Not Found):

```json
{
  "error": "User Not Found"
}
```

This endpoint returns the current user's information including their registered pods.

### Search Users by Username

```
GET /users/search
```

Authentication:

- Bearer token required.

Request Query Parameters:

| Parameter | Type    | Required | Description                                                          |
| --------- | ------- | -------- | -------------------------------------------------------------------- |
| username  | string  | Yes      | Username search term (2-16 chars, letters/numbers/underscore/hyphen) |
| limit     | integer | No       | Max number of results to return (1-50, default 20)                   |

Example Request:

```
GET /users/search?username=ann&limit=10
```

Response (200 OK):

```json
{
  "users": [
    { "id": 12, "username": "anna" },
    { "id": 35, "username": "joanna" }
  ]
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid search parameters"
}
```

Response (401 Unauthorized):

```json
{
  "error": "No token provided"
}
```

This endpoint searches users by username using case-insensitive contains matching. Results are ranked in this order: exact match, prefix match, then contains match, with alphabetical ordering as the tiebreaker.

### Get User by ID

```
GET /users/{id}
```

Response (200 OK):

```json
{
  "user": {
    "id": "123",
    "username": "user",
    "createdAt": "2021-01-01T00:00:00.000Z",
    "devices": ["device_id_1", "device_id_2"], // Optional: Array of device IDs (only if user is the owner or admin)
    "posts": ["post_id_1", "post_id_2"], // Optional: Array of post IDs (only public posts if user is not the owner or admin)
    "email": "user@example.com", // Optional: User email address (only if user is the owner or admin)
    "phone_number": "1234567890" // Optional: User phone number (only if user is the owner or admin)
  }
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid user ID"
}
```

Response (404 Not Found):

```json
{
  "error": "User not found"
}
```

This endpoint returns the user's information by ID.

### Update user username

```
PUT /users/me/username
```

Request Parameters:

| Parameter | Type   | Required | Description  |
| --------- | ------ | -------- | ------------ |
| username  | string | Yes      | New username |

Request Body:

```json
{
  "username": "new_username" // Required, between 4 and 16 characters
}
```

Response (200 OK):

```json
{
  "message": "Username updated successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid username format"
}
```

Response (409 Conflict):

```json
{
  "error": "Username already taken"
}
```

This endpoint updates the current user's username.

### Update user email

This is a two-step process that requires email verification for security.

#### Request Email Change

```
POST /users/me/email/request-change
```

Request Parameters:

| Parameter | Type   | Required | Description       |
| --------- | ------ | -------- | ----------------- |
| newEmail  | string | Yes      | New email address |

Request Body:

```json
{
  "newEmail": "newemail@example.com" // Required, 255 max length
}
```

Response (200 OK):

```json
{
  "message": "Verification code sent to new email"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid email format"
}
```

Response (409 Conflict):

```json
{
  "error": "Email already in use"
}
```

This endpoint sends a verification code to the new email address via the email service. The user must verify this code before the email can be updated.

#### Verify and Update Email

```
PUT /users/me/email
```

Request Parameters:

| Parameter        | Type   | Required | Description                             |
| ---------------- | ------ | -------- | --------------------------------------- |
| newEmail         | string | Yes      | New email address                       |
| verificationCode | string | Yes      | Verification code sent to the new email |

Request Body:

```json
{
  "newEmail": "newemail@example.com", // Required
  "verificationCode": "123456" // Required
}
```

Response (200 OK):

```json
{
  "message": "Email updated successfully",
  "user": {
    "email": "newemail@example.com"
  }
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid or expired verification code"
}
```

Response (400 Bad Request):

```json
{
  "error": "Email does not match pending change request"
}
```

Response (404 Not Found):

```json
{
  "error": "No pending email change request found"
}
```

This endpoint verifies the code sent to the new email address and updates the user's email if the code is valid.

### Update user phone number

```
PUT /users/me/phone-number
```

Request Parameters:

| Parameter    | Type   | Required | Description      |
| ------------ | ------ | -------- | ---------------- |
| phone_number | string | Yes      | New phone number |

Request Body:

```json
{
  "phone_number": "1234567890" // Required
}
```

Response (200 OK):

```json
{
  "message": "Phone number updated successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid phone number format"
}
```

This endpoint updates the current user's phone number. Note: Currently, no verification is required for the updated number, but this may be added in the future (e.g., via SMS verification).

### Update user password

```
PUT /users/me/password
```

Request Parameters:

| Parameter   | Type   | Required | Description      |
| ----------- | ------ | -------- | ---------------- |
| oldPassword | string | Yes      | Current password |
| newPassword | string | Yes      | New password     |

Request Body:

```json
{
  "oldPassword": "old_password", // Required
  "newPassword": "new_password" // Required
}
```

Response (200 OK):

```json
{
  "message": "Password updated successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid old password"
}
```

Response (404 Not Found):

```json
{
  "error": "User not found"
}
```

This endpoint updates the current user's password.

### Register Pod

```
POST /users/me/register-pod
```

Request Parameters:

| Parameter  | Type   | Required | Description                           |
| ---------- | ------ | -------- | ------------------------------------- |
| podId      | string | Yes      | The pod ID                            |
| nickname   | string | Yes      | Nickname for the pod                  |
| visibility | string | Yes      | Pod visibility: "public" or "private" |
| latitude   | number | No       | Optional latitude coordinate          |
| longitude  | number | No       | Optional longitude coordinate         |

Request Body:

```json
{
  "podId": "123", // Required
  "nickname": "nickname", // Required
  "visibility": "public", // Required: "public" or "private"
  "latitude": 123.456, // Optional
  "longitude": 123.456 // Optional
}
```

Response (200 OK):

```json
{
  "message": "Pod registered successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "One or more required parameters are invalid or missing"
}
```

Response (400 Bad Request):

```json
{
  "error": "Latitude must have at least three decimal places"
}
```

Response (400 Bad Request):

```json
{
  "error": "Longitude must have at least three decimal places"
}
```

Response (409 Conflict):

```json
{
  "message": "Pod already registered"
}
```

This endpoint registers a new pod for the current user.

Note: Data cannot be uploaded to the pod until latitude and longitude are provided. Do so after registering the pod with `/users/me/update-pod`.

### Update Pod

```
PUT /users/me/update-pod
```

Request Parameters:

| Parameter  | Type   | Required | Description                           |
| ---------- | ------ | -------- | ------------------------------------- |
| podId      | string | Yes      | The pod ID                            |
| nickname   | string | No       | Optional nickname for the pod         |
| visibility | string | No       | Pod visibility: "public" or "private" |
| latitude   | number | No       | Optional latitude coordinate          |
| longitude  | number | No       | Optional longitude coordinate         |

Request Body:

```json
{
  "podId": "123", // Required
  "nickname": "nickname", // Optional
  "visibility": "public", // Optional: "public" or "private"
  "latitude": 123.456, // Optional
  "longitude": 123.456 // Optional
}
```

Response (200 OK):

```json
{
  "message": "Pod updated successfully"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not found"
}
```

Response (400 Bad Request):

```json
{
  "error": "One or more required parameters are invalid or missing"
}
```

Response (400 Bad Request):

```json
{
  "error": "Latitude must have at least three decimal places"
}
```

Response (400 Bad Request):

```json
{
  "error": "Longitude must have at least three decimal places"
}
```

This endpoint updates the current user's pod.

### Unregister Pod

```
DELETE /users/me/unregister-pod
```

Response (200 OK):

```json
{
  "message": "Pod unregistered successfully"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not registered or found"
}
```

This endpoint deletes the current user's pod.

## User Management (Admin)

### Get All Users

```
GET /admin/users
```

Response (200 OK):

```json
{
  "users": [
    {
      "id": "123",
      "email": "user@example.com",
      "username": "user",
      "createdAt": "2021-01-01T00:00:00.000Z",
      "updatedAt": "2021-01-01T00:00:00.000Z"
    }
  ]
}
```

This endpoint returns all users in the database.

### Generate Invitation Token

```
GET /admin/users/invitation-token
```

Response (200 OK):

```json
{
  "invitationToken": "ABCD-EFGH",
  "invitationURL": "https://example.com/register?token=ABCD-EFGH",
  "expiresAt": "2021-01-01T00:00:00.000Z"
}
```

This endpoint generates a new invitation token for a user. The invitation token is valid for 1 week.

### Revoke Invitation Token

```
DELETE /admin/users/invitation-token
```

Request Parameters:

| Parameter       | Type   | Required | Description                |
| --------------- | ------ | -------- | -------------------------- |
| invitationToken | string | Yes      | Invitation token to revoke |

Request Body:

```json
{
  "invitationToken": "ABCD-EFGH" // Required
}
```

Response (200 OK):

```json
{
  "message": "Invitation token revoked successfully"
}
```

Response (404 Not Found):

```json
{
  "error": "Invitation token not found"
}
```

This endpoint revokes an invitation token.

### Deactivate User

```
PUT /admin/users/{id}/deactivate
```

Request Parameters:

| Parameter  | Type    | Required | Description                    |
| ---------- | ------- | -------- | ------------------------------ |
| deactivate | boolean | Yes      | Whether to deactivate the user |
| removeData | boolean | Yes      | Whether to remove user data    |

Request Body:

```json
{
  "deactivate": true, // Required
  "removeData": true // Required
}
```

Response (200 OK):

```json
{
  "message": "User deactivated successfully"
}
```

Response (404 Not Found):

```json
{
  "error": "User not found"
}
```

## Pod Data

Users can only update their own pod data. Admins can update any pod data. Users can view public pods without authentication.

### Get Pod Locations

```
GET /pods/locations
```

Request Parameters:

| Parameter | Type   | Required | Description                            |
| --------- | ------ | -------- | -------------------------------------- |
| latitude  | number | Yes      | Latitude coordinate for search center  |
| longitude | number | Yes      | Longitude coordinate for search center |
| radius    | number | Yes      | Search radius in meters                |
| fromDate  | string | No       | Start date in ISO 8601 format          |
| toDate    | string | No       | End date in ISO 8601 format            |

Request Body:

```json
{
  "latitude": 123.456, // Required
  "longitude": 123.456, // Required
  "radius": 1000, // Required
  "fromDate": "2021-01-01T00:00:00.000Z",
  "toDate": "2021-01-01T00:00:00.000Z"
}
```

Response (200 OK):

```json
{
  "pods": [
    {
      "id": "123",
      "nickname": "nickname",
      "latitude": 123.456,
      "longitude": 123.456,
      "visibility": "public", // "public" or "private"
      "lastUpdated": "2021-01-01T00:00:00.000Z",
      "isOwner": true // true if authenticated user owns this pod, false otherwise
    }
  ]
}
```

Response (400 Bad Request):

```json
{
  "error": "One or more required parameters are invalid or missing"
}
```

This endpoint returns all pod names and their locations. Will return all pods if the user is an admin, otherwise will return only return public pods and user's own pods.

### Get Pod Data

```
GET /pods/{id}/data
```

Authentication:

- Optional. Public pods are accessible anonymously. Private pods require the requesting user to be the owner or an admin.

Response (200 OK):

```json
{
  "id": "123",
  "nickname": "nickname",
  "latitude": 40.014,
  "longitude": -105.27,
  "visibility": "public",
  "lastUpdated": "2021-01-01T00:00:00.000Z",
  "data": [
    {
      "id": "456",
      "timestamp": "2021-01-01T00:00:00.000Z",
      "data": {
        "sensor_type": "temperature",
        "reading_value": 23.5,
        "reading_units": "C",
        "location": {
          "latitude": 40.014,
          "longitude": -105.27
        }
      },
      "visibility": "public"
    }
  ],
  "viewer": {
    "isAuthenticated": true,
    "isOwner": true,
    "isAdmin": false,
    "canManagePod": true
  }
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (403 Forbidden):

```json
{
  "error": "Forbidden"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not found"
}
```

This endpoint returns all recorded sensor data for a specific pod. The `viewer` object indicates the requesting user's permissions. Pod metadata (`id`, `nickname`, `latitude`, `longitude`, `visibility`, `lastUpdated`) is derived from the pod record and the most recent `pod_data` row.

### Upload Pod Data

```
POST /pods/upload-pod-data
```

Request Parameters:

| Parameter | Type   | Required | Description                            |
| --------- | ------ | -------- | -------------------------------------- |
| podId     | string | Yes      | The pod ID                             |
| data      | file   | Yes      | CSV file containing the pod data       |
| notes     | string | No       | Optional notes for the pod data upload |

Request Body:

```json
{
  "podId": "123", // Required: The pod ID
  "data": "<csv_file>", // Required: CSV file with the pod data
  "notes": "Optional notes" // Optional: Notes for the pod data upload
}
```

Response (200 OK):

```json
{
  "podDataId": "123",
  "message": "Pod data uploaded successfully"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid pod data"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not registered"
}
```

Response (403 Forbidden):

```json
{
  "error": "Pod location not set"
}
```

This endpoint uploads pod data to the database.

### Add Pod Owner

```
POST /pods/{id}/owners
```

Authentication:

- Bearer token required. The requesting user must own the pod or be an admin.

Request Parameters:

| Parameter | Type    | Required | Description                                          |
| --------- | ------- | -------- | ---------------------------------------------------- |
| id        | integer | Yes      | Pod ID (URL parameter, positive integer)             |
| userId    | integer | Yes      | ID of the user to add as an owner (positive integer) |

Request Body:

```json
{
  "userId": 42
}
```

Response (201 Created):

```json
{
  "message": "Pod owner added successfully",
  "podId": "123",
  "userId": "42"
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "userId", "message": "userId must be a positive integer" }
  ]
}
```

Response (403 Forbidden):

```json
{
  "error": "Forbidden"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not found"
}
```

```json
{
  "error": "User not found"
}
```

Response (409 Conflict):

```json
{
  "error": "User is already an owner of this pod"
}
```

This endpoint adds a user as a co-owner of a pod. The requesting user must already own the pod (or be an admin). The target user is looked up by `userId` — use `GET /users/search` to find users by username.

### Get Pod Owners

```
GET /pods/{id}/owners
```

Authentication:

- Bearer token required. The requesting user must own the pod or be an admin.

Request Parameters:

| Parameter | Type    | Required | Description                              |
| --------- | ------- | -------- | ---------------------------------------- |
| id        | integer | Yes      | Pod ID (URL parameter, positive integer) |

Example Request:

```
GET /pods/123/owners
```

Response (200 OK):

```json
{
  "owners": [
    { "id": 1, "username": "alice" },
    { "id": 42, "username": "bob" }
  ]
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed",
  "details": [{ "field": "id", "message": "Pod id must be a positive integer" }]
}
```

Response (403 Forbidden):

```json
{
  "error": "Forbidden"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod not found"
}
```

This endpoint returns all owners of a pod. The requesting user must be an owner of the pod or an admin. Owners are returned sorted alphabetically by username.

### Delete Pod Data

```
DELETE /pods/delete-pod-data
```

Request Parameters:

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| podDataId | string | Yes      | The pod data ID |

Request Body:

```json
{
  "podDataId": "123" // Required
}
```

Response (200 OK):

```json
{
  "message": "Pod data deleted successfully",
  "podDataId": "123"
}
```

Response (404 Not Found):

```json
{
  "error": "Pod data not found"
}
```

Response (400 Bad Request):

```json
{
  "error": "Invalid pod data ID"
}
```

This endpoint deletes a specific pod data entry from the database.

## Organizations

Organizations should only be visible to users who have logged in.

### Get User Orgs

```
GET /orgs
```

Authentication:

- Bearer token required.

Response (200 OK)

```json
{
  "orgs": [
    {
      "org_id": "1",
      "org_name": "Example Org",
      "org_email": "org@example.com",
      "org_bio": "Org Biography"
    }
  ]
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

This endpoint returns all organizations the authenticated user is a member of.

### Get All Orgs

```
GET /orgs/all
```

Authentication:

- Bearer token required.

Response (200 OK)

```json
{
  "orgs": []
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

This endpoint returns all organizations in the system.

### Get Org Info

```
GET /orgs:orgId
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description           |
|-----------|---------| -------- |-----------------------|
| orgId     | integer | Yes      | The organization's ID |

Response (200 OK)

```json
{
  "org": {
    "org_id": "1",
    "org_name": "Example Org",
    "org_email": "org@example.com",
    "org_bio": "Org Biography"
  }
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (404 Not Found):

```json
{
  "error": "Org not found"
}
```

This endpoint returns details for a specific organization.

### Get User Join Status

```
GET /orgs/:orgId/status
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description                                       |
|-----------|---------| -------- |---------------------------------------------------|
| orgId     | integer | Yes      | ID of the organization the user is trying to join |

Response (200 OK)

```json
{
  "status": "joined"
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (404 Not Found):

```json
{
  "error": "Status not found"
}
```

This endpoint returns a user's status for joining an organization.

### Create Org

```
POST /orgs/create-org
```

Authentication:

- Bearer token required.

Request Body:

```json
{
  "name": "Org Name", // Required
  "email": "org@example.com", // Required
  "bio": "Org Biography"
}
```
Response (201 Created):

```json
{
  "orgId": 1
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

This endpoint creates a new organization and assigns the creator as admin.

### Create Invite

```
POST /orgs/:orgId/invite
```

Authentication:

- Bearer token required. User must be an org admin.

Request Parameters:

| Parameter | Type    | Required | Description                                         |
|-----------|---------| -------- |-----------------------------------------------------|
| orgId     | integer | Yes      | ID of the organization the user is being invited to |

Request Body:

```json
{
  "userId": 123 // Required
}
```

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Invite already exists"
}
```

Response (403 Forbidden):

```json
{
  "error": "Invites can be sent by admins only"
}
```

This endpoint sends an invitation to a user to join an organization.

### Create Request

```
POST /orgs/:orgId/request
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description                                           |
|-----------|---------| -------- |-------------------------------------------------------|
| orgId     | integer | Yes      | ID of the organization the user is requesting to join |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Request already exists"
}
```

This endpoint creates a request from a user to join an organization.

### Change Org

```
PUT /orgs/:orgId/change-org
```

Authentication:

- Bearer token required. User must be an org admin.

Request Parameters:

| Parameter | Type    | Required | Description                         |
|-----------|---------| -------- |-------------------------------------|
| orgId     | integer | Yes      | ID of the organization being edited |

Request Body:

```json
{
  "name": "New Name",
  "email": "new@email.com",
  "bio": "Updated Biography"
}
```

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (403 Forbidden):

```json
{
  "error": "Only admin can update org"
}
```

This endpoint updates organization details.

### Change Org Role

```
PUT /orgs/:orgId/members/:userId/change-role
```

Authentication:

- Bearer token required. User must be an org admin.

Request Parameters:

| Parameter | Type    | Required | Description                            |
|-----------| ------- | -------- |----------------------------------------|
| orgId     | integer | Yes      | ID of the user's organization          |
| userId    | integer | Yes      | ID of the user being promoted to admin |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "User is not a member"
}
```

Response (403 Forbidden):

```json
{
  "error": "Only admin can change member roles"
}
```

This endpoint promotes an organization member to admin.

### Leave Org

```
DELETE /orgs/:orgId/leave
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description                                |
|-----------|---------| -------- |--------------------------------------------|
| orgId     | integer | Yes      | ID of the organization the user is leaving |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Cannot leave as the only admin"
}
```

Response (403 Forbidden):

```json
{
  "error": "User is not a member"
}
```

This endpoint removes a user from the organization when they leave.

### Remove Member

```
DELETE /orgs/:orgId/members/:userId
```

Authentication:

- Bearer token required. User must be an org admin.

Request Parameters:

| Parameter | Type    | Required | Description                   |
|-----------| ------- | -------- |-------------------------------|
| orgId     | integer | Yes      | ID of the user's organization |
| userId    | integer | Yes      | ID of the user being removed  |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (403 Forbidden):

```json
{
  "error": "Only admins can remove members"
}
```

Response (404 Not Found):
```json
{
  "error": "User is not a member"
}
```

This endpoint removes a user from the organization by an admin.

### Delete Org

```
DELETE /orgs/:orgId/delete-org
```

Authentication:

- Bearer token required. User must be an org admin.

Request Parameters:

| Parameter | Type    | Required | Description                      |
|-----------|---------| -------- |----------------------------------|
| orgId     | integer | Yes      | ID of organization being deleted |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (403 Forbidden):

```json
{
  "error": "Only admin can delete org"
}
```

This endpoint deletes an organization.

## Messages

Users should only be able to view and interact with their own messages.

### Get All Messages

```
GET /messages
```

Authentication:

- Bearer token required.

Response (200 OK)

```json
{
  "messages": [
    {
      "message_id": 1,
      "sender_id": 2,
      "receiver_id": 3,
      "type": "invite",
      "org_id": 1,
      "status": "pending",
      "created_at": "timestamp",
      "org_name": "Example Org",
      "org_email": "org@example.com",
      "org_bio": "Org Biography"
    }
  ]
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

This endpoint returns all messages for the user.

### Respond to Message

```
PUT /messages/:messageId/respond
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description                                                   |
|-----------|---------| -------- |---------------------------------------------------------------|
| messageID | integer | Yes      | ID of the invite/request message that is user is responding to |

Request Body:

```json
{
  "action": "accepted"
}
```

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Message already handled"
}
```

Response (403 Forbidden):

```json
{
  "error": "Message does not belong to user"
}
```

Response (404 Not Found):
```json
{
  "error": "Message not found"
}
```

This endpoint accepts or denies an invitation or join request.

### Delete Message

```
DELETE /messages/:messageId
```

Authentication:

- Bearer token required.

Request Parameters:

| Parameter | Type    | Required | Description                     |
|-----------|---------| -------- |---------------------------------|
| messageID | integer | Yes      | ID of the message being deleted |

Response (200 OK)

```json
{
  "success": true
}
```

Response (400 Bad Request):

```json
{
  "error": "Validation failed"
}
```

Response (403 Forbidden):

```json
{
  "error": "Message does not belong to user"
}
```

Response (404 Not Found):
```json
{
  "error": "Message not found"
}
```

This endpoint deletes a user's message.
