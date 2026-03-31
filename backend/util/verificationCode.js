const crypto = require("crypto");

function generateVerificationCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashVerificationCode(code) {
    return crypto.createHash("sha256").update(code).digest("hex");
}

module.exports = {
    generateVerificationCode,
    hashVerificationCode,
};
