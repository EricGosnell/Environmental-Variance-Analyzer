import request from "supertest";
import { expect } from "chai";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

import { makeTestApp, createTestDb } from "../testApp.mjs";

function hashCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

describe("Auth Password Reset API Tests", function () {
  let db;
  let app;
  let userSequence = 0;
  const originalEmailDryRun = process.env.EMAIL_DRY_RUN;

  async function createUserWithEmail(email, password = "Password1") {
    userSequence += 1;
    const username = `ResetUser${userSequence}`;
    const hash = await bcrypt.hash(password, 12);
    const userInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      [username, hash, 0]
    );
    const userId = userInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [userId, username, email]
    );

    return { userId, username };
  }

  beforeEach(async () => {
    process.env.EMAIL_DRY_RUN = "1";
    db = await createTestDb();
    app = makeTestApp(db);

    await db.run(`
      CREATE TABLE password_reset (
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
    if (originalEmailDryRun === undefined) {
      delete process.env.EMAIL_DRY_RUN;
    } else {
      process.env.EMAIL_DRY_RUN = originalEmailDryRun;
    }
    if (db) {
      await new Promise((resolve) => db.close(resolve));
    }
  });

  it("POST /api/auth/forgot-password returns 200 and stores hashed reset row for existing email", async () => {
    const { userId } = await createUserWithEmail("existing@example.com");

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "existing@example.com" });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("If the email exists, a password reset code was sent.");

    const row = await db.get("SELECT * FROM password_reset WHERE user_id = ?", [userId]);
    expect(row).to.not.equal(undefined);
    expect(row.code_hash).to.be.a("string");
    expect(row.code_hash).to.have.length(64);
  });

  it("POST /api/auth/forgot-password returns 200 and does not leak for unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "missing@example.com" });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("If the email exists, a password reset code was sent.");

    const count = await db.get("SELECT COUNT(*) AS c FROM password_reset");
    expect(count.c).to.equal(0);
  });

  it("POST /api/auth/reset-password increments attempts on wrong token", async () => {
    const { userId } = await createUserWithEmail("wrong-token@example.com");
    const now = Math.floor(Date.now() / 1000);

    await db.run(
      `INSERT INTO password_reset (user_id, code_hash, expires_at, attempts, send_count, last_sent_at, window_started_at)
       VALUES (?, ?, ?, 0, 1, ?, ?)`,
      [userId, hashCode("123456"), now + 600, now, now]
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "wrong-token@example.com",
        token: "654321",
        newPassword: "NewPassword1",
      });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal("Invalid or expired reset token");

    const row = await db.get("SELECT attempts FROM password_reset WHERE user_id = ?", [userId]);
    expect(row.attempts).to.equal(1);
  });

  it("POST /api/auth/reset-password fails for expired token", async () => {
    const { userId } = await createUserWithEmail("expired@example.com");
    const now = Math.floor(Date.now() / 1000);

    await db.run(
      `INSERT INTO password_reset (user_id, code_hash, expires_at, attempts, send_count, last_sent_at, window_started_at)
       VALUES (?, ?, ?, 0, 1, ?, ?)`,
      [userId, hashCode("123456"), now - 1, now, now]
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "expired@example.com",
        token: "123456",
        newPassword: "NewPassword1",
      });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal("Invalid or expired reset token");
  });

  it("POST /api/auth/reset-password succeeds, updates password, removes reset row, and invalidates refresh tokens", async () => {
    const { userId } = await createUserWithEmail("success@example.com", "Password1");
    const now = Math.floor(Date.now() / 1000);

    await db.run(
      `INSERT INTO password_reset (user_id, code_hash, expires_at, attempts, send_count, last_sent_at, window_started_at)
       VALUES (?, ?, ?, 0, 1, ?, ?)`,
      [userId, hashCode("123456"), now + 600, now, now]
    );

    await db.run(
      "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      ["refresh-token-1", userId, now + 3600]
    );
    await db.run(
      "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      ["refresh-token-2", userId, now + 3600]
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "success@example.com",
        token: "123456",
        newPassword: "NewPassword1",
      });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("Password reset successfully");

    const user = await db.get("SELECT password_hash FROM users WHERE user_id = ?", [userId]);
    expect(await bcrypt.compare("NewPassword1", user.password_hash)).to.equal(true);
    expect(await bcrypt.compare("Password1", user.password_hash)).to.equal(false);

    const resetRow = await db.get("SELECT * FROM password_reset WHERE user_id = ?", [userId]);
    expect(resetRow).to.equal(undefined);

    const tokenCount = await db.get("SELECT COUNT(*) AS c FROM refresh_tokens WHERE user_id = ?", [userId]);
    expect(tokenCount.c).to.equal(0);
  });

  it("POST /api/auth/reset-password rejects token reuse after successful reset", async () => {
    const { userId } = await createUserWithEmail("reuse@example.com");
    const now = Math.floor(Date.now() / 1000);

    await db.run(
      `INSERT INTO password_reset (user_id, code_hash, expires_at, attempts, send_count, last_sent_at, window_started_at)
       VALUES (?, ?, ?, 0, 1, ?, ?)`,
      [userId, hashCode("123456"), now + 600, now, now]
    );

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "reuse@example.com",
        token: "123456",
        newPassword: "NewPassword1",
      });
    expect(first.status).to.equal(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({
        email: "reuse@example.com",
        token: "123456",
        newPassword: "AnotherPass1",
      });

    expect(second.status).to.equal(400);
    expect(second.body.error).to.equal("Invalid or expired reset token");
  });
});
