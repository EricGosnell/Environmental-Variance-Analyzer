const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

async function sendEmail({ to, subject, html }) {
    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME;
    const nodeEnv = process.env.NODE_ENV;

    if (process.env.EMAIL_DRY_RUN === "1") {
        console.warn("[email] EMAIL_DRY_RUN enabled; skipping outbound email", { to, subject });
        return { skipped: true, reason: "dry_run" };
    }

    if (!brevoApiKey || !senderEmail) {
        if (nodeEnv === "production") {
            throw new Error("Missing required Brevo email configuration");
        }

        console.warn("[email] Missing Brevo configuration; skipping outbound email", {
            hasApiKey: Boolean(brevoApiKey),
            hasSenderEmail: Boolean(senderEmail),
            to,
            subject,
        });
        return { skipped: true, reason: "missing_config" };
    }

    apiInstance.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        brevoApiKey
    );

    const email = {
        sender: {
            email: senderEmail,
            name: senderName
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
    };

    const providerResponse = await apiInstance.sendTransacEmail(email);
    return { skipped: false, providerResponse };
}


module.exports = { sendEmail };
