const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const authRoutes = require("../API/auth");

function promisifyDb(database) {
  const runOriginal = database.run.bind(database);
  const getOriginal = database.get.bind(database);
  const allOriginal = database.all.bind(database);

  database.run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      runOriginal(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

  database.get = promisify(getOriginal);
  database.all = promisify(allOriginal);

  return database;
}

async function createTestDb() {
  let db = new sqlite3.Database(":memory:");
  db = promisifyDb(db);

  await db.run(`
    CREATE TABLE users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      password_hash TEXT NOT NULL
    );
  `);

  await db.run(`
    CREATE TABLE user_contact (
      contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      phone_number TEXT,
      email TEXT UNIQUE
    );
  `);

  await db.run(`
    CREATE TABLE refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
  `);

  return db;
}

function makeTestApp(db) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes(db));
  return app;
}

module.exports = { createTestDb, makeTestApp };
