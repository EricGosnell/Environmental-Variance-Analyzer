
const getPodById = async (db, podId) => {
    return db.get(
        `
        SELECT pod_id, pod_name, pod_data_public
        FROM pod
        WHERE pod_id = ?
        `,
        [podId]
    );
};

const userOwnsPod = async (db, userId, podId) => {
    const row = await db.get(
        `
        SELECT 1
        FROM user_pod
        WHERE user_id = ? AND pod_id = ?
        `,
        [userId, podId]
    );
    return !!row;
};

const getPodDataRowsByPodId = async (db, podId) => {
    return db.all(
        `
        SELECT
            pod_data_id,
            pod_id,
            date_collected,
            latitude,
            longitude,
            created_at
        FROM pod_data
        WHERE pod_id = ?
        ORDER BY datetime(created_at) DESC
        `,
        [podId]
    );
};

const getPodDataById = async (db, podDataId) => {
    return db.get(
        `
        SELECT pod_data_id, pod_id, date_collected, latitude, longitude, created_at
        FROM pod_data
        WHERE pod_data_id = ?
        `,
        [podDataId]
    );
};

const deletePodDataById = async (db, podDataId) => {
    return db.run(
        `
        DELETE FROM pod_data
        WHERE pod_data_id = ?
        `,
        [podDataId]
    );
};

const insertPodData = async (db, podId, latitude, longitude) => {
    return db.run(
        `
        INSERT INTO pod_data (pod_id, latitude, longitude)
        VALUES (?, ?, ?)
        `,
        [podId, latitude, longitude]
    );
};

const getSensorRowsByPodDataId = async (db, podDataId) => {
    return db.all(
        `
        SELECT
            sensor_data_id,
            sensor_type,
            reading_value,
            reading_units,
            reading_timestamp,
            raw_data,
            created_at
        FROM sensor_data
        WHERE pod_data_id = ?
        ORDER BY datetime(reading_timestamp) DESC
        `,
        [podDataId]
    );
};

const getSensorRowsByPodDataIds = async (db, podDataIds) => {
    if (!Array.isArray(podDataIds) || podDataIds.length === 0) return [];

    const placeholders = podDataIds.map(() => "?").join(", ");
    return db.all(
        `
        SELECT
            sensor_data_id,
            pod_data_id,
            sensor_type,
            reading_value,
            reading_units,
            reading_timestamp,
            raw_data,
            created_at
        FROM sensor_data
        WHERE pod_data_id IN (${placeholders})
        ORDER BY datetime(reading_timestamp) DESC
        `,
        podDataIds
    );
};

const insertSensorData = async (
    db,
    podDataId,
    sensor_type,
    reading_value,
    reading_units,
    raw_data
) => {
    return db.run(
        `
        INSERT INTO sensor_data
            (pod_data_id, sensor_type, reading_value, reading_units, raw_data)
        VALUES (?, ?, ?, ?, ?)
        `,
        [podDataId, sensor_type, reading_value, reading_units, raw_data]
    );
};

module.exports = {
    // pod
    getPodById,
    userOwnsPod,

    // pod_data
    getPodDataRowsByPodId,
    getPodDataById,
    deletePodDataById,
    insertPodData,

    // sensor_data
    getSensorRowsByPodDataId,
    getSensorRowsByPodDataIds,
    insertSensorData,
};
