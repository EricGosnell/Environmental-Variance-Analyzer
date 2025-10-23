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
  "username": "user"
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