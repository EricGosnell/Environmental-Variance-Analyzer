# Backend Architecture

The Environmental Variance Analyzer (EVA) backend is built with Node.js and Express. It provides a RESTful API to manage users, authentication, environmental data pods, and sensor data.

## Tech Stack
- **Node.js & Express:** Core server framework.
- **SQLite3:** Relational database for persistent storage.
- **Security:** `helmet` / custom headers, `cors`, `xss` for sanitization, and `express-validator` for payload validation.
- **Authentication:** `jsonwebtoken` for stateless access/refresh token management, and `bcryptjs` for password hashing.
- **Email:** `@getbrevo/brevo` for transactional emails.

## Entry Point: `server.js`
The `server.js` file is the entry point of the backend application. Its main responsibilities include:
1. **Middleware Setup:** Configuring CORS for development, JSON body parsing, and serving static files from the `Pages/` directory.
2. **Security Headers:** Applying `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection` to all responses.
3. **Database Initialization:** Calling `createDB()` to connect to SQLite and run the schema setup.
4. **Route Mounting:** Attaching the core API routers (`auth`, `users`, `pods`) under the `/api` prefix.
5. **Cleanup Job:** Running an interval every 15 minutes to delete expired tokens, password reset codes, and email verification entries from the database.
6. **Graceful Shutdown:** Listening to `SIGINT` to safely close the SQLite database connection before exiting.

## Directory Structure
- **`API/`**: Express routers handling the core endpoints (`auth.js`, `pod.js`, `user.js`).
- **`API/middleware/`**: Contains request middleware like `sanitize.js` for XSS protection and validation.
- **`database/`**: Contains database initialization logic (`databaseInit.js`) and the SQL schema definition (`db.sql`).
- **`test/`**: Mocha/Chai testing suite and mocked database initialization for testing.
- **`util/`**: Reusable helpers such as `JWT.js`, `email.js`, `passwordPolicy.js`, and database query abstractions (e.g., `podQueries.js`).