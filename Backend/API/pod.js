// API/pod.js
const express = require("express");
const { body, validationResult, param, query } = require("express-validator");

const { sanitizeRequestBody } = require("./middleware/sanitize");
const { authenticateToken, optionalAuth } = require("../Util/Tokens");

const {
    getPodById,
    userOwnsPod,
    getPodDataRowsByPodId,
    getSensorRowsByPodDataId,
    getPodDataById,
    deletePodDataById,
    insertPodData,
    insertSensorData,
} = require("../Util/podQueries");

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
    router.get(
        "/locations",
        optionalAuth,
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
    router.get(
        "/:id/data",
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

                    data.push({
                        id: String(pd.pod_data_id),
                        timestamp: new Date(pd.created_at).toISOString(),
                        data: {
                            location: {
                                latitude: Number(pd.latitude),
                                longitude: Number(pd.longitude),
                            },
                            dateCollected: pd.date_collected,
                            sensors: sensors.map((s) => ({
                                id: String(s.sensor_data_id),
                                sensor_type: s.sensor_type,
                                reading_value: s.reading_value,
                                reading_units: s.reading_units,
                                reading_timestamp: new Date(s.reading_timestamp).toISOString(),
                                raw_data: s.raw_data ? safeJsonParse(s.raw_data) : null,
                                created_at: new Date(s.created_at).toISOString(),
                            })),
                        },
                        visibility: isPublic ? "public" : "private",
                    });
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
    router.post("/upload-pod-data", authenticateToken, sanitizeRequestBody,
        [
            body("podId").isInt({ gt: 0 }).withMessage("podId must be a positive integer"),
            body("data").isObject().withMessage("data must be an object"),

            body("data.latitude")
                .exists()
                .withMessage("latitude required")
                .bail()
                .isFloat({ min: -90, max: 90 })
                .withMessage("latitude invalid"),

            body("data.longitude")
                .exists()
                .withMessage("longitude required")
                .bail()
                .isFloat({ min: -180, max: 180 })
                .withMessage("longitude invalid"),

            body("data.sensors").optional().isArray().withMessage("sensors must be an array"),
            body("data.sensors.*.sensor_type")
                .optional()
                .isString()
                .isLength({ min: 1, max: 64 }),
            body("data.sensors.*.reading_value").optional().isNumeric(),
            body("data.sensors.*.reading_units").optional().isString().isLength({ max: 32 }),
            body("data.sensors.*.raw_data").optional(),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        error: "Invalid pod data",
                        details: errors.array().map((err) => ({
                            field: err.param,
                            message: err.msg,
                        })),
                    });
                }

                const userId = req.user.id;
                const podId = Number(req.body.podId);
                const payload = req.body.data;

                const lat = Number(payload.latitude);
                const lon = Number(payload.longitude);

                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    return res.status(403).json({ error: "Pod location not set" });
                }

                const pod = await getPodById(db, podId);
                if (!pod) return res.status(404).json({ error: "Pod not registered" });

                const isAdmin = await getIsAdmin(userId);
                const owns = await userOwnsPod(db, userId, podId);

                if (!owns && !isAdmin) {
                    return res.status(403).json({ error: "Forbidden" });
                }

                const insertRes = await insertPodData(db, podId, lat, lon);

                let podDataId = insertRes?.lastID;

                if (!podDataId) {
                    const row = await db.get(
                        `
                        SELECT pod_data_id AS id
                        FROM pod_data
                        WHERE pod_id = ?
                        ORDER BY datetime(created_at) DESC
                        LIMIT 1
                        `,
                        [podId]
                    );
                    podDataId = row?.id;
                }

                if (!podDataId) {
                    throw new Error("Failed to create pod_data (no lastID)");
                }

                const sensors = Array.isArray(payload.sensors) ? payload.sensors : [];

                for (const s of sensors) {
                    const sensor_type =
                        typeof s.sensor_type === "string" ? s.sensor_type : null;

                    const reading_value =
                        s.reading_value === undefined || s.reading_value === null
                            ? null
                            : Number(s.reading_value);

                    const reading_units =
                        typeof s.reading_units === "string" ? s.reading_units : null;

                    let raw_data = null;
                    if (s.raw_data !== undefined) {
                        raw_data =
                            typeof s.raw_data === "string"
                                ? s.raw_data
                                : JSON.stringify(s.raw_data);
                    }

                    if (!sensor_type) continue;

                    await insertSensorData(
                        db,
                        podDataId,
                        sensor_type,
                        Number.isFinite(reading_value) ? reading_value : null,
                        reading_units,
                        raw_data
                    );
                }

                return res.status(200).json({
                    podDataId: String(podDataId),
                    message: "Pod data uploaded successfully",
                });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/pods/upload-pod-data",
                    message: error?.message,
                    code: error?.code,
                });
            }
        }
    );

    // -------------------------
    // DELETE /pods/delete-pod-data
    // -------------------------
    router.delete(
        "/delete-pod-data",
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

    return router;
};
