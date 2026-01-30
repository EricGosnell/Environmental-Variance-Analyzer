const express = require("express");
const authRoutes = require("../API/auth");
const podRoutes = require("../API/pod");

function makeTestApp(db) {
    const app = express();
    app.use(express.json());

    app.use("/api/auth", authRoutes(db));
    app.use("/api/pods", podRoutes(db));

    return app;
}

module.exports = { makeTestApp };
