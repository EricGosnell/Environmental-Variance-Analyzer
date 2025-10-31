CREATE TABLE IF NOT EXISTS users ( 
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_contact (
    contact_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT UNIQUE,
    date_of_birth DATE
);

CREATE TABLE IF NOT EXISTS pod (
    pod_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pod_name TEXT,
    description TEXT,
    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    pod_data_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pod_data (
    pod_data_id SERIAL PRIMARY KEY,
    pod_id INT NOT NULL REFERENCES pod(pod_id) ON DELETE CASCADE,
    date_collected DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_data (
    sensor_data_id SERIAL PRIMARY KEY,
    pod_data_id INT NOT NULL REFERENCES pod_data(pod_data_id) ON DELETE CASCADE,
    sensor_type TEXT NOT NULL,
    reading_value DOUBLE PRECISION,
    reading_units TEXT,
    reading_timestamp TIMESTAMP DEFAULT NOW(),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_contact_user_id ON user_contact(user_id);
CREATE INDEX idx_pod_user_id ON pod(user_id);
CREATE INDEX idx_pod_data_pod_id ON pod_data(pod_id);
CREATE INDEX idx_pod_data_date ON pod_data(date_collected);
CREATE INDEX idx_sensor_data_pod_data_id ON sensor_data(pod_data_id);
CREATE INDEX idx_sensor_data_timestamp ON sensor_data(reading_timestamp);
