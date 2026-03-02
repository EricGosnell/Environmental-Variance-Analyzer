// API/pod.js
const express = require("express");
const { body, validationResult, param, query } = require("express-validator");

const { sanitizeRequestBody } = require("./middleware/sanitize");
const { authenticateToken, optionalAuth } = require("../util/Tokens");

const {
    getPodById,
    userOwnsPod,
    getPodDataRowsByPodId,
    getSensorRowsByPodDataId,
    getPodDataById,
    deletePodDataById,
    insertPodData,
    insertSensorData,
} = require("../util/podQueries");

module.exports = (db) => {
    const router = express.Router();

    // Helpers
    const getIsAdmin = async (userId) => {
        if (!userId) return false;

        const row = await db.get(
            `
            SELECT admin
            FROM users
            WHERE user_id = ?
            `,
            [userId]
        );
        return !!row?.admin;
    };

    const parseISODateOrNull = (s) => {
        if (!s) return null;
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    const safeJsonParse = (str) => {
        try {
            return JSON.parse(str);
        } catch { return str; }
    };

    const haversineMeters = (lat1, lon1, lat2, lon2) => {
        const R = 6371000; // meters
        const toRad = (deg) => (deg * Math.PI) / 180;

        const lat1Rad = toRad(lat1);
        const lat2Rad = toRad(lat2);

        const deltaLat = toRad(lat2 - lat1);
        const deltaLon = toRad(lon2 - lon1);

        const a =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };


    // -------------------------
    // GET /pods/locations
    // -------------------------
    // returns public pods + user's pods, OR all pods if admin
    router.get("/locations", optionalAuth,
        [
            query("latitude").exists().isFloat({ min: -90, max: 90 }),
            query("longitude").exists().isFloat({ min: -180, max: 180 }),
            query("radius").exists().isFloat({ gt: 0 }),
            query("fromDate").optional().isISO8601(),
            query("toDate").optional().isISO8601(),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        error: "One or more required parameters are invalid or missing",
                        details: errors.array().map((err) => ({
                            field: err.param,
                            message: err.msg,
                        })),
                    });
                }

                const latitude = Number(req.query.latitude);
                const longitude = Number(req.query.longitude);
                const radius = Number(req.query.radius);

                const fromISO = parseISODateOrNull(req.query.fromDate);
                const toISO = parseISODateOrNull(req.query.toDate);

                if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius)) {
                    return res.status(400).json({
                        error: "One or more required parameters are invalid or missing",
                    });
                }

                if ((req.query.fromDate && !fromISO) || (req.query.toDate && !toISO)) {
                    return res.status(400).json({
                        error: "One or more required parameters are invalid or missing",
                    });
                }

                const userId = req.user?.id ?? null;
                const isAdmin = userId ? await getIsAdmin(userId) : false;

                // bounding box optimization
                const latDelta = radius / 111320;
                const lonDelta =
                    radius /
                    (111320 * Math.max(0.000001, Math.cos((latitude * Math.PI) / 180)));

                const minLat = latitude - latDelta;
                const maxLat = latitude + latDelta;
                const minLon = longitude - lonDelta;
                const maxLon = longitude + lonDelta;

                const dateClause = [];
                const dateParams = [];

                if (fromISO) {
                    dateClause.push("datetime(pd.created_at) >= datetime(?)");
                    dateParams.push(fromISO);
                }
                if (toISO) {
                    dateClause.push("datetime(pd.created_at) <= datetime(?)");
                    dateParams.push(toISO);
                }

                const dateWhere = dateClause.length ? `AND ${dateClause.join(" AND ")}` : "";

                // visibility logic
                let visibilityWhere = "";
                const params = [minLat, maxLat, minLon, maxLon, ...dateParams];

                if (!isAdmin) {
                    if (userId) {
                        visibilityWhere = `
                            AND (
                                p.pod_data_public = 1
                                OR EXISTS (
                                    SELECT 1 FROM user_pod up
                                    WHERE up.pod_id = p.pod_id AND up.user_id = ?
                                )
                            )
                        `;
                        params.push(userId);
                    } else {
                        visibilityWhere = `AND p.pod_data_public = 1`;
                    }
                }

                const sql = `
                    WITH filtered AS (
                        SELECT
                            pd.pod_id,
                            pd.latitude,
                            pd.longitude,
                            pd.created_at
                        FROM pod_data pd
                        WHERE
                            pd.latitude BETWEEN ? AND ?
                            AND pd.longitude BETWEEN ? AND ?
                            ${dateWhere}
                    ),
                    latest AS (
                        SELECT
                            pod_id,
                            MAX(datetime(created_at)) AS max_created_at
                        FROM filtered
                        GROUP BY pod_id
                    )
                    SELECT
                        p.pod_id,
                        p.pod_name,
                        p.pod_data_public,
                        f.latitude,
                        f.longitude,
                        f.created_at AS last_updated
                    FROM latest l
                    JOIN filtered f
                        ON f.pod_id = l.pod_id
                    AND datetime(f.created_at) = l.max_created_at
                    JOIN pod p
                        ON p.pod_id = f.pod_id
                    WHERE 1=1
                        ${visibilityWhere}
                `;

                const rows = await db.all(sql, params);

                const pods = rows
                    .map((r) => {
                        const d = haversineMeters(
                            latitude,
                            longitude,
                            Number(r.latitude),
                            Number(r.longitude)
                        );

                        if (!Number.isFinite(d) || d > radius) return null;

                        return {
                            id: String(r.pod_id),
                            nickname: r.pod_name ?? null,
                            latitude: Number(r.latitude),
                            longitude: Number(r.longitude),
                            visibility: r.pod_data_public ? "public" : "private",
                            lastUpdated: new Date(r.last_updated).toISOString(),
                        };
                    })
                    .filter(Boolean);

                return res.status(200).json({ pods });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/locations",
                    message: error?.message,
                    code: error?.code,
                });
            }
        }
    );

    // -------------------------
    // GET /pods/:id/data
    // -------------------------
    // public pods accessible anonymously, otherwise owner/admin required
    router.get("/:id/data",
        optionalAuth,
        [param("id").isInt({ gt: 0 }).withMessage("Pod id must be a positive integer")],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        error: "Validation failed",
                        details: errors.array().map((err) => ({
                            field: err.param,
                            message: err.msg,
                        })),
                    });
                }

                const podId = Number(req.params.id);
                const userId = req.user?.id ?? null;

                const pod = await getPodById(db, podId);
                if (!pod) return res.status(404).json({ error: "Pod not found" });

                const isPublic = !!pod.pod_data_public;
                const isAdmin = userId ? await getIsAdmin(userId) : false;
                const owns = userId ? await userOwnsPod(db, userId, podId) : false;

                if (!isPublic && !owns && !isAdmin) {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const podDataRows = await getPodDataRowsByPodId(db, podId);

                const data = [];

                for (const pd of podDataRows) {

                    const sensors = await getSensorRowsByPodDataId(db, pd.pod_data_id);

                    for (const s of sensors) {
                        data.push({
                            id: String(s.sensor_data_id),
                            timestamp: new Date(s.reading_timestamp).toISOString(),
                            data: {
                                sensor_type: s.sensor_type,
                                reading_value: s.reading_value,
                                reading_units: s.reading_units,
                                location: {
                                    latitude: Number(pd.latitude),
                                    longitude: Number(pd.longitude),
                                },
                            },
                            visibility: isPublic ? "public" : "private",
                        });
                    }
                }


                return res.status(200).json({ data });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/:id/data",
                    message: error?.message,
                    code: error?.code,
                });
            }
        }
    );

    // -------------------------
    // POST /pods/upload-pod-data
    // -------------------------
    router.post("/upload-pod-data",
        authenticateToken,
        sanitizeRequestBody,
        [
            body("pod_data").isArray({ min: 1 }).withMessage("pod_data must be an array"),

            body("pod_data.*.pod_id")
                .isInt({ gt: 0 })
                .withMessage("pod_id must be positive integer"),

            body("pod_data.*.ts")
                .isInt({ gt: 0 })
                .withMessage("ts must be unix timestamp"),

            body("pod_data.*.readings")
                .isArray({ min: 1 })
                .withMessage("readings must be array"),

            body("pod_data.*.readings.*.metric")
                .isString()
                .isLength({ min: 1, max: 64 }),

            body("pod_data.*.readings.*.value")
                .isNumeric(),

            body("pod_data.*.readings.*.unit")
                .optional()
                .isString()
                .isLength({ max: 32 }),
        ],
        async (req, res) => {
            try {

                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ error: "Invalid payload", details: errors.array() });
                }

                const userId = req.user.id;
                const payload = req.body.pod_data;

                await db.run("BEGIN TRANSACTION");

                for (const entry of payload) {

                    const podId = entry.pod_id;

                    const pod = await getPodById(db, podId);
                    if (!pod) continue;

                    const isAdmin = await getIsAdmin(userId);
                    const owns = await userOwnsPod(db, userId, podId);

                    if (!owns && !isAdmin) {
                        await db.run("ROLLBACK");
                        return res.status(403).json({ error: "Forbidden" });
                    }

                    // get pod_data row (location row)
                    const podDataRow = await db.get(
                        `SELECT pod_data_id FROM pod_data
           WHERE pod_id = ?
           ORDER BY pod_data_id LIMIT 1`,
                        [podId]
                    );

                    if (!podDataRow) continue;

                    const podDataId = podDataRow.pod_data_id;

                    const timestampISO = new Date(entry.ts * 1000).toISOString();

                    for (const r of entry.readings) {
                        await db.run(
                            `INSERT INTO sensor_data
             (pod_data_id, sensor_type, reading_value, reading_units, reading_timestamp, raw_data)
             VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                                podDataId,
                                r.metric,
                                r.value,
                                r.unit ?? null,
                                timestampISO,
                                JSON.stringify(r),
                            ]
                        );
                    }
                }

                await db.run("COMMIT");

                return res.status(200).json({ message: "Telemetry uploaded successfully" });

            } catch (error) {
                await db.run("ROLLBACK");
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/upload-pod-data",
                    message: error?.message,
                });
            }
        }
    );


    // -------------------------
    // DELETE /pods/delete-pod-data
    // -------------------------
    router.delete("/delete-pod-data",
        authenticateToken,
        sanitizeRequestBody,
        [body("podDataId").isInt({ gt: 0 }).withMessage("podDataId must be a positive integer")],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        error: "Invalid pod data ID",
                        details: errors.array().map((err) => ({
                            field: err.param,
                            message: err.msg,
                        })),
                    });
                }

                const userId = req.user.id;
                const podDataId = Number(req.body.podDataId);

                const podDataRow = await getPodDataById(db, podDataId);
                if (!podDataRow) return res.status(404).json({ error: "Pod data not found" });

                const podId = podDataRow.pod_id;

                const isAdmin = await getIsAdmin(userId);
                const owns = await userOwnsPod(db, userId, podId);

                if (!owns && !isAdmin) {
                    return res.status(403).json({ error: "Forbidden" });
                }

                await deletePodDataById(db, podDataId);

                return res.status(200).json({
                    message: "Pod data deleted successfully",
                    podDataId: String(podDataId),
                });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/delete-pod-data",
                    message: error?.message,
                    code: error?.code,
                });
            }
        }
    );

    // -------------------------
    // GET /pods/latest?ids=1,2,3
    // -------------------------
    router.get(
        "/latest",
        optionalAuth,
        async (req, res) => {
            try {
                const idsParam = req.query.ids;
                if (!idsParam) {
                    return res.status(400).json({
                        error: "Query param 'ids' required (comma separated pod IDs)"
                    });
                }

                const podIds = idsParam
                    .split(",")
                    .map((id) => Number(id.trim()))
                    .filter((id) => !isNaN(id) && id > 0);

                if (podIds.length === 0) {
                    return res.status(400).json({
                        error: "No valid pod IDs provided"
                    });
                }

                const userId = req.user?.id ?? null;
                const isAdmin = userId ? await getIsAdmin(userId) : false;

                // -------------------------
                // Fetch pods + visibility check
                // -------------------------
                const pods = [];
                for (const podId of podIds) {
                    const pod = await getPodById(db, podId);
                    if (!pod) continue;

                    const isPublic = !!pod.pod_data_public;
                    const owns = userId ? await userOwnsPod(db, userId, podId) : false;

                    if (!isPublic && !owns && !isAdmin) continue;

                    pods.push(pod);
                }

                if (pods.length === 0) {
                    return res.status(403).json({ error: "No accessible pods" });
                }

                const accessibleIds = pods.map(p => p.pod_id);

                // -------------------------
                // Get latest per pod + sensor_type
                // -------------------------
                const placeholders = accessibleIds.map(() => "?").join(",");

                const rows = await db.all(
                    `
  SELECT *
  FROM (
    SELECT
      pd.pod_id,
      p.pod_name,
      sd.sensor_data_id,
      sd.sensor_type,
      sd.reading_value,
      sd.reading_units,
      sd.reading_timestamp,
      pd.latitude,
      pd.longitude,
      ROW_NUMBER() OVER (
        PARTITION BY pd.pod_id, sd.sensor_type
        ORDER BY datetime(sd.reading_timestamp) DESC
      ) as rn
    FROM pod_data pd
    JOIN sensor_data sd
      ON sd.pod_data_id = pd.pod_data_id
    JOIN pod p
      ON p.pod_id = pd.pod_id
    WHERE pd.pod_id IN (${placeholders})
  )
  WHERE rn = 1
  `,
                    accessibleIds
                );

                // -------------------------
                // Build response structure
                // -------------------------
                const result = {};

                for (const pod of pods) {
                    result[pod.pod_id] = {
                        podId: String(pod.pod_id),
                        podName: pod.pod_name ?? null,
                        visibility: pod.pod_data_public ? "public" : "private",
                        latestReadings: {}
                    };
                }

                for (const row of rows) {
                    result[row.pod_id].latestReadings[row.sensor_type] = {
                        id: String(row.sensor_data_id),
                        metric: row.sensor_type,
                        value: row.reading_value,
                        units: row.reading_units ?? null,
                        timestamp: new Date(row.reading_timestamp).toISOString(),
                        location: {
                            latitude: Number(row.latitude),
                            longitude: Number(row.longitude),
                        }
                    };
                }

                return res.status(200).json({
                    pods: Object.values(result)
                });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/latest",
                    message: error?.message,
                    code: error?.code,
                });
            }
        }
    );

    return router;
};
