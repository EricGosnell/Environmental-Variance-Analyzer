// API/data.js
const express = require("express");
const { sanitizeRequestBody } = require("./middleware/sanitize");

module.exports = (db) => {
    const router = express.Router();

    router.get("/me", sanitizeRequestBody, async (req, res) => {
        // TODO
    });

    router.get("/:id", sanitizeRequestBody, async (req, res) => {
        // TODO
    });

    router.put("/me/username", sanitizeRequestBody, async (req, res) => {
        const { username } = req.body
        // TODO
    });

    router.post("/me/email/request-change", sanitizeRequestBody, async (req, res) => {
        const { newEmail } = req.body
        // TODO
    });

    router.put("/me/email", sanitizeRequestBody, async (req, res) => {
        const { newEmail, verificationCode } = req.body
        // TODO
    });

    router.put("/me/password", sanitizeRequestBody, async (req, res) => {
        const { oldPassword, newPassword } = req.body
        // TODO
    });

    return router;
};
