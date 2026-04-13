const express = require("express");
const { param, body, validationResult } = require("express-validator");

module.exports = (db) => {
    const router = express.Router();
    const authenticateToken = require("../middleware/authenticateToken");

    // -------------------------
    // GET /messages
    // -------------------------
    // returns all of the user's messages
    router.get(
        "/",
        authenticateToken,
        async (req, res) => {
            try {
                const userId = req.user.id;

                const messages = await db.all(
                    `
          SELECT *
          FROM message
          WHERE receiver_id = ?
          ORDER BY created_at DESC
          `,
                    [userId]
                );

                return res.status(200).json({ messages });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // PUT /messages/:messageId/respond
    // -------------------------
    // accept or deny invite/request
    router.put(
        "/:messageId/respond",
        authenticateToken,
        [
            param("messageId").isInt({ gt: 0 }),
            body("action").isIn(["accepted", "denied"]),
        ],
        async (req, res) => {
            try {
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        error: "Validation failed",
                        details: errors.array(),
                    });
                }

                const messageId = Number(req.params.messageId);
                const userId = req.user.id;
                const { action } = req.body;

                const message = await db.get(
                    `SELECT * FROM message WHERE message_id = ?`,
                    [messageId]
                );

                if (!message) {
                    return res.status(404).json({ error: "Message not found" });
                }

                if (message.receiver_id !== userId) {
                    return res.status(403).json({ error: "Not your message" });
                }

                if (message.status !== "pending") {
                    return res.status(400).json({ error: "Already handled" });
                }

                await db.run(
                    `UPDATE message SET status = ? WHERE message_id = ?`,
                    [action, messageId]
                );

                if (message.type === "invite") {
                    if (action === "accepted") {
                        await db.run(
                            `UPDATE user_org
               SET status = 'active'
               WHERE user_id = ? AND org_id = ?`,
                            [userId, message.org_id]
                        );
                    } else {
                        await db.run(
                            `DELETE FROM user_org
               WHERE user_id = ? AND org_id = ?`,
                            [userId, message.org_id]
                        );
                    }
                }

                if (message.type === "request") {
                    const requesterId = message.sender_id;

                    if (action === "accepted") {
                        await db.run(
                            `UPDATE user_org
               SET status = 'active'
               WHERE user_id = ? AND org_id = ?`,
                            [requesterId, message.org_id]
                        );
                    } else {
                        await db.run(
                            `DELETE FROM user_org
               WHERE user_id = ? AND org_id = ?`,
                            [requesterId, message.org_id]
                        );
                    }
                }

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages/:messageId/respond",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // DELETE /messages/:messageId
    // -------------------------
    // delete message
    router.delete(
        "/:messageId",
        authenticateToken,
        [
            param("messageId").isInt({ gt: 0 }),
        ],
        async (req, res) => {
            try {
                const messageId = Number(req.params.messageId);
                const userId = req.user.id;

                const message = await db.get(
                    `SELECT * FROM message WHERE message_id = ?`,
                    [messageId]
                );

                if (!message) {
                    return res.status(404).json({ error: "Message not found" });
                }

                if (message.receiver_id !== userId) {
                    return res.status(403).json({ error: "Not allowed" });
                }

                await db.run(
                    `DELETE FROM message WHERE message_id = ?`,
                    [messageId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages/:messageId",
                    message: error?.message,
                });
            }
        }
    );

    return router;
};