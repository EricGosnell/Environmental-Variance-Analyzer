const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const fs = require("fs");
const { loadTestData } = require("../test/testDataLoader");

// Helper function to promisify db methods
const promisifyDb = (database) => {
  const originalRun = database.run.bind(database);

  database.run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      originalRun(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });

  database.get = promisify(database.get.bind(database));
  database.all = promisify(database.all.bind(database));

  return database;
};

// Initialize database from schema file if needed
const initializeDatabase = async (db, dbFilePath, schemaFilePath) => {
  let needsInitialization = false;

  try {
    if (fs.existsSync(dbFilePath)) {
      try {
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(dbFilePath, "r");
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const header = buffer.toString("utf8", 0, 13);
        if (header !== "SQLite format") {
          console.log("Database corrupted, recreating...");
          needsInitialization = true;
        } else {
          await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
          );
          console.log("Database exists — ensuring schema is up to date...");
        }
      } catch {
        needsInitialization = true;
      }
    } else {
      needsInitialization = true;
    }

    let workingDb = db;

    if (needsInitialization) {
      await new Promise((resolve, reject) =>
        db.close(err => (err ? reject(err) : resolve()))
      );

      if (fs.existsSync(dbFilePath)) fs.unlinkSync(dbFilePath);

      workingDb = promisifyDb(new sqlite3.Database(dbFilePath));
      console.log("Created fresh database");
    }

    const schema = fs.readFileSync(schemaFilePath, "utf-8");

    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await workingDb.run(statement);
    }

    console.log("Schema ensured successfully");
    return workingDb;

  } catch (error) {
    console.error("DB init error:", error);
    throw error;
  }
};

// Verify schema exists
const verifyDatabase = async (db) => {
  const usersTable = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  );
  const emailVerificationTable = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification'"
  );

  if (!usersTable) {
    throw new Error("Users table not found in database");
  }
  if (!emailVerificationTable) {
    throw new Error("email_verification table not found in database");
  }

  console.log("Database schema verified successfully");
};

const createDB = async () => {
  const dbFilePath = path.join(__dirname, "db.sqlite");
  const schemaFilePath = path.join(__dirname, "db.sql");

  if (process.env.NODE_ENV === "development") {
    if (fs.existsSync(dbFilePath)) {
      fs.unlinkSync(dbFilePath);
      console.log("Dev mode: wiped database for fresh seed");
    }
  }

  let db = new sqlite3.Database(dbFilePath);
  db = promisifyDb(db);

  db = await initializeDatabase(db, dbFilePath, schemaFilePath);
  await verifyDatabase(db);

  console.log("Seeding development data...");
  await loadTestData(db);

  return db;
};

module.exports = { createDB };
