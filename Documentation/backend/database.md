# Database Documentation

The backend utilizes **SQLite3** for lightweight, persistent data storage. The schema is defined in `backend/database/db.sql` and is executed on server startup via `backend/database/databaseInit.js`.

## Entities & Schema Overview

### Users and Contacts
- **`users`**: Stores core authentication data including `user_id`, unique `username`, `password_hash`, and boolean flags for `admin`, `verified_email`, and `account_locked`.
- **`user_contact`**: Holds contact information (`phone_number`, `email`) and links one-to-one with the `users` table via `user_id`.

### Authentication & Tokens
- **`refresh_tokens`**: Stores active refresh tokens mapped to `user_id` and an expiration timestamp.
- **`email_verification` / `password_reset` / `pending_email_changes`**: Short-lived tables holding hashed verification codes, send counts, and expiration data to securely handle account recovery and verifications. A cleanup interval runs in `server.js` to purge expired entries.

### Pods and Sensor Data
- **`pod`**: Represents an environmental data collection unit. Includes `pod_id`, `pod_name`, `description`, and a `pod_data_public` flag.
- **`user_pod`**: A join table mapping `user_id` to `pod_id`, allowing a many-to-many ownership model (a pod can have multiple owners, a user can own multiple pods).
- **`pod_data`**: Acts as a location/date grouping for sensor readings. It contains `pod_data_id`, `pod_id`, `date_collected`, `latitude`, and `longitude`.
- **`sensor_data`**: The granular metric table. Links to `pod_data_id` and contains the `sensor_type`, `reading_value`, `reading_units`, `reading_timestamp`, and the `raw_data` payload.

## Query Handling
Standard SQL queries are abstracted into helper files under the `util/` folder (e.g., `util/podQueries.js`). These modules export asynchronous functions that take the `db` instance and execute parameterized queries, protecting against SQL injection while maintaining separation of concerns from the routing logic.