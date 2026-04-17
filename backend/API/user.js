// API/user.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { body, query, validationResult } = require("express-validator");
const { sanitizeRequestBody } = require("./middleware/sanitize");
const { authenticateToken } = require("../util/Tokens");
const { sendEmail } = require("../util/email");
const { buildPasswordValidator } = require("../util/passwordPolicy");
const {
    generateVerificationCode,
    hashVerificationCode,
} = require("../util/verificationCode");

//USING THESE FOR VALIDATION RESTRICTIONS FOR NOW, 
//CAN BE CHANGED LATER IF WE DECIDE TO - Ryan
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 16;
const MAX_EMAIL_LENGTH = 255;
const POD_HISTORY_ACTIONS = new Set(["added", "edited", "deleted"]);

const parseJsonOrNull = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const asBooleanFromVisibility = (visibility) => visibility === "public";

const hasNumberChanged = (fromValue, toValue) => {
    const fromNum = Number(fromValue);
    const toNum = Number(toValue);
    if (!Number.isFinite(fromNum) || !Number.isFinite(toNum)) return true;
    return fromNum !== toNum;
};

const buildEditChanges = ({ currentPod, currentLocation, updates }) => {
    const changes = [];

    if (Object.prototype.hasOwnProperty.call(updates, "nickname") && updates.nickname !== undefined) {
        if ((currentPod?.pod_name ?? "") !== updates.nickname) {
            changes.push({
                field: "nickname",
                from: currentPod?.pod_name ?? null,
                to: updates.nickname,
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "visibility") && updates.visibility !== undefined) {
        const currentVisibility = !!currentPod?.pod_data_public ? "public" : "private";
        if (currentVisibility !== updates.visibility) {
            changes.push({
                field: "visibility",
                from: currentVisibility,
                to: updates.visibility,
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "latitude") && updates.latitude !== undefined) {
        if (hasNumberChanged(currentLocation?.latitude, updates.latitude)) {
            changes.push({
                field: "latitude",
                from: currentLocation?.latitude ?? null,
                to: updates.latitude,
            });
        }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "longitude") && updates.longitude !== undefined) {
        if (hasNumberChanged(currentLocation?.longitude, updates.longitude)) {
            changes.push({
                field: "longitude",
                from: currentLocation?.longitude ?? null,
                to: updates.longitude,
            });
        }
    }

    return changes;
};

module.exports = (db) => {
    const router = express.Router();

    const logPodAction = async ({ podId, actorUserId, actionType, actionDetails }) => {
        if (!POD_HISTORY_ACTIONS.has(actionType)) {
            throw new Error(`Invalid pod history action type: ${actionType}`);
        }

        await db.run(
            `
            INSERT INTO pod_action_history (pod_id, actor_user_id, action_type, action_details)
            VALUES (?, ?, ?, ?)
            `,
            [
                podId,
                actorUserId,
                actionType,
                actionDetails ? JSON.stringify(actionDetails) : null,
            ]
        );
    };

    // -------------------------
    // GET /me - Get current user's full information
    // -------------------------
    router.get("/me", authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const user = await db.get(
                `
                SELECT u.user_id, u.username, uc.email, uc.phone_number
                FROM users u
                LEFT JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE u.user_id = ?
                `,
                [userId]
            );

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const pods = await db.all(`
            SELECT 
                p.pod_id,
                p.pod_name,
                p.pod_data_public,
                pd.latitude,
                pd.longitude
            FROM pod p
            JOIN user_pod up ON up.pod_id = p.pod_id
            JOIN pod_data pd ON pd.pod_id = p.pod_id
            WHERE up.user_id = ?
            `, [userId]);


            return res.status(200).json({
                user: {
                    id: user.user_id,
                    email: user.email,
                    phone_number: user.phone_number,
                    username: user.username,
                    pods: pods.map(p => ({
                        id: p.pod_id,
                        name: p.pod_name,
                        visibility: !!p.pod_data_public,
                        lat: p.latitude,
                        long: p.longitude
                    }))
                }
            });

        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // GET /me/pod-history - Get pod action history for user's pods
    // -------------------------
    router.get("/me/pod-history", authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;

            const rows = await db.all(
                `
                SELECT
                    pah.pod_action_history_id,
                    pah.pod_id,
                    p.pod_name,
                    pah.action_type,
                    pah.action_details,
                    pah.created_at,
                    actor.user_id AS actor_user_id,
                    actor.username AS actor_username
                FROM pod_action_history pah
                JOIN users actor ON actor.user_id = pah.actor_user_id
                LEFT JOIN pod p ON p.pod_id = pah.pod_id
                WHERE
                    EXISTS (
                        SELECT 1
                        FROM user_pod up
                        WHERE up.user_id = ? AND up.pod_id = pah.pod_id
                    )
                    OR pah.actor_user_id = ?
                ORDER BY pah.created_at DESC, pah.pod_action_history_id DESC
                `,
                [userId, userId]
            );

            return res.status(200).json({
                history: rows.map((row) => ({
                    id: row.pod_action_history_id,
                    podId: row.pod_id,
                    podName: row.pod_name || `Pod ${row.pod_id}`,
                    action: row.action_type,
                    actionDetails: parseJsonOrNull(row.action_details),
                    byUser: {
                        id: row.actor_user_id,
                        username: row.actor_username,
                    },
                    atTime: new Date(Number(row.created_at) * 1000).toISOString(),
                })),
            });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // GET /search - Search users by username
    // -------------------------
    router.get("/search", authenticateToken, [
        query("username")
            .trim()
            .isLength({ min: 2, max: MAX_USERNAME_LENGTH })
            .withMessage(`Username search term must be between 2 and ${MAX_USERNAME_LENGTH} characters`)
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage("Username search term can only contain letters, numbers, underscores, and hyphens"),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Limit must be an integer between 1 and 50")
            .toInt(),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Invalid search parameters" });
            }

            const searchTerm = req.query.username.toLowerCase();
            const limit = req.query.limit ?? 20;
            const escapedSearchTerm = searchTerm.replace(/([\\%_])/g, "\\$1");
            const containsPattern = `%${escapedSearchTerm}%`;
            const prefixPattern = `${escapedSearchTerm}%`;

            const users = await db.all(
                `
                SELECT u.user_id, u.username
                FROM users u
                WHERE LOWER(u.username) LIKE ? ESCAPE '\\'
                AND u.admin = 0
                AND u.user_id != ?
                ORDER BY
                    CASE
                        WHEN LOWER(u.username) = ? THEN 0
                        WHEN LOWER(u.username) LIKE ? ESCAPE '\\' THEN 1
                        ELSE 2
                    END ASC,
                    LOWER(u.username) ASC
                LIMIT ?
                `,
                [containsPattern, req.user.id, searchTerm, prefixPattern, limit]
            );

            return res.status(200).json({
                users: users.map((user) => ({
                    id: user.user_id,
                    username: user.username,
                })),
            });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // GET /:id - Get user info by ID
    // -------------------------
    router.get("/:id", authenticateToken, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id) || id <= 0) {
                return res.status(400).json({ error: "Invalid user ID" });
            }
            const requestingUserId = req.user.id;

            const user = await db.get(
                `
                SELECT u.user_id, u.username, u.created_at, uc.email, uc.phone_number
                FROM users u
                LEFT JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE u.user_id = ?
                `,
                [id]
            );

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const isOwner = parseInt(id) === requestingUserId;
            const isAdmin = false; // TODO: Implement admin role check when admin system is added

            const responseUser = {
                id: user.user_id,
                username: user.username,
                createdAt: user.created_at,
            };

            // Only owner or admin can see email and phone_number
            if (isOwner || isAdmin) {
                responseUser.email = user.email;
                responseUser.phone_number = user.phone_number;
            }

            // TODO: Add devices and posts when those features are implemented

            return res.status(200).json({ user: responseUser });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // PUT /me/username - Update current user's username
    // -------------------------
    router.put("/me/username", authenticateToken, sanitizeRequestBody, [
        body("username")
            .isLength({ min: MIN_USERNAME_LENGTH, max: MAX_USERNAME_LENGTH })
            .withMessage(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`)
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage("Username can only contain letters, numbers, underscores, and hyphens")
            .trim()
            .escape(),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Invalid username format" });
            }

            const { username } = req.body;
            const userId = req.user.id;

            // Check if username already exists
            const existingUser = await db.get(
                "SELECT user_id FROM users WHERE username = ?",
                [username]
            );

            if (existingUser) {
                return res.status(409).json({ error: "Username already taken" });
            }

            await db.run(
                "UPDATE users SET username = ? WHERE user_id = ?",
                [username, userId]
            );

            return res.status(200).json({ message: "Username updated successfully" });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // POST /me/email/request-change - Request email change
    // -------------------------
    router.post("/me/email/request-change", authenticateToken, sanitizeRequestBody, [
        body("newEmail")
            .isEmail()
            .withMessage("Invalid email format")
            .normalizeEmail()
            .isLength({ max: MAX_EMAIL_LENGTH })
            .withMessage(`Email must be less than ${MAX_EMAIL_LENGTH} characters`),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            const traceId = req.body?.traceId || `email-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            console.log("[user.js][/me/email/request-change] Request received", {
                traceId,
                userId: req.user?.id,
                hasNewEmail: Boolean(req.body?.newEmail),
            });

            if (!errors.isEmpty()) {
                console.warn("[user.js][/me/email/request-change] Validation failed", {
                    traceId,
                    userId: req.user?.id,
                    errors: errors.array(),
                });
                return res.status(400).json({ error: "Invalid email format" });
            }

            const { newEmail } = req.body;
            const userId = req.user.id;

            // Check if email already in use
            const existingEmail = await db.get(
                "SELECT user_id FROM user_contact WHERE email = ?",
                [newEmail]
            );

            if (existingEmail) {
                console.warn("[user.js][/me/email/request-change] Email already in use", {
                    traceId,
                    userId,
                });
                return res.status(409).json({ error: "Email already in use" });
            }

            // Generate verification code (6-digit)
            const verificationCode = generateVerificationCode();
            const verificationCodeHash = hashVerificationCode(verificationCode);

            // Store pending email change with verification code for 15 minutes
            const expiresAt = Math.floor(Date.now() / 1000) + (15 * 60);

            console.log("[user.js][/me/email/request-change] Persisting pending email change", {
                traceId,
                userId,
            });

            await db.run(
                `
                INSERT INTO pending_email_changes (user_id, new_email, code_hash, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET new_email = ?, code_hash = ?, expires_at = ?
                `,
                [userId, newEmail, verificationCodeHash, expiresAt, newEmail, verificationCodeHash, expiresAt]
            );

            const emailResult = await sendEmail({
                to: newEmail,
                subject: "Verify your new email",
                html: `
                    <h2>Your email change verification code</h2>
                    <p style="font-size:24px;"><b>${verificationCode}</b></p>
                    <p>Expires in 15 minutes.</p>
                `
            });

            console.log("[user.js][/me/email/request-change] Verification code sent", {
                traceId,
                userId,
                delivery: emailResult,
            });

            if (emailResult?.skipped) {
                return res.status(200).json({
                    message: "Verification code generated, but email delivery is disabled on this server.",
                    emailDelivery: emailResult,
                });
            }

            return res.status(200).json({ message: "Verification code sent to new email" });
        } catch (error) {
            console.error("[user.js][/me/email/request-change] Request failed", {
                traceId: req.body?.traceId,
                userId: req.user?.id,
                error,
            });
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // PUT /me/email - Verify and update email
    // -------------------------
    router.put("/me/email", authenticateToken, sanitizeRequestBody, [
        body("newEmail")
            .isEmail()
            .withMessage("Invalid email format")
            .normalizeEmail(),
        body("verificationCode")
            .trim()
            .notEmpty()
            .withMessage("Verification code is required"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Invalid or expired verification code" });
            }

            const { newEmail, verificationCode } = req.body;
            const userId = req.user.id;

            // Get pending email change
            const pendingChange = await db.get(
                `
                SELECT * FROM pending_email_changes 
                WHERE user_id = ? AND expires_at > strftime('%s','now')
                `,
                [userId]
            );

            if (!pendingChange) {
                return res.status(404).json({ error: "No pending email change request found" });
            }

            // Verify code matches
            if (hashVerificationCode(verificationCode) !== pendingChange.code_hash) {
                return res.status(400).json({ error: "Invalid or expired verification code" });
            }

            // Verify newEmail matches the pending change email
            if (pendingChange.new_email !== newEmail) {
                return res.status(400).json({ error: "Email does not match pending change request" });
            }

            // Update email in user_contact
            const updateResult = await db.run(
                "UPDATE user_contact SET email = ? WHERE user_id = ?",
                [newEmail, userId]
            );

            if (!updateResult || updateResult.changes === 0) {
                return res.status(500).json({ error: "Failed to update email" });
            }

            // Delete pending email change
            await db.run(
                "DELETE FROM pending_email_changes WHERE user_id = ?",
                [userId]
            );

            return res.status(200).json({
                message: "Email updated successfully",
                user: { email: newEmail }
            });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // PUT /me/phone-number - Update current user's phone number
    // -------------------------
    router.put("/me/phone-number", authenticateToken, sanitizeRequestBody, [
        body("phone_number")
            .trim()
            .notEmpty()
            .withMessage("Phone number is required")
            .isLength({ max: 20 })
            .withMessage("Phone number must be less than 20 characters")
            .matches(/^[+]?[0-9\s\-()]+$/)
            .withMessage("Please provide a valid phone number"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Invalid phone number format" });
            }

            const { phone_number } = req.body;
            const userId = req.user.id;

            const user = await db.get(
                "SELECT user_id, username FROM users WHERE user_id = ?",
                [userId]
            );

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const existingContact = await db.get(
                "SELECT contact_id FROM user_contact WHERE user_id = ?",
                [userId]
            );

            if (existingContact) {
                await db.run(
                    "UPDATE user_contact SET phone_number = ? WHERE user_id = ?",
                    [phone_number, userId]
                );
            } else {
                await db.run(
                    "INSERT INTO user_contact (user_id, user_name, phone_number, email) VALUES (?, ?, ?, NULL)",
                    [userId, user.username, phone_number]
                );
            }

            return res.status(200).json({
                message: "Phone number updated successfully",
                user: { phone_number },
            });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // PUT /me/password - Update password
    // -------------------------
    router.put("/me/password", authenticateToken, sanitizeRequestBody, [
        body("oldPassword")
            .notEmpty()
            .withMessage("Old password is required"),
        buildPasswordValidator("newPassword"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Invalid old password" });
            }

            const { oldPassword, newPassword } = req.body;
            const userId = req.user.id;

            // Get user's current password hash
            const user = await db.get(
                "SELECT password_hash FROM users WHERE user_id = ?",
                [userId]
            );

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Verify old password
            const validPassword = await bcrypt.compare(oldPassword, user.password_hash);
            if (!validPassword) {
                return res.status(400).json({ error: "Issue verifying password" });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            // Update password
            await db.run(
                "UPDATE users SET password_hash = ? WHERE user_id = ?",
                [hashedPassword, userId]
            );

            return res.status(200).json({ message: "Password updated successfully" });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // POST /me/register-pod - Register a new pod
    // -------------------------
    router.post("/me/register-pod", authenticateToken, sanitizeRequestBody, [
        body("nickname")
            .trim()
            .notEmpty()
            .withMessage("Nickname is required"),
        body("visibility")
            .trim()
            .isIn(["public", "private"])
            .withMessage("Visibility must be either 'public' or 'private'"),
        body("latitude")
            .optional()
            .isFloat({ min: -90, max: 90 })
            .withMessage("Latitude must be a valid number between -90 and 90")
            .toFloat(),
        body("longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be a valid number between -180 and 180")
            .toFloat(),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "One or more required parameters are invalid or missing" });
            }

            const { nickname, visibility, latitude, longitude } = req.body;
            const userId = req.user.id;

            // Enforce per-user nickname uniqueness
            const existingUserPod = await db.get(
                `SELECT p.pod_id FROM user_pod up
                 JOIN pod p ON up.pod_id = p.pod_id
                 WHERE up.user_id = ? AND p.pod_name = ?`,
                [userId, nickname]
            );
            if (existingUserPod) {
                return res.status(409).json({ error: "You already have a pod registered with this nickname." });
            }

            //Check long and lat have required specificity, three decimals minimum
            if (latitude !== undefined) {
                const latString = latitude.toString();
                const latDecimals = latString.split(".")[1];
                if (!latDecimals || latDecimals.length < 3) {
                    return res.status(400).json({ error: "Latitude must have at least three decimal places" });
                }
            }

            if (longitude !== undefined) {
                const lonString = longitude.toString();
                const lonDecimals = lonString.split(".")[1];
                if (!lonDecimals || lonDecimals.length < 3) {
                    return res.status(400).json({ error: "Longitude must have at least three decimal places" });
                }
            }

            // Insert new pod and get pod_id
            const podInsert = await db.run(
                "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
                [nickname, visibility === "public" ? 1 : 0]
            );
            const podId = podInsert.lastID;

            // Register user to pod
            await db.run(
                "INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)",
                [userId, podId]
            );

            // Insert pod location data if provided
            if (latitude !== undefined && longitude !== undefined) {
                const today = new Date().toISOString().split('T')[0];
                await db.run(
                    "INSERT INTO pod_data (pod_id, date_collected, latitude, longitude) VALUES (?, ?, ?, ?)",
                    [podId, today, latitude, longitude]
                );
            }

            await logPodAction({
                podId,
                actorUserId: userId,
                actionType: "added",
                actionDetails: {
                    nickname,
                    visibility,
                    latitude: latitude ?? null,
                    longitude: longitude ?? null,
                },
            });

            return res.status(200).json({ message: "Pod registered successfully", podId });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // PUT /me/update-pod - Update pod information
    // -------------------------
    router.put("/me/update-pod", authenticateToken, sanitizeRequestBody, [
        body("podId")
            .trim()
            .notEmpty()
            .withMessage("Pod ID is required"),
        body("nickname")
            .optional()
            .trim()
            .notEmpty(),
        body("visibility")
            .optional()
            .trim()
            .isIn(["public", "private"])
            .withMessage("Visibility must be either 'public' or 'private'"),
        body("latitude")
            .optional()
            .isFloat({ min: -90, max: 90 })
            .withMessage("Latitude must be a valid number between -90 and 90")
            .toFloat(),
        body("longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be a valid number between -180 and 180")
            .toFloat(),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "One or more required parameters are invalid or missing" });
            }

            const { podId, nickname, visibility, latitude, longitude } = req.body;
            const userId = req.user.id;

            const existingPod = await db.get(
                "SELECT pod_id, pod_name, pod_data_public FROM pod WHERE pod_id = ?",
                [podId]
            );

            const existingLatestPodData = await db.get(
                `
                SELECT latitude, longitude
                FROM pod_data
                WHERE pod_id = ?
                ORDER BY datetime(created_at) DESC, pod_data_id DESC
                LIMIT 1
                `,
                [podId]
            );

            // Check if user has this pod registered
            const userPod = await db.get(
                "SELECT pod_id FROM user_pod WHERE user_id = ? AND pod_id = ?",
                [userId, podId]
            );

            if (!userPod) {
                return res.status(404).json({ error: "Pod not found" });
            }

            // Update pod information
            if (nickname || visibility !== undefined) {
                const updates = [];
                const params = [];

                if (nickname) {
                    updates.push("pod_name = ?");
                    params.push(nickname);
                }

                if (visibility !== undefined) {
                    updates.push("pod_data_public = ?");
                    params.push(visibility === "public" ? 1 : 0);
                }

                if (updates.length > 0) {
                    params.push(podId);
                    await db.run(
                        `UPDATE pod SET ${updates.join(", ")} WHERE pod_id = ?`,
                        params
                    );
                }
            }

            // Store pod location data if provided
            if (latitude !== undefined && longitude !== undefined) {
                // check long and lat have required specificity, three decimals minimum
                const latString = latitude.toString();
                const latDecimals = latString.split(".")[1];
                if (latDecimals.length < 3) {
                    return res.status(400).json({ error: "Latitude must have at least three decimal places" });
                }
                const lonString = longitude.toString();
                const lonDecimals = lonString.split(".")[1];
                if (lonDecimals.length < 3) {
                    return res.status(400).json({ error: "Longitude must have at least three decimal places" });
                }

                // Insert or update pod location data in pod_data table for today
                const today = new Date().toISOString().split('T')[0];

                // Check if pod_data exists for today
                const existingPodData = await db.get(
                    "SELECT pod_data_id FROM pod_data WHERE pod_id = ? AND date_collected = ?",
                    [podId, today]
                );

                if (existingPodData) {
                    // Update existing pod_data record
                    await db.run(
                        "UPDATE pod_data SET latitude = ?, longitude = ? WHERE pod_id = ? AND date_collected = ?",
                        [latitude, longitude, podId, today]
                    );
                } else {
                    // Insert new pod_data record
                    await db.run(
                        "INSERT INTO pod_data (pod_id, date_collected, latitude, longitude) VALUES (?, ?, ?, ?)",
                        [podId, today, latitude, longitude]
                    );
                }
            }

            const editChanges = buildEditChanges({
                currentPod: existingPod,
                currentLocation: existingLatestPodData,
                updates: { nickname, visibility, latitude, longitude },
            });

            await logPodAction({
                podId,
                actorUserId: userId,
                actionType: "edited",
                actionDetails: {
                    changes: editChanges,
                },
            });

            return res.status(200).json({ message: "Pod updated successfully" });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // DELETE /me/unregister-pod - Unregister a pod
    // -------------------------
    router.delete("/me/unregister-pod", authenticateToken, sanitizeRequestBody, [
        body("podId")
            .trim()
            .notEmpty()
            .withMessage("Pod ID is required"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "Pod ID is required" });
            }

            const { podId } = req.body;
            const userId = req.user.id;

            const existingPod = await db.get(
                "SELECT pod_id, pod_name, pod_data_public FROM pod WHERE pod_id = ?",
                [podId]
            );

            const existingLatestPodData = await db.get(
                `
                SELECT latitude, longitude
                FROM pod_data
                WHERE pod_id = ?
                ORDER BY datetime(created_at) DESC, pod_data_id DESC
                LIMIT 1
                `,
                [podId]
            );

            // Check if user has this pod registered
            const userPod = await db.get(
                "SELECT pod_id FROM user_pod WHERE user_id = ? AND pod_id = ?",
                [userId, podId]
            );

            if (!userPod) {
                return res.status(404).json({ error: "Pod not registered or found" });
            }

            // Unregister pod for user
            await db.run(
                "DELETE FROM user_pod WHERE user_id = ? AND pod_id = ?",
                [userId, podId]
            );

            await logPodAction({
                podId,
                actorUserId: userId,
                actionType: "deleted",
                actionDetails: {
                    nickname: existingPod?.pod_name ?? null,
                    visibility: existingPod ? (existingPod.pod_data_public ? "public" : "private") : null,
                    latitude: existingLatestPodData?.latitude ?? null,
                    longitude: existingLatestPodData?.longitude ?? null,
                },
            });

            return res.status(200).json({ message: "Pod unregistered successfully" });
        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                message: error?.message,
            });
        }
    });

    return router;
};
