// API/org.js
const express = require("express");
const { param, body, validationResult } = require("express-validator");
const { authenticateToken } = require("../util/Tokens");

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
                const userId = req.user.id;
                const orgs = await db.all(
                    `
                        SELECT o.*, uo.role, uo.status
                        FROM org o
                        JOIN user_org uo ON o.org_id = uo.org_id
                        WHERE uo.user_id = ?
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
    router.get(
        "/all",
        authenticateToken,
        async (req, res) => {
            try {
                const orgs = await db.all(
                    `
                      SELECT *
                      FROM org
                      ORDER BY created_at DESC
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
    // returns org details
    router.get(
        "/:orgId",
        authenticateToken,
        [param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),],
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

                const org = await db.get(
                    `SELECT * FROM org WHERE org_id = ?`,
                    [orgId]
                );

                if (!org) {
                    return res.status(404).json({ error: "Org not found" });
                }

                const membership = await db.get(
                    `
                      SELECT role, status
                      FROM user_org
                      WHERE user_id = ? AND org_id = ?
                    `,
                    [userId, orgId]
                );

                if (!membership) {
                    return res.status(403).json({ error: "Not a member of this org" });
                }

                return res.status(200).json({
                    org,
                    membership,
                });
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
    // POST /orgs
    // -------------------------
    // create a new organization and makes the user an org owner
    router.post(
        "/",
        authenticateToken,
        [
            body("name").notEmpty().withMessage("Name is required"),
            body("email").isEmail().withMessage("Valid email required"),
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
                        INSERT INTO user_org (user_id, org_id, role, status)
                        VALUES (?, ?, 'admin', 'active')
                    `,
                    [userId, orgId]
                );

                return res.status(201).json({ orgId });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs (POST)",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // POST /orgs/:orgId/add-member
    // -------------------------
    // add user to org

    // -------------------------
    // POST /orgs/:orgId/invite
    // -------------------------
    // creates an invitation from org to user
    router.post(
        "/:orgId/invite",
        authenticateToken,
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
                        details: errors.array(),
                    });
                }

                const orgId = Number(req.params.orgId);
                const senderId = req.user.id;
                const { userId } = req.body;

                const membership = await db.get(
                    `SELECT role FROM user_org WHERE user_id = ? AND org_id = ?`,
                    [senderId, orgId]
                );

                if (!membership || membership.role !== "admin") {
                    return res.status(403).json({ error: "Admin only" });
                }

                await db.run(
                    `
                        INSERT INTO user_org (user_id, org_id, role, status)
                        VALUES (?, ?, 'member', 'invited')
                    `,
                    [userId, orgId]
                );

                await db.run(
                    `
                        INSERT INTO message (sender_id, receiver_id, type, org_id, status)
                        VALUES (?, ?, 'invite', ?, 'pending')
                    `,
                    [senderId, userId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/invite",
                    message: error?.message,
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
        [
            param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),
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

                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                await db.run(
                    `
                        INSERT INTO user_org (user_id, org_id, role, status)
                        VALUES (?, ?, 'member', 'requested')
                    `,
                    [userId, orgId]
                );

                const admins = await db.all(
                    `SELECT user_id FROM user_org WHERE org_id = ? AND role = 'admin'`,
                    [orgId]
                );

                for (const admin of admins) {
                    await db.run(
                        `INSERT INTO message (sender_id, receiver_id, type, org_id, status)
           VALUES (?, ?, 'request', ?, 'pending')`,
                        [userId, admin.user_id, orgId]
                    );
                }

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/request",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // PUT /orgs/:orgId/update-org
    // -------------------------
    // update org details
    router.put(
        "/:orgId/update-org",
        authenticateToken,
        [
            param("orgId").isInt({ gt: 0 }).withMessage("Org id must be a positive integer"),
        ],
        async (req, res) => {
            try {
                const { name, email, bio } = req.body;
                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                // admin check
                const membership = await db.get(
                    `SELECT role FROM user_org WHERE user_id = ? AND org_id = ?`,
                    [userId, orgId]
                );

                if (!membership || membership.role !== "admin") {
                    return res.status(403).json({ error: "Admin only" });
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
                    where: "/orgs/:orgId/update-org",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // PUT /orgs/:orgId/members/:userID/role
    // -------------------------
    // change org member role to owner and grants permissions
    router.put(
        "/:orgId/members/:userId/role",
        authenticateToken,
        [
            param("orgId").isInt({ gt: 0 }),
            param("userId").isInt({ gt: 0 }),
            body("role").isIn(["admin", "member"]).withMessage("Invalid role"),
        ],
        async (req, res) => {
            try {
                const { orgId, userId } = req.params;
                const { role } = req.body;
                const requesterId = req.user.id;

                // admin check
                const membership = await db.get(
                    `SELECT role FROM user_org WHERE user_id = ? AND org_id = ?`,
                    [requesterId, orgId]
                );

                if (!membership || membership.role !== "admin") {
                    return res.status(403).json({ error: "Admin only" });
                }

                await db.run(
                    `UPDATE user_org
         SET role = ?
         WHERE user_id = ? AND org_id = ?`,
                    [role, userId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/members/:userId/role",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // DELETE /orgs/:orgId/delete-member/:userId
    // -------------------------
    // removes a user from org
    router.delete(
        "/:orgId/delete-member/:userId",
        authenticateToken,
        [
            param("orgId").isInt({ gt: 0 }),
            param("userId").isInt({ gt: 0 }),
        ],
        async (req, res) => {
            try {
                const { orgId, userId } = req.params;
                const requesterId = req.user.id;

                const requester = await db.get(
                    `SELECT role FROM user_org WHERE user_id = ? AND org_id = ?`,
                    [requesterId, orgId]
                );

                if (!requester) {
                    return res.status(403).json({ error: "Not a member" });
                }

                if (requesterId !== Number(userId) && requester.role !== "admin") {
                    return res.status(403).json({ error: "Not allowed" });
                }

                await db.run(
                    `DELETE FROM user_org WHERE user_id = ? AND org_id = ?`,
                    [userId, orgId]
                );

                return res.status(200).json({ success: true });

            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId/delete-member/:userId",
                    message: error?.message,
                });
            }
        }
    );

    // -------------------------
    // DELETE /orgs/:orgId/delete-org
    // -------------------------
    // deletes org
    router.delete(
        "/:orgId",
        authenticateToken,
        [
            param("orgId")
                .isInt({ gt: 0 })
                .withMessage("Org id must be a positive integer"),
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

                const orgId = Number(req.params.orgId);
                const userId = req.user.id;

                const membership = await db.get(
                    `
          SELECT role
          FROM user_org
          WHERE user_id = ? AND org_id = ?
          `,
                    [userId, orgId]
                );

                if (!membership || membership.role !== "admin") {
                    return res.status(403).json({ error: "Admin only" });
                }

                await db.run(`DELETE FROM org WHERE org_id = ?`, [orgId]);

                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({
                    error: "Internal server error",
                    where: "/orgs/:orgId DELETE",
                    message: error?.message,
                });
            }
        }
    );
}