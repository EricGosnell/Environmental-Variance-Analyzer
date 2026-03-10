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
const {
    generateVerificationCode,
    hashVerificationCode,
} = require("../util/verificationCode");
const { buildPasswordValidator } = require("../util/passwordPolicy");

const VERIFICATION_TTL_SECONDS = 10 * 60;
const VERIFICATION_MIN_RESEND_SECONDS = 60;
const VERIFICATION_WINDOW_SECONDS = 15 * 60;
const VERIFICATION_MAX_SENDS_PER_WINDOW = 5;
const VERIFICATION_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TTL_SECONDS = 10 * 60;
const PASSWORD_RESET_MIN_RESEND_SECONDS = 60;
const PASSWORD_RESET_WINDOW_SECONDS = 15 * 60;
const PASSWORD_RESET_MAX_SENDS_PER_WINDOW = 5;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_RESPONSE_MESSAGE = "If the email exists, a password reset code was sent.";

// ========= helpers ==========
const getNowEpochSeconds = () => Math.floor(Date.now() / 1000);
const normalizeEmail = (email = "") => email.trim().toLowerCase();

const validationErrorPayload = (errors) => ({
    error: "Validation failed",
    details: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
    })),
});

const CODE_TABLE_CONFIG = {
    password_reset: {
        selectSendStateQuery: "SELECT send_count, last_sent_at, window_started_at FROM password_reset WHERE user_id = ?",
        upsertQuery: `
            INSERT INTO password_reset (
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
        `,
        selectByEmailQuery: `
            SELECT pr.*
            FROM password_reset pr
            JOIN user_contact uc ON pr.user_id = uc.user_id
            WHERE LOWER(uc.email) = LOWER(?)
        `,
        incrementAttemptsQuery: "UPDATE password_reset SET attempts = attempts + 1 WHERE user_id = ?",
        deleteByUserIdQuery: "DELETE FROM password_reset WHERE user_id = ?",
    },
    email_verification: {
        selectSendStateQuery: "SELECT send_count, last_sent_at, window_started_at FROM email_verification WHERE user_id = ?",
        upsertQuery: `
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
        `,
        selectByEmailQuery: `
            SELECT ev.*
            FROM email_verification ev
            JOIN user_contact uc ON ev.user_id = uc.user_id
            WHERE LOWER(uc.email) = LOWER(?)
        `,
        incrementAttemptsQuery: "UPDATE email_verification SET attempts = attempts + 1 WHERE user_id = ?",
        deleteByUserIdQuery: "DELETE FROM email_verification WHERE user_id = ?",
    },
};

const getSendWindowState = ({
    existingRow,
    now,
    minResendSeconds,
    windowSeconds,
    maxSendsPerWindow,
}) => {
    if (!existingRow) {
        return { canSend: true, sendCount: 1, windowStartAt: now };
    }

    const existingSendCount = existingRow?.send_count ?? 0;
    const existingWindowStart = existingRow?.window_started_at ?? now;
    const existingLastSentAt = existingRow?.last_sent_at ?? 0;

    if (existingLastSentAt + minResendSeconds > now) {
        return { canSend: false, sendCount: existingSendCount, windowStartAt: existingWindowStart };
    }

    if ((now - existingWindowStart) <= windowSeconds) {
        if (existingSendCount >= maxSendsPerWindow) {
            return { canSend: false, sendCount: existingSendCount, windowStartAt: existingWindowStart };
        }

        return { canSend: true, sendCount: existingSendCount + 1, windowStartAt: existingWindowStart };
    }

    return { canSend: true, sendCount: 1, windowStartAt: now };
};

const getUserByEmail = (db, email) =>
    db.get(`
        SELECT u.user_id
        FROM users u
        JOIN user_contact uc ON u.user_id = uc.user_id
        WHERE LOWER(uc.email) = LOWER(?)
    `, [email]);

const getCodeRowByEmail = (db, tableKey, email) =>
    db.get(CODE_TABLE_CONFIG[tableKey].selectByEmailQuery, [email]);

const issueCodeForUser = async ({
    db,
    tableKey,
    userId,
    email,
    now,
    ttlSeconds,
    sendCount,
    windowStartAt,
    subject,
    heading,
}) => {
    const code = generateVerificationCode();
    const hash = hashVerificationCode(code);
    const expires = now + ttlSeconds;
    const expiresMinutes = Math.floor(ttlSeconds / 60);

    await db.run(CODE_TABLE_CONFIG[tableKey].upsertQuery, [
        userId,
        hash,
        expires,
        sendCount,
        now,
        windowStartAt,
    ]);

    await sendEmail({
        to: email,
        subject,
        html: `
            <h2>${heading}</h2>
            <p style="font-size:24px;"><b>${code}</b></p>
            <p>Expires in ${expiresMinutes} minutes.</p>
        `,
    });
};

const validateCodeAttempt = async ({
    db,
    tableKey,
    row,
    providedCode,
    now,
    maxAttempts,
    notFoundError,
    expiredError,
    invalidError,
    deleteOnExpired = false,
}) => {
    if (!row) {
        return { status: 400, error: notFoundError };
    }

    if (now > row.expires_at) {
        if (deleteOnExpired) {
            await db.run(CODE_TABLE_CONFIG[tableKey].deleteByUserIdQuery, [row.user_id]);
        }
        return { status: 400, error: expiredError };
    }

    if (row.attempts >= maxAttempts) {
        return { status: 429, error: "Too many attempts" };
    }

    if (hashVerificationCode(providedCode) !== row.code_hash) {
        await db.run(CODE_TABLE_CONFIG[tableKey].incrementAttemptsQuery, [row.user_id]);
        return { status: 400, error: invalidError };
    }

    return null;
};


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
                return res.status(403).json({ error: "Email not verified" });
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

            const existingEmail = await db.get(
                "SELECT user_id FROM user_contact WHERE email = ?",
                [email]
            );

            if (existingEmail) { return res.status(409).json({ error: "Email already registered" }); }

            await db.run("BEGIN TRANSACTION");
            transaction = true;

            const hashedPassword = await bcrypt.hash(password, 12);
            const verifiedEmail = 0;

            const userInsertResult = await db.run(
                "INSERT INTO users (username, password_hash, verified_email) VALUES (?, ?, ?)",
                [username, hashedPassword, verifiedEmail]
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

            const responseUser = {
                id: userWithContact.user_id,
                username: userWithContact.username,
                email: userWithContact.email || null,
                phone_number: userWithContact.phone_number || null,
            };

            return res.status(201).json({
                user: responseUser,
                message: "Registration successful. Please verify your email.",
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
    // POST /forgot-password
    // -------------------------
    router.post("/forgot-password", sanitizeRequestBody, [
        body("email")
            .isEmail()
            .withMessage("Valid email required"),
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(validationErrorPayload(errors));
        }

        const email = normalizeEmail(req.body.email);
        const now = getNowEpochSeconds();

        try {
            const user = await getUserByEmail(db, email);

            if (!user) {
                return res.status(200).json({ message: PASSWORD_RESET_RESPONSE_MESSAGE });
            }

            const existingRow = await db.get(
                CODE_TABLE_CONFIG.password_reset.selectSendStateQuery,
                [user.user_id]
            );

            const sendWindowState = getSendWindowState({
                existingRow,
                now,
                minResendSeconds: PASSWORD_RESET_MIN_RESEND_SECONDS,
                windowSeconds: PASSWORD_RESET_WINDOW_SECONDS,
                maxSendsPerWindow: PASSWORD_RESET_MAX_SENDS_PER_WINDOW,
            });

            if (!sendWindowState.canSend) {
                return res.status(200).json({ message: PASSWORD_RESET_RESPONSE_MESSAGE });
            }

            await issueCodeForUser({
                db,
                tableKey: "password_reset",
                userId: user.user_id,
                email,
                now,
                ttlSeconds: PASSWORD_RESET_TTL_SECONDS,
                sendCount: sendWindowState.sendCount,
                windowStartAt: sendWindowState.windowStartAt,
                subject: "Reset your password",
                heading: "Your password reset code",
            });

            return res.status(200).json({ message: PASSWORD_RESET_RESPONSE_MESSAGE });
        } catch (err) {
            console.error("forgot-password failed:", err);
            return res.status(200).json({ message: PASSWORD_RESET_RESPONSE_MESSAGE });
        }
    });

    // -------------------------
    // POST /reset-password
    // -------------------------
    router.post("/reset-password", sanitizeRequestBody, [
        body("email")
            .isEmail()
            .withMessage("Valid email required"),
        body("token")
            .isLength({ min: 6, max: 6 })
            .withMessage("6 digit code required")
            .isNumeric()
            .withMessage("6 digit code required"),
        buildPasswordValidator("newPassword"),
    ], async (req, res) => {
        let transaction = false;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(validationErrorPayload(errors));
        }

        const email = normalizeEmail(req.body.email);
        const token = req.body.token;
        const newPassword = req.body.newPassword;
        const now = getNowEpochSeconds();

        try {
            const row = await getCodeRowByEmail(db, "password_reset", email);

            const codeError = await validateCodeAttempt({
                db,
                tableKey: "password_reset",
                row,
                providedCode: token,
                now,
                maxAttempts: PASSWORD_RESET_MAX_ATTEMPTS,
                notFoundError: "Invalid or expired reset token",
                expiredError: "Invalid or expired reset token",
                invalidError: "Invalid or expired reset token",
                deleteOnExpired: true,
            });

            if (codeError) {
                return res.status(codeError.status).json({ error: codeError.error });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);

            await db.run("BEGIN TRANSACTION");
            transaction = true;

            await db.run(
                "UPDATE users SET password_hash = ? WHERE user_id = ?",
                [hashedPassword, row.user_id]
            );
            await db.run(
                CODE_TABLE_CONFIG.password_reset.deleteByUserIdQuery,
                [row.user_id]
            );
            await db.run(
                "DELETE FROM refresh_tokens WHERE user_id = ?",
                [row.user_id]
            );

            await db.run("COMMIT");
            transaction = false;

            return res.status(200).json({ message: "Password reset successfully" });
        } catch (err) {
            if (transaction) {
                try {
                    await db.run("ROLLBACK");
                } catch (rollbackError) {
                    console.error("reset-password rollback failed:", rollbackError);
                }
            }
            console.error("reset-password failed:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    // -------------------------
    // POST /send-verification
    // -------------------------
    router.post("/send-verification", [body("email").isEmail().withMessage("Valid email required")],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(validationErrorPayload(errors));
            }

            const email = normalizeEmail(req.body.email);
            const now = getNowEpochSeconds();
            const responseMessage = "If the email exists, a verification code was sent.";

            try {
                const user = await getUserByEmail(db, email);

                if (!user) {
                    return res.status(200).json({ message: responseMessage });
                }

                const existingRow = await db.get(
                    CODE_TABLE_CONFIG.email_verification.selectSendStateQuery,
                    [user.user_id]
                );

                const sendWindowState = getSendWindowState({
                    existingRow,
                    now,
                    minResendSeconds: VERIFICATION_MIN_RESEND_SECONDS,
                    windowSeconds: VERIFICATION_WINDOW_SECONDS,
                    maxSendsPerWindow: VERIFICATION_MAX_SENDS_PER_WINDOW,
                });

                if (!sendWindowState.canSend) {
                    return res.status(200).json({ message: responseMessage });
                }

                await issueCodeForUser({
                    db,
                    tableKey: "email_verification",
                    userId: user.user_id,
                    email,
                    now,
                    ttlSeconds: VERIFICATION_TTL_SECONDS,
                    sendCount: sendWindowState.sendCount,
                    windowStartAt: sendWindowState.windowStartAt,
                    subject: "Verify your email",
                    heading: "Your verification code",
                });

                res.json({ message: responseMessage });

            } catch (err) {
                console.error("send-verification failed:", err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    // -------------------------
    // POST /verify-email
    // -------------------------
    router.post("/verify-email",
        [
            body("email").isEmail().withMessage("Valid email required"),
            body("code")
                .isLength({ min: 6, max: 6 })
                .withMessage("6 digit code required")
                .isNumeric()
                .withMessage("6 digit code required"),
        ],
        async (req, res) => {

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(validationErrorPayload(errors));
            }

            const email = normalizeEmail(req.body.email);
            const code = req.body.code;
            const now = getNowEpochSeconds();

            try {
                const row = await getCodeRowByEmail(db, "email_verification", email);

                const codeError = await validateCodeAttempt({
                    db,
                    tableKey: "email_verification",
                    row,
                    providedCode: code,
                    now,
                    maxAttempts: VERIFICATION_MAX_ATTEMPTS,
                    notFoundError: "No verification code found",
                    expiredError: "Code expired",
                    invalidError: "Invalid code",
                    deleteOnExpired: false,
                });

                if (codeError) {
                    return res.status(codeError.status).json({ error: codeError.error });
                }

                await db.run(
                    "UPDATE users SET verified_email = 1 WHERE user_id = ?", [row.user_id]);
                await db.run(
                    CODE_TABLE_CONFIG.email_verification.deleteByUserIdQuery,
                    [row.user_id]
                );

                res.json({ message: "Email verified" });

            } catch (err) {
                console.error("verify-email failed:", err);
                res.status(500).json({ error: "Internal server error" });
            }
        }
    );

    return router;
};
