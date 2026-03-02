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

const REQUIRED_COLUMNS = {
  users: ["verified_email", "account_locked"],
  email_verification: [
    "code_hash",
    "expires_at",
    "attempts",
    "send_count",
    "last_sent_at",
    "window_started_at",
  ],
};

const getColumns = async (db, tableName) => {
  const rows = await db.all(`PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
};

const ensureColumnExists = async (db, tableName, columnName, definition) => {
  const columns = await getColumns(db, tableName);
  if (columns.includes(columnName)) return;

  await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
};

const migrateUsersTable = async (db) => {
  await ensureColumnExists(db, "users", "verified_email", "BOOLEAN DEFAULT FALSE");
  await ensureColumnExists(db, "users", "account_locked", "BOOLEAN DEFAULT FALSE");

  const migratedColumns = await getColumns(db, "users");
  if (migratedColumns.includes("verifiedEmail")) {
    await db.run(`
      UPDATE users
      SET verified_email = COALESCE(verifiedEmail, 0)
    `);
  }

  if (migratedColumns.includes("accountLocked")) {
    await db.run(`
      UPDATE users
      SET account_locked = COALESCE(accountLocked, 0)
    `);
  }
};

const migrateEmailVerificationTable = async (db) => {
  const tableExists = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification'"
  );
  if (!tableExists) return;

  await ensureColumnExists(db, "email_verification", "attempts", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumnExists(db, "email_verification", "send_count", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumnExists(db, "email_verification", "last_sent_at", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumnExists(db, "email_verification", "window_started_at", "INTEGER NOT NULL DEFAULT 0");

  await db.run(`
    UPDATE email_verification
    SET send_count = COALESCE(send_count, 0),
        attempts = COALESCE(attempts, 0),
        last_sent_at = COALESCE(NULLIF(last_sent_at, 0), created_at),
        window_started_at = COALESCE(NULLIF(window_started_at, 0), created_at)
  `);
};

const runMigrations = async (db) => {
  await migrateUsersTable(db);
  await migrateEmailVerificationTable(db);
};

const assertRequiredColumnsExist = async (db, tableName, requiredColumns) => {
  const columns = await getColumns(db, tableName);
  const missing = requiredColumns.filter((column) => !columns.includes(column));

  if (missing.length > 0) {
    throw new Error(`Table "${tableName}" missing columns: ${missing.join(", ")}`);
  }
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

    await runMigrations(workingDb);

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

  await assertRequiredColumnsExist(db, "users", REQUIRED_COLUMNS.users);
  await assertRequiredColumnsExist(db, "email_verification", REQUIRED_COLUMNS.email_verification);

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
