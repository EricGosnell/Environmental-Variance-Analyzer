const express = require("express");
const path = require("path");
require("dotenv").config();
const cors = require("cors");

const { createDB } = require("./database/databaseInit");
const authRoutes = require("./API/auth");
const userRoutes = require("./API/user");
const podRoutes = require("./API/pod")

const app = express();
const PORT = process.env.PORT || 3000;

// ====== middleware ======
app.use(express.static(path.join(__dirname, "Pages")));
app.use(express.json());
if (process.env.NODE_ENV === "development") {
  app.use(cors({ origin: "http://localhost:5173" }));
}

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Routes
app.get("/", (req, res) => {
  res.send("EVA server running");
});

// ====== database + api mount ======
let db;
createDB()
  .then((database) => {
    db = database;

    app.use("/api/auth", authRoutes(db));
    app.use("/api/users", userRoutes(db));
    app.use("/api/pods", podRoutes(db));

    setInterval(() => {
      (async () => {
        try {
          const now = Math.floor(Date.now() / 1000);
          await db.run(`DELETE FROM email_verification WHERE expires_at < ?`, [now]);
          await db.run(`DELETE FROM password_reset WHERE expires_at < ?`, [now]);
          await db.run(`DELETE FROM pending_email_changes WHERE expires_at < ?`, [now]);
          await db.run(`DELETE FROM refresh_tokens WHERE expires_at < ?`, [now]);
        } catch (err) {
          console.error("Cleanup interval failed:", err);
        }
      })();
    }, 15 * 60 * 1000); //every 15 minute to delete expired tokens and email verifications

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });

process.on("SIGINT", () => {
  if (!db) process.exit(0);

  db.close((err) => {
    if (err) console.error("Error closing database:", err);
    else console.log("Database connection closed");
    process.exit(0);
  });
});
