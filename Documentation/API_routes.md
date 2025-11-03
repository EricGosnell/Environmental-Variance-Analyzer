# API Routes

This document outlines the API routes for the project.

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

Response:
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

Response:
```json
{
  "accessToken": "access_token",
  "refreshToken": "new_refresh_token" # refresh token rotation
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

Response:
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

Response:
```json
{
  "message": "Logged out successfully"
}
```

This endpoint logs out the user by invalidating the refresh token.

## User Management

### Get User

```
GET /users/me
```

Response:
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

Response:
```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "username": "user",
    "devices"?: String[], # list of device IDs (only if user is the owner)
    "posts"?: String[], # list of post IDs (only public posts if user is not the owner)
  }
}
```

This endpoint returns the user's information by ID.

### update User username

```
PUT /users/me/username
```

Request Body:
```json
{
  "username": "new_username"
}
```

Response:
```json
{
  "message": "Username updated successfully"
}
```

This endpoint updates the current user's username.

### update User email

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

Response:
```json
{
  "message": "Verification code sent to new email"
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

Response:
```json
{
  "message": "Email updated successfully",
  "user": {
    "email": "newemail@example.com"
  }
}
```

This endpoint verifies the code sent to the new email address and updates the user's email if the code is valid.

