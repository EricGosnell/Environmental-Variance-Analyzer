const Brevo = require("@getbrevo/brevo");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { body, validationResult } = require("express-validator");
const apiInstance = new Brevo.TransactionalEmailsApi();

const { JWT_CONFIG } = require("./JWT");


apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

async function sendEmail({ to, subject, html }) {
    if (process.env.EMAIL_DRY_RUN === "1") {
        return { skipped: true };
    }

    const email = {
        sender: {
            email: process.env.BREVO_SENDER_EMAIL,
            name: process.env.BREVO_SENDER_NAME
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
    };

    return apiInstance.sendTransacEmail(email);
}


module.exports = { sendEmail };
