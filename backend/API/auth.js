const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { body, validationResult } = require("express-validator");
const {
    sanitizeRequestBody,
    loginValidation,
    registerValidation,
} = require("./middleware/sanitize");
const { sendEmail } = require("../util/email");
const {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiry,
} = require("../util/Tokens");
const { JWT_CONFIG } = require("../util/JWT");
const crypto = require("crypto");


// ========= helpers ==========
function generateCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function hashCode(code) { return crypto.createHash("sha256").update(code).digest("hex"); }


module.exports = (db) => {
    const router = express.Router();

    // -------------------------
    // POST /login
    // -------------------------
    router.post("/login", sanitizeRequestBody, loginValidation, async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: "Validation failed",
                    details: errors.array(),
                });
            }

            const { email, password } = req.body;
            const user = await db.get(
                `
      SELECT u.user_id, u.username, u.password_hash, uc.email, uc.phone_number,  u.verifiedEmail, u.accountLocked
      FROM users u
      JOIN user_contact uc ON u.user_id = uc.user_id
      WHERE LOWER(uc.email) = LOWER(?)
      `,
                [email]
            );
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            if (!user.verifiedEmail) {
                return res.status(403).json({ error: "Email not verified", "needsVerification": true });
            }
            if (user.accountLocked) {
                return res.status(423).json({ error: "Accont locked by admin" });
            }

            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            const expiresAt = getRefreshTokenExpiry();

            await db.run(
                "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                [refreshToken, user.user_id, expiresAt]
            );

            await db.run("DELETE FROM refresh_tokens WHERE expires_at < strftime('%s','now')");

            return res.status(200).json({
                user: {
                    id: user.user_id,
                    username: user.username,
                    email: user.email,
                    phone_number: user.phone_number,
                },
                accessToken,
                refreshToken,
            });

        } catch (error) {
            return res.status(500).json({
                error: "Internal server error",
                where: "/login",
                message: error?.message,
            });
        }
    });

    // -------------------------
    // POST /register
    // -------------------------
    router.post("/register", sanitizeRequestBody, registerValidation, async (req, res) => {
        let transaction = false;

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

            const { username, password, email, phone_number } = req.body;

            const existingUser = await db.get(
                "SELECT user_id FROM users WHERE username = ?",
                [username]
            );

            if (existingUser) { return res.status(409).json({ error: "Username already exists" }); }

            if (email) {
                const existingEmail = await db.get(
                    "SELECT user_id FROM user_contact WHERE email = ?",
                    [email]
                );

                if (existingEmail) { return res.status(409).json({ error: "Email already registered" }); }
            }

            await db.run("BEGIN TRANSACTION");
            transaction = true;

            const hashedPassword = await bcrypt.hash(password, 12);

            const userInsertResult = await db.run(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                [username, hashedPassword]
            );

            const userId = userInsertResult?.lastID;

            if (!userId) {
                throw new Error("INSERT did not return lastID. Your db.run wrapper does not provide lastID.");
            }

            if (email || phone_number) {
                await db.run(
                    "INSERT INTO user_contact (user_id, user_name, email, phone_number) VALUES (?, ?, ?, ?)",
                    [userId, username, email || null, phone_number || null]
                );
            }

            await db.run("COMMIT");
            transaction = false;

            const userWithContact = await db.get(
                `
                SELECT u.user_id, u.username, uc.email, uc.phone_number
                FROM users u
                LEFT JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE u.user_id = ?
                `,
                [userId]
            );

            const accessToken = generateAccessToken(userWithContact);
            const refreshToken = generateRefreshToken(userWithContact);

            const expiresAt = getRefreshTokenExpiry();

            await db.run(
                "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                [refreshToken, userId, expiresAt]
            );

            const responseUser = {
                id: userWithContact.user_id,
                username: userWithContact.username,
                email: userWithContact.email || null,
                phone_number: userWithContact.phone_number || null,
            };

            return res.status(201).json({
                user: responseUser,
                accessToken,
                refreshToken,
            });
        } catch (error) {
            if (transaction) {
                try {
                    await db.run("ROLLBACK");
                } catch (rollbackError) {
                }
            }

            if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
                return res.status(409).json({ error: "Username or email already exists" });
            }

            return res.status(500).json({
                error: "Internal server error",
                where: "/register",
                message: error?.message,
                code: error?.code,
            });
        }
    });

    // -------------------------
    // POST /logout
    // -------------------------
    router.post("/logout", [body("refreshToken").notEmpty().withMessage("Refresh token is required")], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        try {
            const { refreshToken } = req.body;

            const result = await db.run(
                "DELETE FROM refresh_tokens WHERE token = ?",
                [refreshToken]
            );

            // if nothing deleted -> invalid refresh token
            if (!result?.changes) {
                return res.status(401).json({ error: "Invalid refresh token" });
            }

            return res.status(200).json({ message: "Logged out successfully" });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    );

    // -------------------------
    // POST /refresh
    // -------------------------
    router.post("/refresh", [body("refreshToken").notEmpty().withMessage("Refresh token is required")], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: "Refresh token is required" });
        }

        try {
            const { refreshToken } = req.body;

            let decoded;
            try {
                decoded = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret);
            } catch (err) {
                return res.status(401).json({ error: "Invalid or expired refresh token" });
            }

            const tokenRecord = await db.get(
                "SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > strftime('%s','now')",
                [refreshToken]
            );

            if (!tokenRecord) {
                return res.status(401).json({ error: "Invalid or expired refresh token" });
            }

            const user = await db.get(
                `
                SELECT u.user_id, u.username, uc.email, uc.phone_number
                FROM users u
                LEFT JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE u.user_id = ?
                `,
                [decoded.id]
            );

            if (!user) {
                return res.status(401).json({ error: "Invalid or expired refresh token" });
            }

            // 4) Rotate refresh token (delete old)
            await db.run("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);

            // 5) Create new tokens
            const newAccessToken = generateAccessToken(user);
            const newRefreshToken = generateRefreshToken(user);

            // 6) Store new refresh token
            const expiresAt = getRefreshTokenExpiry();
            await db.run(
                "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                [newRefreshToken, user.user_id, expiresAt]
            );

            return res.status(200).json({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            });
        } catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    );

    // -------------------------
    // PUT /send-verification
    // -------------------------
    router.put("/send-verification", [body("email").isEmail().withMessage("Valid email required")],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ errors: errors.array() });

            const email = req.body.email.toLowerCase();

            try {
                const user = await db.get(`
                SELECT u.user_id
                FROM users u
                JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE uc.email = ?
            `, [email]);

                if (!user)
                    return res.status(404).json({ error: "Email not found" });

                const code = generateCode();
                const hash = hashCode(code);
                const expires = Date.now() + 10 * 60 * 1000;

                await db.run(`
                INSERT OR REPLACE INTO email_verification
                VALUES (?, ?, ?, 0, strftime('%s','now'))
            `, [user.user_id, hash, expires]);

                await sendEmail({
                    to: email,
                    subject: "Verify your email",
                    html: `
                    <h2>Your verification code</h2>
                    <p style="font-size:24px;"><b>${code}</b></p>
                    <p>Expires in 10 minutes.</p>
                `
                });

                res.json({ sent: true });

            } catch (err) {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    // -------------------------
    // POST /verify-email
    // -------------------------
    router.post("/verify-email",
        [body("email").isEmail().withMessage("Valid email required"), body("code").isLength({ min: 6, max: 6 }).withMessage("6 digit code required")],
        async (req, res) => {

            const errors = validationResult(req);
            if (!errors.isEmpty())
                return res.status(400).json({ errors: errors.array() });

            const email = req.body.email.toLowerCase();
            const code = req.body.code;

            try {
                const row = await db.get(`
                SELECT ev.*, u.user_id
                FROM email_verification ev
                JOIN user_contact uc ON ev.user_id = uc.user_id
                JOIN users u ON u.user_id = ev.user_id
                WHERE uc.email = ?
            `, [email]);

                if (!row)
                    return res.status(400).json({ error: "No verification code found" });

                if (Date.now() > row.expires_at)
                    return res.status(400).json({ error: "Code expired" });

                if (row.attempts >= 5)
                    return res.status(429).json({ error: "Too many attempts" });

                if (hashCode(code) !== row.code_hash) {
                    await db.run(
                        "UPDATE email_verification SET attempts = attempts + 1 WHERE user_id = ?",
                        [row.user_id]
                    );
                    return res.status(400).json({ error: "Invalid code" });
                }

                await db.run(
                    "UPDATE users SET verifiedEmail = 1 WHERE user_id = ?", [row.user_id]);
                await db.run(
                    "DELETE FROM email_verification WHERE user_id = ?",
                    [row.user_id]
                );

                res.json({ verified: true });

            } catch (err) {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    return router;
};
