const express = require("express");
const authRoutes = require("../API/auth");
const podRoutes = require("../API/pod");
const userRoutes = require("../API/user");

function makeTestApp(db) {
    const app = express();
    app.use(express.json());

    app.use("/api/auth", authRoutes(db));
    app.use("/api/pods", podRoutes(db));
    app.use("/api/user", userRoutes(db));

    return app;
}

module.exports = { makeTestApp };
