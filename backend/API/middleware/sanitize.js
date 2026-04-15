const xss = require("xss");
const { body } = require("express-validator");
const { buildPasswordValidator } = require("../../util/passwordPolicy");

const MIN_USERNAME_LENGTH = 4;
const MAX_USERNAME_LENGTH = 16;

const MAX_EMAIL_LENGTH = 255;
const PASSWORD_FIELD_KEYS = new Set(["password", "newpassword", "oldpassword", "confirmpassword"]);

// sanitize single value
const sanitizeInput = (input) => {
    if (typeof input === "string") return xss(input.trim());
    return input;
};

// express middleware: sanitizes req.body
const sanitizeRequestBody = (req, res, next) => {
    if (req.body && typeof req.body === "object") {
        Object.keys(req.body).forEach((key) => {
            const value = req.body[key];
            if (typeof value !== "string") return;
            if (PASSWORD_FIELD_KEYS.has(key.toLowerCase())) return;
            req.body[key] = sanitizeInput(value);
        });
    }
    next();
};

// Input validation schemas for login and registration
const loginValidation = [
    body("email")
        .isEmail()
        .withMessage("Must be a valid email address")
        .trim(),

    body("password")
        .notEmpty()
        .withMessage("Password is required"),
];


const registerValidation = [
    body("username")
        .isLength({ min: MIN_USERNAME_LENGTH, max: MAX_USERNAME_LENGTH })
        .withMessage(`Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`)
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage("Username can only contain letters, numbers, underscores, and hyphens")
        .trim()
        .escape(),

    buildPasswordValidator("password"),

    body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Please provide a valid email address")
        .normalizeEmail()
        .isLength({ max: MAX_EMAIL_LENGTH })
        .withMessage(`Email must be less than ${MAX_EMAIL_LENGTH} characters`),

    body("phone_number")
        .optional()
        .isLength({ max: 20 })
        .withMessage("Phone number must be less than 20 characters")
        .matches(/^[+]?[0-9\s\-()]+$/)
        .withMessage("Please provide a valid phone number"),
];

module.exports = {
    sanitizeInput,
    sanitizeRequestBody,
    loginValidation,
    registerValidation,
};
