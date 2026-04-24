# Authentication & Security

The EVA backend uses a robust, stateless JWT-based authentication system alongside proactive sanitization and validation.

## JWT Strategy
- **Tokens**: The API utilizes both Access Tokens and Refresh Tokens.
- **Lifespan**: Access Tokens are short-lived (e.g., 15 minutes). Refresh Tokens are long-lived (e.g., 7 days) and are securely stored in the `refresh_tokens` SQLite table.
- **Configuration**: Expiration times and secrets are defined in `util/JWT.js` and controlled via environment variables (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).

## Input Validation & Sanitization
All incoming payloads are intercepted by middleware configured in `API/middleware/sanitize.js`:
- **XSS Protection**: Uses the `xss` library to strip potentially malicious scripts from incoming strings. It recursively cleans request bodies, explicitly skipping password fields.
- **Validation**: Uses `express-validator` to enforce strict constraints (e.g., `MIN_USERNAME_LENGTH`, email formatting). Failed validations immediately reject requests before they reach the controller logic.

## Password Policies
- Passwords are never stored in plain text. They are hashed using `bcryptjs` before insertion into the `users` table.
- The `util/passwordPolicy.js` module enforces standard complexity requirements (length, special characters) during user registration and password resets.

## Email Services (Brevo API)
Transactional emails (account verification, password resets) are sent using the Brevo API (`@getbrevo/brevo`), handled in `util/email.js`. 
- **Dry-Run Mode**: For testing or local development, setting `EMAIL_DRY_RUN=1` in the environment variables prevents actual emails from being sent and simulates success.