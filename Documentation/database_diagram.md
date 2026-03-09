# Database Schema Diagrams

This document contains UML diagrams for the database schema.

## Entity Relationship Diagram

```mermaid
erDiagram
    users {
        SERIAL user_id PK
        TEXT username UK
        TIMESTAMP created_at
        TEXT password_hash
    }
    
    user_contact {
        SERIAL contact_id PK
        INT user_id FK
        TEXT user_name
        TEXT phone_number
        TEXT email UK
    }

    pending_email_changes {
        INT user_id PK,FK
        TEXT new_email
        TEXT code_hash
        INT expires_at
        INT created_at
    }
    
    email_verification {
        INT user_id PK,FK
        TEXT code_hash
        INT expires_at
        INT attempts
        INT send_count
        INT last_sent_at
        INT window_started_at
        TIMESTAMP created_at
    }
    
    pod {
        SERIAL pod_id PK
        TEXT pod_name
        TEXT description
        BOOLEAN pod_data_public
        TIMESTAMP created_at
    }
    
    user_pod {
        INT user_id FK
        INT pod_id FK
    }
    
    pod_data {
        SERIAL pod_data_id PK
        INT pod_id FK
        DATE date_collected
        DOUBLE_PRECISION longitude
        DOUBLE_PRECISION latitude
        TIMESTAMP created_at
    }
    
    sensor_data {
        SERIAL sensor_data_id PK
        INT pod_data_id FK
        TEXT sensor_type
        DOUBLE_PRECISION reading_value
        TEXT reading_units
        TIMESTAMP reading_timestamp
        JSONB raw_data
        TIMESTAMP created_at
    }
    
    users ||--|| user_contact : "has"
    users ||--o| pending_email_changes : "pending email change"
    users ||--o| email_verification : "email verification attempts"
    users ||--o{ user_pod : "belongs to"
    pod ||--o{ user_pod : "contains"
    pod ||--o{ pod_data : "contains"
    pod_data ||--o{ sensor_data : "has"
```

## Database Schema Overview

### Relationships
- **users → user_contact**: One-to-one (one user has one contact entry)
- **users → pending_email_changes**: One-to-zero/one (temporary pending email change verification state)
- **users → email_verification**: One-to-zero/one (temporary signup/login verification state)
- **users ↔ pod**: Many-to-many (users can belong to multiple pods, pods can have multiple users) via `user_pod` junction table
- **pod → pod_data**: One-to-many (one pod can have multiple data entries)
- **pod_data → sensor_data**: One-to-many (one pod_data entry can have multiple sensor readings)

### Indexes
- `idx_user_contact_user_id` on `user_contact(user_id)`
- `idx_email_verification_expires` on `email_verification(expires_at)`
- `idx_pending_email_changes_expires` on `pending_email_changes(expires_at)`
- `idx_user_pod_user_id` on `user_pod(user_id)`
- `idx_user_pod_pod_id` on `user_pod(pod_id)`
- `idx_pod_data_pod_id` on `pod_data(pod_id)`
- `idx_pod_data_date` on `pod_data(date_collected)`
- `idx_sensor_data_pod_data_id` on `sensor_data(pod_data_id)`
- `idx_sensor_data_timestamp` on `sensor_data(reading_timestamp)`

### Constraints
- All foreign key relationships use `ON DELETE CASCADE`
- `users.username` is UNIQUE
- `user_contact.user_id` is UNIQUE (one-to-one relationship)
- `user_contact.email` is UNIQUE
- `pending_email_changes.user_id` is PRIMARY KEY and references `users(user_id)`
- `email_verification.user_id` is PRIMARY KEY and references `users(user_id)`
- `user_pod` has a composite primary key on `(user_id, pod_id)`
