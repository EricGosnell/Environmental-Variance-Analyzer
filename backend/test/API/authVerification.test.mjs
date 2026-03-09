import request from "supertest";
import { expect } from "chai";

import { makeTestApp, createTestDb } from "../testApp.mjs";

describe("Auth Email Verification API Tests", function () {
  let db;
  let app;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeTestApp(db);

    await db.run(`
      CREATE TABLE email_verification (
        user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        send_count INTEGER NOT NULL DEFAULT 0,
        last_sent_at INTEGER NOT NULL DEFAULT 0,
        window_started_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
    `);
  });

  afterEach(async () => {
    if (db) {
      await new Promise((resolve) => db.close(resolve));
    }
  });

  it("POST /api/auth/send-verification returns generic success for unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "missing@example.com" });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("If the email exists, a verification code was sent.");
  });

  it("PUT /api/auth/send-verification is not allowed after method change", async () => {
    const res = await request(app)
      .put("/api/auth/send-verification")
      .send({ email: "missing@example.com" });

    expect(res.status).to.equal(404);
  });

  it("POST /api/auth/verify-email rejects non-numeric 6-char code", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "user@example.com", code: "ABCDEF" });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal("Validation failed");
    expect(res.body.details.some((detail) => detail.message === "6 digit code required")).to.equal(true);
  });

  it("POST /api/auth/verify-email returns 429 when max attempts reached", async () => {
    const userInsert = await db.run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      ["AttemptedUser", "hash"]
    );
    const userId = userInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [userId, "AttemptedUser", "attempts@example.com"]
    );

    const now = Math.floor(Date.now() / 1000);
    await db.run(
      `
      INSERT INTO email_verification (
        user_id,
        code_hash,
        expires_at,
        attempts,
        send_count,
        last_sent_at,
        window_started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [userId, "irrelevant", now + 600, 5, 1, now, now]
    );

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "attempts@example.com", code: "123456" });

    expect(res.status).to.equal(429);
    expect(res.body.error).to.equal("Too many attempts");
  });
});
