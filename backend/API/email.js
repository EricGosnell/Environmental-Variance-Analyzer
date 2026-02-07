const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
);

async function sendEmail({ to, subject, html }) {
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