const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { promisify } = require("util");
const fs = require("fs");
const bcrypt = require("bcryptjs");

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
    // Check if database file exists and is valid
    if (fs.existsSync(dbFilePath)) {
      try {
        // Try to read the file header to verify it's a valid SQLite database
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(dbFilePath, "r");
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        // SQLite database files start with "SQLite format 3\0"
        const header = buffer.toString("utf8", 0, 13);
        if (header !== "SQLite format") {
          console.log(
            "Database file is corrupted (invalid header), will recreate it..."
          );
          needsInitialization = true;
        } else {
          // Try to query to make sure db is accessible
          await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1"
          );
          console.log("Database already initialized and valid");
          return db;
        }
      } catch (error) {
        console.log(
          "Database file is corrupted or inaccessible, will recreate it..."
        );
        needsInitialization = true;
      }
    } else {
      console.log("Database file does not exist, will create it...");
      needsInitialization = true;
    }

    if (needsInitialization) {
      // Close existing connection
      await new Promise((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });

      // Delete corrupted file if it exists
      if (fs.existsSync(dbFilePath)) {
        fs.unlinkSync(dbFilePath);
        console.log("Removed corrupted database file");
      }

      // Create new database instance
      let newDb = new sqlite3.Database(dbFilePath);
      newDb = promisifyDb(newDb);

      // Read and execute schema
      console.log("Initializing database from schema...");
      const schema = fs.readFileSync(schemaFilePath, "utf-8");

      // Split into statements & run them
      const statements = schema
        .split(";")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const statement of statements) {
        await newDb.run(statement);
      }

      console.log("Database initialized successfully");
      return newDb;
    }

    return db;
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};

// Verify schema exists
const verifyDatabase = async (db) => {
  const usersTable = await db.get(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  );

  if (!usersTable) {
    throw new Error("Users table not found in database");
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


const loadTestData = async (db) => {

  const peoplePath = path.join(__dirname, "../test/testDataPeople.json");
  const podDataPath = path.join(__dirname, "../test/testDataPodData.json");

  if (!fs.existsSync(peoplePath)) {
    console.log("No people seed data — skipping");
    return;
  }

  const peopleRaw = JSON.parse(fs.readFileSync(peoplePath));

  const podRaw = fs.existsSync(podDataPath)
    ? JSON.parse(fs.readFileSync(podDataPath))
    : { pod_data: [] };

  await db.run("BEGIN TRANSACTION");

  // ===========================
  // SEED USERS + PODS
  // ===========================

  for (const person of peopleRaw.people) {

    let userId;

    const existingUser = await db.get(
      "SELECT user_id FROM users WHERE username = ?",
      [person.email]
    );

    if (existingUser) {
      userId = existingUser.user_id;
    } else {

      const hashedPassword = await bcrypt.hash(person.password, 12);
      const count = await db.get("SELECT COUNT(*) as c FROM users");
      const isFirstUser = count.c === 0;

      const user = await db.run(
        `INSERT INTO users (username, password_hash, admin)
         VALUES (?, ?, ?)`,
        [person.email, hashedPassword, isFirstUser ? 1 : 0]
      );

      userId = user.lastID;
    }

    await db.run(
      `INSERT OR IGNORE INTO user_contact
       (user_id, user_name, phone_number, email)
       VALUES (?, ?, ?, ?)`,
      [userId, person.first + " " + person.last, person.phone, person.email]
    );

    for (const pod of person.pods) {

      // avoid duplicate pod rows if two users reference same pod (future safe)
      let podRow = await db.get(
        "SELECT pod_id FROM pod WHERE pod_name = ?",
        [pod.name]
      );

      let podId;

      if (podRow) {
        podId = podRow.pod_id;
      } else {
        const podRes = await db.run(
          `INSERT INTO pod (pod_name, pod_data_public)
           VALUES (?, ?)`,
          [pod.name, pod.visibility]
        );
        podId = podRes.lastID;
      }

      await db.run(
        `INSERT OR IGNORE INTO user_pod (user_id, pod_id)
         VALUES (?, ?)`,
        [userId, podId]
      );

      await db.run(
        `INSERT INTO pod_data (pod_id, longitude, latitude)
         VALUES (?, ?, ?)`,
        [podId, pod.long, pod.lat]
      );
    }
  }

  // ===========================
  // SEED SENSOR TELEMETRY
  // ===========================

  for (const entry of podRaw.pod_data) {

    const podRow = await db.get(
      "SELECT pod_id FROM pod WHERE pod_name = ?",
      [entry.pod_name]
    );

    if (!podRow) {
      console.warn("Skipping telemetry for unknown pod:", entry.pod_name);
      continue;
    }

    const podId = podRow.pod_id;

    // get existing pod location row
    const podDataRow = await db.get(
      `SELECT pod_data_id FROM pod_data
   WHERE pod_id = ?
   ORDER BY pod_data_id LIMIT 1`,
      [podId]
    );

    if (!podDataRow) {
      console.warn("No pod_data location for pod:", entry.pod_name);
      continue;
    }

    const podDataId = podDataRow.pod_data_id;


    for (const r of entry.readings) {

      await db.run(
        `INSERT INTO sensor_data
         (pod_data_id, sensor_type, reading_value, reading_units, raw_data)
         VALUES (?, ?, ?, ?, ?)`,
        [
          podDataId,
          r.metric,
          r.value,
          r.unit,
          JSON.stringify(r)
        ]
      );
    }
  }

  await db.run("COMMIT");

  console.log("People + pod telemetry seeded successfully");
};




module.exports = { createDB };
