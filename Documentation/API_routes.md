# API Routes

This document outlines the API routes for the project.

# Table of Contents

- [Authentication](#authentication)
  - [Login](#login)
  - [Refresh](#refresh)
  - [Register](#register)
  - [Logout](#logout)
  - [Forgot Password](#forgot-password)
  - [Reset Password](#reset-password)
- [User Management](#user-management)
  - [Get User](#get-user)
  - [Get User by ID](#get-user-by-id)
  - [Update User Username](#update-user-username)
  - [Update User Email](#update-user-email)
    - [Request Email Change](#request-email-change)
    - [Verify and Update Email](#verify-and-update-email)
  - [Update User Password](#update-user-password)
- [User Management (Admin)](#user-management-admin)
  - [Get All Users](#get-all-users)
  - [Generate Invitation Token](#generate-invitation-token)
  - [Revoke Invitation Token](#revoke-invitation-token)
  - [Deactivate User](#deactivate-user)

## Authentication

All API routes should require authentication. Routes that do not require authentication are marked with `[public]`.

### Login

```
POST /auth/login
```

Request Body:
```json
{
    "email": "user@example.com",
    "password": "password"
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

This endpoint verifies user credientials and issues both an access token and a refresh token.

### Refresh

```
POST /auth/refresh
```

Request Body:
```json
{
  "refreshToken": "refresh_token"
}
```

Response (200 OK):
```json
{
  "accessToken": "access_token",
  "refreshToken": "new_refresh_token" # refresh token rotation
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

Request Body:
```json
{
  "email": "user@example.com",
  "password": "password",
  "username": "user",
  "invitationToken": "ABCD-EFGH"
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

Request Body:
```json
{
  "refreshToken": "refresh_token"
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

Request Body:
```json
{
  "email": "user@example.com"
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

Request Body:
```json
{
  "email": "user@example.com",
  "newPassword": "new_password",
  "token": "123456"
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
    "username": "user",
    "devices": String[], # list of device IDs
    "posts": String[], # list of post IDs
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
    "email": "user@example.com",
    "username": "user",
    "createdAt": "2021-01-01T00:00:00.000Z",
    "devices"?: String[], # list of device IDs (only if user is the owner or admin)
    "posts"?: String[], # list of post IDs (only public posts if user is not the owner or admin)
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

Request Body:
```json
{
  "username": "new_username"
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

Request Body:
```json
{
  "newEmail": "newemail@example.com"
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

Request Body:
```json
{
  "newEmail": "newemail@example.com",
  "verificationCode": "123456"
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

### Update user password

```
PUT /users/me/password
```

Request Body:
```json
{
  "oldPassword": "old_password",
  "newPassword": "new_password"
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

Request Body:
```json
{
  "invitationToken": "ABCD-EFGH"
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

Request Body:
```json
{
  "deactivate": true,
  "removeData": true
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

