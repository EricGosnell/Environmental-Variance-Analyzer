const jwt = require("jsonwebtoken");
const { JWT_CONFIG } = require("./JWT");

const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.user_id ?? user.id,
            email: user.email ?? null,
            username: user.username ?? null,
        },
        JWT_CONFIG.accessTokenSecret,
        { expiresIn: JWT_CONFIG.accessTokenExpiry }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.user_id ?? user.id },
        JWT_CONFIG.refreshTokenSecret,
        { expiresIn: JWT_CONFIG.refreshTokenExpirySeconds }
    );
};

const getRefreshTokenExpiry = () => {
    return Math.floor(Date.now() / 1000) + JWT_CONFIG.refreshTokenExpirySeconds;
};

// middleware to protect routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) { return res.status(401).json({ error: "Access token required" }); }

    jwt.verify(token, JWT_CONFIG.accessTokenSecret, (err, user) => {
        if (err) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });

};

// Allows anonymous access (req.user undefined) 
// // If a valid Bearer token is provided, sets req.user
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return next();

    jwt.verify(token, JWT_CONFIG.accessTokenSecret, (err, user) => {
        if (!err) req.user = user;
        return next();
    });
};



module.exports = {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiry,
    authenticateToken,
    optionalAuth,
};
