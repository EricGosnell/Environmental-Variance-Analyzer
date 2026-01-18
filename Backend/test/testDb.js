const express = require("express");
const authRoutes = require("../API/auth");

function makeTestApp(db) {
    const app = express();
    app.use(express.json());

    // mount only what you're testing
    app.use("/api/auth", authRoutes(db));

    return app;
}

module.exports = { makeTestApp };
