// API/org.js
const express = require("express");
const { param, body, validationResult } = require("express-validator");
const { authenticateToken } = require("../util/Tokens");
const { sanitizeRequestBody } = require("./middleware/sanitize");

module.exports = (db) => {
    const router = express.Router();

    // -------------------------
    // GET /orgs
    // -------------------------
    // returns all of the organizations the user is a part of
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

                const orgs = await db.all(
                    `
                    SELECT o.*
                    FROM org o
                    JOIN user_org uo ON o.org_id = uo.org_id
                    WHERE uo.user_id = ? AND uo.status = 'joined'
                    ORDER BY LOWER(o.org_name) ASC
                    `,
                    [userId]
                );

                return res.status(200).json({ orgs });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // GET /orgs/all
    // -------------------------
    // returns all organizations
    router.get("/all",
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

                const orgs = await db.all(
                    `
                    SELECT *
                    FROM org
                    ORDER BY LOWER(org_name) ASC
                    `
                );

                return res.status(200).json({ orgs });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/all",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // GET /orgs/:orgId
    // -------------------------
    // returns org info
    router.get("/:orgId",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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

                const orgId = Number(req.params.orgId);

                const org = await db.get(
                    `
                    SELECT * 
                    FROM org
                    WHERE org_id = ?
                    `,
                    [orgId]
                );
                if (!org) return res.status(404).json({ error: "Org not found" });

                return res.status(200).json({ org });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // GET /orgs/:orgId/status
    // -------------------------
    // returns a user's status for joining an org
    router.get(
        "/:orgId/status",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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
                const orgId = Number(req.params.orgId);

                const row = await db.get(
                    `
                    SELECT status
                    FROM user_org
                    WHERE user_id = ? AND org_id = ?
                    `,
                    [userId, orgId]
                );

                if (!row) {
                    return res.status(404).json({ error: "Status not found" });
                }

                if (row.status === 'joined') return res.status(200).json({ status: 'joined' });
                if (row.status === 'requested') return res.status(200).json({ status: 'requested' });
                if (row.status === 'invited') return res.status(200).json({ status: 'invited' });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/status",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // POST /orgs/create-org
    // -------------------------
    // create a new organization and makes the user an org admin
    router.post(
        "/create-org",
        authenticateToken,
        sanitizeRequestBody,
        [
            body("name").notEmpty().withMessage("Name is required"),
            body("email").isEmail().withMessage("Email is required"),
            body("bio").optional().isLength({ max: 100 })
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

                const userId = req.user.id;
                const { name, email, bio } = req.body;

                const result = await db.run(
                    `
                    INSERT INTO org (org_name, org_email, org_bio)
                    VALUES (?, ?, ?)
                    `,
                    [name, email, bio]
                );

                const orgId = result.lastID;

                await db.run(
                    `
                    INSERT INTO user_org (user_id, org_id, admin, status)
                    VALUES (?, ?, 1, 'joined')
                    `,
                    [userId, orgId]
                );

                return res.status(201).json({ orgId });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/create-org",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // POST /orgs/:orgId/invite
    // -------------------------
    // creates an invitation from org to user
    router.post(
        "/:orgId/invite",
        authenticateToken,
        sanitizeRequestBody,
        [
            param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),
            body("userId").isInt({ gt: 0 }).withMessage("User id must be a positive integer"),
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

                const orgId = Number(req.params.orgId);
                const receiverId = Number(req.body.userId);
                const senderId = req.user.id;

                const isAdmin = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [senderId, orgId]
                );

                if (!isAdmin || !isAdmin.admin) {
                    return res.status(403).json({ error: "Invites can be sent by admins only" });
                }

                const isExistingInvite = await db.get(
                    `
                    SELECT * 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ?
                    `,
                    [receiverId, orgId]
                );

                if (isExistingInvite && isExistingInvite.status !== 'rejected') {
                    return res.status(400).json({ error: "Invite already exists" });
                }

                await db.run(
                    `
                    INSERT INTO user_org (user_id, org_id, status)
                    VALUES (?, ?, 'invited')
                    `,
                    [receiverId, orgId]
                );

                await db.run(
                    `
                    INSERT INTO message (sender_id, receiver_id, type, org_id, status)
                    VALUES (?, ?, 'invite', ?, 'pending')
                    `,
                    [senderId, receiverId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/invite",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // POST /orgs/:orgId/request
    // -------------------------
    // creates a request from the user to join an org
    router.post(
        "/:orgId/request",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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

                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                const isExistingRequest = await db.get(
                    `
                    SELECT * 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ?
                    `,
                    [userId, orgId]
                );

                if (isExistingRequest) {
                    return res.status(400).json({ error: "Request already exists" });
                }

                await db.run(
                    `
                    INSERT INTO user_org (user_id, org_id, status)
                    VALUES (?, ?, 'requested')
                    `,
                    [userId, orgId]
                );

                const admins = await db.all(
                    `
                    SELECT user_id 
                    FROM user_org
                    WHERE org_id = ? AND admin = 1
                    `,
                    [orgId]
                );

                for (const admin of admins) {
                    await db.run(
                        `
                        INSERT INTO message (sender_id, receiver_id, type, org_id, status)
                        VALUES (?, ?, 'request', ?, 'pending')
                        `,
                        [userId, admin.user_id, orgId]
                    );
                }

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/request",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // PUT /orgs/:orgId/change-org
    // -------------------------
    // change org details
    router.put(
        "/:orgId/change-org",
        authenticateToken,
        sanitizeRequestBody,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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

                const { name, email, bio } = req.body;
                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                const isAdmin = await db.get(
                    `
                    SELECT admin 
                    FROM user_org
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [userId, orgId]
                );

                if (!isAdmin || !isAdmin.admin) {
                    return res.status(403).json({ error: "Only admin can update org" });
                }

                await db.run(
                    `
                    UPDATE org
                    SET org_name = ?, org_email = ?, org_bio = ?
                    WHERE org_id = ?
                    `,
                    [name, email, bio, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/change-org",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // PUT /orgs/:orgId/members/:userID/change-role
    // -------------------------
    // change org member role to admin and grants permissions
    router.put(
        "/:orgId/members/:userId/change-role",
        authenticateToken,
        [
            param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),
            param("userId").isInt({ gt: 0 }).withMessage("User id must be a positive integer")
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

                const { orgId, userId } = req.params;
                const adminId = req.user.id;

                const isAdmin = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id=? AND org_id=?
                    `,
                    [adminId, orgId]
                );

                if (!isAdmin || (!isAdmin.admin)) {
                    return res.status(403).json({ error: "Only admin can change member roles" });
                }

                const isMember = await db.get(
                    `
                    SELECT status 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [userId, orgId]
                );

                if (!isMember) {
                    return res.status(400).json({ error: "User is not a member" });
                }

                await db.run(
                    `
                    UPDATE user_org
                    SET admin = 1
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [userId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/members/:userId/change-role",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // DELETE /orgs/:orgId/leave
    // -------------------------
    // removes a user from org when they leave
    router.delete(
        "/:orgId/leave",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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

                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                const isMember = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [userId, orgId]
                );

                if (!isMember) {
                    return res.status(403).json({ error: "User is not a member" });
                }

                if (isMember.admin) {
                    const adminCount = await db.get(
                        `
                        SELECT COUNT(*) as count 
                        FROM user_org 
                        WHERE org_id = ? AND admin = 1
                        `,
                        [orgId]
                    );

                    if (adminCount.count === 1) {
                        return res.status(400).json({ error: "Cannot leave as the only admin" });
                    }
                }

                await db.run(
                    `
                    DELETE 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [userId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/leave",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // DELETE /orgs/:orgId/members/:userId
    // -------------------------
    // admin removes a user from org
    router.delete(
        "/:orgId/members/:userId",
        authenticateToken,
        [
            param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),
            param("userId").isInt({ gt: 0 }).withMessage("User id must be a positive integer"),
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

                const orgId = Number(req.params.orgId);
                const targetUserId = Number(req.params.userId);
                const adminId = req.user.id;

                const isAdmin = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [adminId, orgId]
                );

                if (!isAdmin || !isAdmin.admin) {
                    return res.status(403).json({ error: "Only admins can remove members" });
                }

                const isMember = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id = ? AND org_id = ? AND status = 'joined'
                    `,
                    [targetUserId, orgId]
                );

                if (!isMember) {
                    return res.status(404).json({ error: "User is not a member" });
                }

                await db.run(
                    `
                    DELETE FROM user_org 
                    WHERE user_id = ? AND org_id = ?
                    `,
                    [targetUserId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/members/:userId",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );

    // -------------------------
    // DELETE /orgs/:orgId/delete-org
    // -------------------------
    // deletes org
    router.delete(
        "/:orgId/delete-org",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer")],
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

                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                const isAdmin = await db.get(
                    `
                    SELECT admin 
                    FROM user_org 
                    WHERE user_id=? AND org_id=?`,
                    [userId, orgId]
                );

                if (!isAdmin || !isAdmin.admin) {
                    return res.status(403).json({ error: "Only admin can delete org" });
                }

                await db.run(
                    `
                    DELETE 
                    FROM org 
                    WHERE org_id = ?
                    `,
                    [orgId]
                );

                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/delete-org",
                    message: error?.message,
                    code: error?.code
                });
            }
        }
    );
}