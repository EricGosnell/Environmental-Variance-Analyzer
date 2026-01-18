//JWT configuration
//TODO: Add real access and refresh tokens
const JWT_CONFIG = {
    accessTokenSecret:
        process.env.JWT_ACCESS_SECRET || "temp_dev_access_token_@!3%6BB6",
    refreshTokenSecret:
        process.env.JWT_REFRESH_SECRET || "temp_dev_refresh_token_vF54#222",

    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
};

module.exports = { JWT_CONFIG };
