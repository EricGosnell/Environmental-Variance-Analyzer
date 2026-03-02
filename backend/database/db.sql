CREATE TABLE IF NOT EXISTS users ( 
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    password_hash TEXT NOT NULL,

    -- flags
    admin BOOLEAN DEFAULT FALSE,
    verified_email BOOLEAN DEFAULT FALSE,
    account_locked BOOLEAN DEFAULT FALSE

);

-- 1 to 1 with users
CREATE TABLE IF NOT EXISTS user_contact (
    contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT UNIQUE
);

-- email verification codes 

CREATE TABLE IF NOT EXISTS email_verification (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    send_count INTEGER NOT NULL DEFAULT 0,
    last_sent_at INTEGER NOT NULL DEFAULT 0,
    window_started_at INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires 
ON email_verification(expires_at);

-- pending email change verification codes
CREATE TABLE IF NOT EXISTS pending_email_changes (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    new_email TEXT NOT NULL,
    verification_code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_pending_email_changes_expires
ON pending_email_changes(expires_at);


CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS pod (
    pod_id INTEGER PRIMARY KEY,
    pod_name TEXT,
    description TEXT,
    pod_data_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- many to many for users to pod
CREATE TABLE IF NOT EXISTS user_pod (
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pod_id INTEGER NOT NULL REFERENCES pod(pod_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, pod_id)
);

CREATE TABLE IF NOT EXISTS pod_data (
    pod_data_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pod_id INTEGER NOT NULL REFERENCES pod(pod_id) ON DELETE CASCADE,
    date_collected DATE NOT NULL DEFAULT CURRENT_DATE,
    longitude REAL NOT NULL,
    latitude REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_data (
    sensor_data_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pod_data_id INTEGER NOT NULL REFERENCES pod_data(pod_data_id) ON DELETE CASCADE,
    sensor_type TEXT NOT NULL,
    reading_value REAL,
    reading_units TEXT,
    reading_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_contact_user_id ON user_contact(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pod_user_id ON user_pod(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pod_pod_id ON user_pod(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_data_pod_id ON pod_data(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_data_date ON pod_data(date_collected);
CREATE INDEX IF NOT EXISTS idx_sensor_data_pod_data_id ON sensor_data(pod_data_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(reading_timestamp);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
