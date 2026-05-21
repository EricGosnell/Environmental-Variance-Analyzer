const express = require("express");
const crypto = require("crypto");
const { authenticateToken } = require("../util/Tokens");

const { JWT_CONFIG } = require("../util/JWT");

module.exports = (db) => {
    const router = express.Router();

    const ensureInvitationTokensTable = async (res) => {
        const table = await db.get(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'invitation_tokens'"
        );

        if (!table) {
            res.status(503).json({
                error: "Invitation token endpoints are temporarily unavailable until schema migration is applied"
            });
            return false;
        }

        return true;
    };

    // Middleware to check if user is admin
    const authenticateAdmin = async (req, res, next) => {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Access token required" });
        }

        const jwt = require("jsonwebtoken");

        jwt.verify(token, JWT_CONFIG.accessTokenSecret, async (err, user) => {
            if (err) {
                return res.status(403).json({ error: "Invalid or expired token" });
            }

            req.user = user;

            const userId = req.user.id;
            const row = await db.get("SELECT admin, is_active FROM users WHERE user_id = ?", [userId]);

            if (!row || !row.admin || !row.is_active) {
                return res.status(403).json({ error: "Admin access required" });
            }

            next();
        });
    };

    // -------------------------
    // GET /users - return all users in database
    // -------------------------
    router.get("/users", authenticateAdmin, async (req, res) => {
        try {
            const users = await db.all(`
                SELECT u.user_id as id, u.username, u.created_at, u.is_active, u.admin, uc.email, uc.phone_number
                FROM users u
                LEFT JOIN user_contact uc ON u.user_id = uc.user_id
            `);

            return res.status(200).json({ users });
        } catch (error) {
            console.error("Error fetching users:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    // -------------------------
    //  GET /users/invitation-token -generates new inivitation token for user, valid for 1 week
    // -------------------------
    router.get("/users/invitation-token", authenticateAdmin, async (req, res) => {
        try {
            if (!(await ensureInvitationTokensTable(res))) {
                return;
            }

            const token = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 char hex, upper
            const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 1 week

            const userId = req.user.id;

            await db.run("INSERT INTO invitation_tokens (token, created_by, expires_at) VALUES (?, ?, ?)", [token, userId, expiresAt]);
            // placeholder URL
            //TODO: decide once and for all how our invitation system works
            const invitationURL = `https://example.com/register?token=${token}`; 

            return res.status(200).json({
                invitationToken: token,
                invitationURL,
                expiresAt: new Date(expiresAt * 1000).toISOString()
            });
        } catch (error) {
            console.error("Error generating invitation token:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    // -------------------------
    // DELETE /users/invitation-token - This endpoint revokes an invitation token.
    // -------------------------
    router.delete("/users/invitation-token", authenticateAdmin, async (req, res) => {
        const { invitationToken } = req.body;

        if (!invitationToken) {
            return res.status(400).json({ error: "Invitation token is required" });
        }

        try {
            if (!(await ensureInvitationTokensTable(res))) {
                return;
            }

            const result = await db.run("DELETE FROM invitation_tokens WHERE token = ?", [invitationToken]);

            if (!result.changes) {
                return res.status(404).json({ error: "Invitation token not found" });
            }

            return res.status(200).json({ message: "Invitation token revoked successfully" });
        } catch (error) {
            console.error("Error revoking invitation token:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    // -------------------------
    // PUT /users/{id}/deactivate - deactivates user account
    // -------------------------
    router.put("/users/:id/deactivate", authenticateAdmin, async (req, res) => {
        const { id } = req.params;
        const { deactivate, removeData } = req.body;

        if (typeof deactivate !== 'boolean' || typeof removeData !== 'boolean') {
            return res.status(400).json({ error: "deactivate and removeData must be booleans" });
        }

        try {
            const user = await db.get("SELECT user_id FROM users WHERE user_id = ?", [id]);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            if (deactivate) {
                await db.run("UPDATE users SET is_active = FALSE WHERE user_id = ?", [id]);

                if (removeData) {
                    // Get pods owned by user
                    const userPods = await db.all("SELECT pod_id FROM user_pod WHERE user_id = ?", [id]);

                    for (const pod of userPods) {
                        // Delete sensor data
                        await db.run(`
                            DELETE FROM sensor_data
                            WHERE pod_data_id IN (
                                SELECT pod_data_id FROM pod_data WHERE pod_id = ?
                            )
                        `, [pod.pod_id]);

                        // Delete pod data
                        await db.run("DELETE FROM pod_data WHERE pod_id = ?", [pod.pod_id]);

                        // Delete pod
                        await db.run("DELETE FROM pod WHERE pod_id = ?", [pod.pod_id]);
                    }

                    // Delete user_pod associations
                    await db.run("DELETE FROM user_pod WHERE user_id = ?", [id]);

                    // Delete contact info
                    await db.run("DELETE FROM user_contact WHERE user_id = ?", [id]);
                }
            } else {
                // Reactivate
                await db.run("UPDATE users SET is_active = TRUE WHERE user_id = ?", [id]);
            }

            return res.status(200).json({ message: "User deactivated successfully" });
        } catch (error) {
            console.error("Error deactivating user:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });

    return router;
};
