// API/message.js
const express = require("express");
const { param, body, validationResult } = require("express-validator");
const { authenticateToken } = require("../util/Tokens");

module.exports = (db) => {
    const router = express.Router();

    // -------------------------
    // GET /messages
    // -------------------------
    // returns all of the user's messages
    router.get("/",
        authenticateToken,
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

                const userId = req.user.id;

                const messages = await db.all(
                    `
                    SELECT m.*, o.org_name, o.org_email, o.org_bio
                    FROM message m
                    LEFT JOIN org o ON m.org_id = o.org_id
                    WHERE m.receiver_id = ?
                    ORDER BY m.created_at DESC
                    `,
                    [userId]
                );

                return res.status(200).json({ messages });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages",
                    message: error?.message,
                    code:error?.code
                });
            }
        }
    );

    // -------------------------
    // PUT /messages/:messageId/respond
    // -------------------------
    // accept or deny invite/request
    router.put("/:messageId/respond",
        authenticateToken,
        [
            param("messageId").isInt({ gt: 0 }).withMessage("Message id must be a positive integer"),
            body("action").isIn(["accepted", "denied"]).withMessage("Action must be accepted or denied")
        ],
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

                const messageId = Number(req.params.messageId);
                const userId = req.user.id;
                const { action } = req.body;

                const message = await db.get(
                    `
                    SELECT * 
                    FROM message 
                    WHERE message_id = ?
                    `,
                    [messageId]
                );

                if (!message) {
                    return res.status(404).json({ error: "Message not found" });
                }

                if (message.receiver_id !== userId) {
                    return res.status(403).json({ error: "Message does not belong to user" });
                }

                if (message.status !== "pending") {
                    return res.status(400).json({ error: "Message already handled" });
                }

                if (message.type === "shared_pod") {
                    return res.status(400).json({ error: "Cannot respond to this message type" });
                }

                await db.run(
                    `
                    UPDATE message 
                    SET status = ? 
                    WHERE message_id = ?`,
                    [action, messageId]
                );

                const orgId = message.org_id;

                if (message.type === "invite") {
                    if (action === "accepted") {
                        await db.run(
                            `
                            UPDATE user_org
                            SET status = 'joined'
                            WHERE user_id = ? AND org_id = ?
                            `,
                            [userId, orgId]
                        );
                    } else {
                        await db.run(
                            `
                            DELETE 
                            FROM user_org
                            WHERE user_id = ? AND org_id = ?
                            `,
                            [userId, orgId]
                        );
                    }
                }

                if (message.type === "request") {
                    const isAdmin = await db.get(
                        `
                        SELECT admin 
                        FROM user_org
                        WHERE user_id = ? AND org_id = ? AND status = 'joined'
                        `,
                        [userId, orgId]
                    );

                    if (!isAdmin || !isAdmin.admin) {
                        return res.status(403).json({ error: "Only admins can respond to requests" });
                    }

                    const requesterId = message.sender_id;

                    if (action === "accepted") {
                        await db.run(
                            `
                            UPDATE user_org
                            SET status = 'joined'
                            WHERE user_id = ? AND org_id = ?
                            `,
                            [requesterId, orgId]
                        );
                    } else {
                        await db.run(
                            `
                            DELETE 
                            FROM user_org
                            WHERE user_id = ? AND org_id = ?
                            `,
                            [requesterId, orgId]
                        );

                        await db.run(
                            `
                            UPDATE message
                            SET status = ?
                            WHERE type = 'request'
                            AND sender_id = ?
                            AND org_id = ?
                            AND status = 'pending'
                            `,
                            [action, requesterId, orgId]
                        );
                    }
                }

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages/:messageId/respond",
                    message: error?.message,
                    code: error?.code
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
        [param("messageId").isInt({ gt: 0 }).withMessage("Message id must be a positive integer")],
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

                const messageId = Number(req.params.messageId);
                const userId = req.user.id;

                const message = await db.get(
                    `
                    SELECT * 
                    FROM message 
                    WHERE message_id = ?
                    `,
                    [messageId]
                );

                if (!message) {
                    return res.status(404).json({ error: "Message not found" });
                }

                if (message.receiver_id !== userId) {
                    return res.status(403).json({ error: "Message does not belong to user" });
                }

                await db.run(
                    `
                    DELETE 
                    FROM message 
                    WHERE message_id = ?
                    `,
                    [messageId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/messages/:messageId",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    return router;
};