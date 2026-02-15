// test/testApp.mjs
import express from "express";
import sqlite3 from "sqlite3";
import { promisify } from "util";

import authRoutes from "../API/auth.js";
import podRoutes from "../API/pod.js";
import userRoutes from "../API/user.js";

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

export async function createTestDb() {
  let db = new (sqlite3.verbose()).Database(":memory:");
  db = promisifyDb(db);

  // ----- USERS (with admin BOOL) -----
  await db.run(`
    CREATE TABLE users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      password_hash TEXT NOT NULL,
      admin BOOLEAN DEFAULT FALSE
    );
  `);

  // ----- USER CONTACT -----
  await db.run(`
    CREATE TABLE user_contact (
      contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      user_name TEXT NOT NULL,
      phone_number TEXT,
      email TEXT UNIQUE
    );
  `);

  // ----- REFRESH TOKENS (match your real db.sql) -----
  await db.run(`
    CREATE TABLE refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

  // ----- PENDING EMAIL CHANGES -----
  await db.run(`
    CREATE TABLE pending_email_changes (
      user_id INTEGER PRIMARY KEY UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      new_email TEXT NOT NULL,
      verification_code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  // ----- POD -----
  await db.run(`
    CREATE TABLE pod (
      pod_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pod_name TEXT,
      description TEXT,
      pod_data_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----- USER_POD -----
  await db.run(`
    CREATE TABLE user_pod (
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      pod_id INTEGER NOT NULL REFERENCES pod(pod_id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, pod_id)
    );
  `);

  // ----- POD_DATA -----
  await db.run(`
    CREATE TABLE pod_data (
      pod_data_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pod_id INTEGER NOT NULL REFERENCES pod(pod_id) ON DELETE CASCADE,
      date_collected DATE NOT NULL DEFAULT CURRENT_DATE,
      longitude REAL NOT NULL,
      latitude REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----- SENSOR_DATA -----
  await db.run(`
    CREATE TABLE sensor_data (
      sensor_data_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pod_data_id INTEGER NOT NULL REFERENCES pod_data(pod_data_id) ON DELETE CASCADE,
      sensor_type TEXT NOT NULL,
      reading_value REAL,
      reading_units TEXT,
      reading_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export function makeTestApp(db) {
  const app = express();
  app.use(express.json());

  // mount what you're testing
  app.use("/api/auth", authRoutes(db));
  app.use("/api/pods", podRoutes(db));
  app.use("/api/user", userRoutes(db));

  return app;
}

