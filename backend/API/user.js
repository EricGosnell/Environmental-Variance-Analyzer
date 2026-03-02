// API/user.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { sanitizeRequestBody } = require("./middleware/sanitize");
const { authenticateToken } = require("../util/Tokens");
const { sendEmail } = require("../util/email");

//USING THESE FOR VALIDATION RESTRICTIONS FOR NOW, 
//CAN BE CHANGED LATER IF WE DECIDE TO - Ryan
const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 255;

module.exports = (db) => {
    const router = express.Router();

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
            if (!errors.isEmpty()) {
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
                return res.status(409).json({ error: "Email already in use" });
            }

            // Generate verification code (6-digit)
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Store pending email change with verification code for 15 minutes
            const expiresAt = Math.floor(Date.now() / 1000) + (15 * 60);

            await db.run(
                `
                INSERT INTO pending_email_changes (user_id, new_email, verification_code, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET new_email = ?, verification_code = ?, expires_at = ?
                `,
                [userId, newEmail, verificationCode, expiresAt, newEmail, verificationCode, expiresAt]
            );

            await sendEmail({
                to: newEmail,
                subject: "Verify your new email",
                html: `
                    <h2>Your email change verification code</h2>
                    <p style="font-size:24px;"><b>${verificationCode}</b></p>
                    <p>Expires in 15 minutes.</p>
                `
            });

            return res.status(200).json({ message: "Verification code sent to new email" });
        } catch (error) {
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
            if (pendingChange.verification_code !== verificationCode) {
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
    // PUT /me/password - Update password
    // -------------------------
    router.put("/me/password", authenticateToken, sanitizeRequestBody, [
        body("oldPassword")
            .trim()
            .notEmpty()
            .withMessage("Old password is required"),
        body("newPassword")
            .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
            .withMessage(`Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`)
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage("Password must contain at least one lowercase letter, one uppercase letter, and one number"),
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
        body("podId")
            .trim()
            .notEmpty()
            .isInt({ gt: 0 })
            .withMessage("Pod ID is required"),
        body("nickname")
            .trim()
            .notEmpty()
            .withMessage("Nickname is required"),
        body("visibility")
            .trim()
            //the readME lists this as a string, 
            // should we use a bollean instead? - Ryan
            .isIn(["public", "private"])
            .withMessage("Visibility must be either 'public' or 'private'"),
        body("latitude")
            .optional()
            .isFloat({ min: -90, max: 90 })
            .withMessage("Latitude must be a valid number between -90 and 90"),
        body("longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be a valid number between -180 and 180"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "One or more required parameters are invalid or missing" });
            }

            const { podId, nickname, visibility, latitude, longitude } = req.body;
            const userId = req.user.id;

            // Check if user already has this pod registered
            const existingPod = await db.get(
                "SELECT pod_id FROM user_pod WHERE user_id = ? AND pod_id = ?",
                [userId, podId]
            );

            if (existingPod) {
                return res.status(409).json({ message: "Pod already registered" });
            }

            //Check long and lat have required specificity, three decimals minimum
            if (latitude !== undefined) {
                const latString = latitude.toString();
                const latDecimals = latString.split(".")[1];
                if (latDecimals.length < 3) {
                    return res.status(400).json({ error: "Latitude must have at least three decimal places" });
                }
            }

            if (longitude !== undefined) {
                const lonString = longitude.toString();
                const lonDecimals = lonString.split(".")[1];
                if (lonDecimals.length < 3) {
                    return res.status(400).json({ error: "Longitude must have at least three decimal places" });
                }
            }

            // Create pod if it doesn't exist
            const podResult = await db.get(
                "SELECT pod_id FROM pod WHERE pod_id = ?",
                [podId]
            );

            if (!podResult) {
                await db.run(
                    "INSERT INTO pod (pod_id, pod_name, pod_data_public) VALUES (?, ?, ?)",
                    [podId, nickname, visibility === "public" ? 1 : 0]
                );
            }

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

            return res.status(200).json({ message: "Pod registered successfully" });
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
            .withMessage("Latitude must be a valid number between -90 and 90"),
        body("longitude")
            .optional()
            .isFloat({ min: -180, max: 180 })
            .withMessage("Longitude must be a valid number between -180 and 180"),
    ], async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ error: "One or more required parameters are invalid or missing" });
            }

            const { podId, nickname, visibility, latitude, longitude } = req.body;
            const userId = req.user.id;

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
