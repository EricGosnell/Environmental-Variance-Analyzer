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
        DATE date_of_birth
    }
    
    pod {
        SERIAL pod_id PK
        INT user_id FK
        TEXT pod_name
        TEXT description
        DOUBLE_PRECISION longitude
        DOUBLE_PRECISION latitude
        BOOLEAN pod_data_public
        TIMESTAMP created_at
    }
    
    pod_data {
        SERIAL pod_data_id PK
        INT pod_id FK
        DATE date_collected
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
    
    users ||--o{ user_contact : "has"
    users ||--o{ pod : "owns"
    pod ||--o{ pod_data : "contains"
    pod_data ||--o{ sensor_data : "has"
```

## Database Schema Overview

### Relationships
- **users → user_contact**: One-to-many (one user can have multiple contact entries)
- **users → pod**: One-to-many (one user can own multiple pods)
- **pod → pod_data**: One-to-many (one pod can have multiple data entries)
- **pod_data → sensor_data**: One-to-many (one pod_data entry can have multiple sensor readings)

### Indexes
- `idx_user_contact_user_id` on `user_contact(user_id)`
- `idx_pod_user_id` on `pod(user_id)`
- `idx_pod_data_pod_id` on `pod_data(pod_id)`
- `idx_pod_data_date` on `pod_data(date_collected)`
- `idx_sensor_data_pod_data_id` on `sensor_data(pod_data_id)`
- `idx_sensor_data_timestamp` on `sensor_data(reading_timestamp)`

### Constraints
- All foreign key relationships use `ON DELETE CASCADE`
- `users.username` is UNIQUE
- `user_contact.email` is UNIQUE

