# API Routes

This document outlines the API routes for the project.

 # Table of Contents

- [Authentication](#authentication)
  - [Login: `/auth/login`](#login-authlogin)
  - [Refresh: `/auth/refresh`](#refresh-authrefresh)
  - [Register: `/auth/register`](#register-authregister)
  - [Logout: `/auth/logout`](#logout)
  - [Forgot Password: `/auth/forgot-password`](#forgot-password)
  - [Reset Password: `/auth/reset-password`](#reset-password)
- [User Management](#user-management)
  - [Get User: `/users/me`](#get-user)
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
  - [Delete Pod Data: `/pods/delete-pod-data`](#delete-pod-data)
## Authentication

All API routes should require authentication. Routes that do not require authentication are marked with `[public]`.

### Login

```
POST /auth/login
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |

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
    "username": "user"
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

This endpoint verifies user credentials and issues both an access token and a refresh token.

### Refresh

```
POST /auth/refresh
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| refreshToken | string | Yes | Refresh token |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address |
| password | string | Yes | User password |
| username | string | Yes | Username |
| phone_number | string | Yes | User phone number |

Request Body:
```json
{
  "email": "user@example.com", // Required
  "password": "password", // Required
  "username": "user", // Required
  "phone_number": "1234567890", // Required
}
```

Response (200 OK):
```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "user"
  },
  "accessToken": "access_token",
  "refreshToken": "refresh_token"
}
```

Response (400 Bad Request):
```json
{
  "error": "Invalid input data or invalid invitation token"
}
```

Response (409 Conflict):
```json
{
  "error": "Email or username already exists"
}
```

This endpoint creates a new user account.

### Logout

```
POST /auth/logout
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| refreshToken | string | Yes | Refresh token to invalidate |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address |
| newPassword | string | Yes | New password |
| token | string | Yes | Password reset token |

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
    "id": "123",
    "email": "user@example.com",
    "phone_number": "1234567890",
    "username": "user",
    "pods": ["pod_id_1", "pod_id_2"], // Array of pod IDs
    "podData": ["pod_data_id_1", "pod_data_id_2"] // Array of pod data IDs
  }
}
```

This endpoint returns the current user's information.

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
    "phone_number": "1234567890", // Optional: User phone number (only if user is the owner or admin)
  }
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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | Yes | New username |

Request Body:
```json
{
  "username": "new_username" // Required
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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| newEmail | string | Yes | New email address |

Request Body:
```json
{
  "newEmail": "newemail@example.com" // Required
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

This endpoint sends a verification code to the new email address. The user must verify this code before the email can be updated.

#### Verify and Update Email

```
PUT /users/me/email
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| newEmail | string | Yes | New email address |
| verificationCode | string | Yes | Verification code sent to the new email |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone_number | string | Yes | New phone number |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| oldPassword | string | Yes | Current password |
| newPassword | string | Yes | New password |

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

This endpoint updates the current user's password.

### Register Pod

```
POST /users/me/register-pod
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| podId | string | Yes | The pod ID |
| nickname | string | Yes | Nickname for the pod |
| visibility | string | Yes | Pod visibility: "public" or "private" |
| latitude | number | No | Optional latitude coordinate |
| longitude | number | No | Optional longitude coordinate |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| podId | string | Yes | The pod ID |
| nickname | string | No | Optional nickname for the pod |
| visibility | string | No | Pod visibility: "public" or "private" |
| latitude | number | No | Optional latitude coordinate |
| longitude | number | No | Optional longitude coordinate |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| invitationToken | string | Yes | Invitation token to revoke |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| deactivate | boolean | Yes | Whether to deactivate the user |
| removeData | boolean | Yes | Whether to remove user data |

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| latitude | number | Yes | Latitude coordinate for search center |
| longitude | number | Yes | Longitude coordinate for search center |
| radius | number | Yes | Search radius in meters |
| fromDate | string | No | Start date in ISO 8601 format |
| toDate | string | No | End date in ISO 8601 format |

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
      "lastUpdated": "2021-01-01T00:00:00.000Z"
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

Response (200 OK):
```json
{
  "id": "123",
  "nickname": "nickname",
  "latitude": 123.456,
  "longitude": 123.456,
  "visibility": "public", // "public" or "private"
  "lastUpdated": "2021-01-01T00:00:00.000Z",
  "data": [
    {
      "id": "123",
      "timestamp": "2021-01-01T00:00:00.000Z",
      "data": {
        "sensor_data_id": "123",
        "pod_data_id": "pod_data_id_1",
        "sensor_type": "temperature",
        "reading_value": 23.5,
        "reading_units": "C",
        "reading_timestamp": "2021-01-01T00:00:00.000Z",
        "raw_data": {}, // JSONB raw sensor payload
        "created_at": "2021-01-01T00:00:00.000Z"
      },
      "visibility": "public" // "public" or "private"
    }
  ]
}
```

Response (404 Not Found):
```json
{
  "error": "Pod not found"
}
```

This endpoint returns all recorded data for a specific pod sorted by timestamp in descending order. Only accessible if pod is public or the user is the owner of the pod.

TODO: Location history of pod.

### Upload Pod Data

```
POST /pods/upload-pod-data
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| podId | string | Yes | The pod ID |
| data | file | Yes | CSV file containing the pod data |
| notes | string | No | Optional notes for the pod data upload |

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

### Delete Pod Data

```
DELETE /pods/delete-pod-data
```

Request Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| podDataId | string | Yes | The pod data ID |

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