const { body } = require("express-validator");

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_POLICY_MESSAGE = `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`;
const PASSWORD_COMPLEXITY_MESSAGE = "Password must contain at least one lowercase letter, one uppercase letter, and one number";

const buildPasswordValidator = (fieldName = "password") =>
    body(fieldName)
        .isLength({ min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })
        .withMessage(PASSWORD_POLICY_MESSAGE)
        .matches(PASSWORD_REGEX)
        .withMessage(PASSWORD_COMPLEXITY_MESSAGE);

module.exports = {
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH,
    PASSWORD_REGEX,
    PASSWORD_POLICY_MESSAGE,
    buildPasswordValidator,
};
