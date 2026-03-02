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

const VERIFICATION_TTL_SECONDS = 10 * 60;
const VERIFICATION_MIN_RESEND_SECONDS = 60;
const VERIFICATION_WINDOW_SECONDS = 15 * 60;
const VERIFICATION_MAX_SENDS_PER_WINDOW = 5;

// ========= helpers ==========
const getNowEpochSeconds = () => Math.floor(Date.now() / 1000);

function generateCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

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
      SELECT u.user_id, u.username, u.password_hash, uc.email, uc.phone_number,  u.verified_email, u.account_locked
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

            if (!user.verified_email) {
                return res.status(403).json({ error: "Email not verified", "needsVerification": true });
            }
            if (user.account_locked) {
                return res.status(423).json({ error: "Account locked by admin" });
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

            const email = req.body.email.trim().toLowerCase();
            const now = getNowEpochSeconds();
            const responseMessage = "If the email exists, a verification code was sent.";

            try {
                const user = await db.get(`
                SELECT u.user_id
                FROM users u
                JOIN user_contact uc ON u.user_id = uc.user_id
                WHERE LOWER(uc.email) = LOWER(?)
            `, [email]);

                if (!user) {
                    return res.status(200).json({ message: responseMessage });
                }

                const existingRow = await db.get(
                    "SELECT attempts, send_count, last_sent_at, window_started_at FROM email_verification WHERE user_id = ?",
                    [user.user_id]
                );

                let sendCount = 1;
                let windowStartAt = now;
                const existingSendCount = existingRow?.send_count ?? 0;
                const existingWindowStart = existingRow?.window_started_at ?? now;
                const existingLastSentAt = existingRow?.last_sent_at ?? 0;

                if (existingRow) {
                    if (existingLastSentAt + VERIFICATION_MIN_RESEND_SECONDS > now) {
                        return res.status(429).json({ error: "Please wait before requesting another verification code." });
                    }

                    if ((now - existingWindowStart) <= VERIFICATION_WINDOW_SECONDS) {
                        if (existingSendCount >= VERIFICATION_MAX_SENDS_PER_WINDOW) {
                            return res.status(429).json({ error: "Too many verification codes sent. Try again later." });
                        }

                        sendCount = existingSendCount + 1;
                        windowStartAt = existingWindowStart;
                    } else {
                        sendCount = 1;
                        windowStartAt = now;
                    }
                }

                const code = generateCode();
                const hash = hashCode(code);
                const expires = now + VERIFICATION_TTL_SECONDS;

                await db.run(`
                    INSERT INTO email_verification (
                        user_id,
                        code_hash,
                        expires_at,
                        attempts,
                        send_count,
                        last_sent_at,
                        window_started_at
                    )
                    VALUES (?, ?, ?, 0, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        code_hash = excluded.code_hash,
                        expires_at = excluded.expires_at,
                        attempts = excluded.attempts,
                        send_count = excluded.send_count,
                        last_sent_at = excluded.last_sent_at,
                        window_started_at = excluded.window_started_at
                `, [user.user_id, hash, expires, sendCount, now, windowStartAt]);

                await sendEmail({
                    to: email,
                    subject: "Verify your email",
                    html: `
                    <h2>Your verification code</h2>
                    <p style="font-size:24px;"><b>${code}</b></p>
                    <p>Expires in 10 minutes.</p>
                `
                });

                res.json({ message: responseMessage });

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

            const email = req.body.email.trim().toLowerCase();
            const code = req.body.code;
            const now = getNowEpochSeconds();

            try {
                const row = await db.get(`
                SELECT ev.*, u.user_id
                FROM email_verification ev
                JOIN user_contact uc ON ev.user_id = uc.user_id
                JOIN users u ON u.user_id = ev.user_id
                WHERE LOWER(uc.email) = LOWER(?)
            `, [email]);

                if (!row)
                    return res.status(400).json({ error: "No verification code found" });

                if (now > row.expires_at)
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
                    "UPDATE users SET verified_email = 1 WHERE user_id = ?", [row.user_id]);
                await db.run(
                    "DELETE FROM email_verification WHERE user_id = ?",
                    [row.user_id]
                );

                res.json({ message: "Email verified" });

            } catch (err) {
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    return router;
};
