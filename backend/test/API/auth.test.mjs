import request from "supertest";
import { expect } from "chai";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { makeTestApp, createTestDb } from "../testApp.mjs";

process.env.EMAIL_DRY_RUN = "1";

describe("Auth API Tests", function () {
  let db;
  let app;
  const genericVerificationMessage = "If the email exists, a verification code was sent.";

  const hashCode = (code) => crypto.createHash("sha256").update(code).digest("hex");

  const createUser = async ({
    username,
    email,
    password = "Password1",
    verified = true,
  }) => {
    const hash = await bcrypt.hash(password, 12);
    const userInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin, verified_email, account_locked) VALUES (?, ?, ?, ?, ?)",
      [username, hash, 0, verified ? 1 : 0, 0]
    );

    const userId = userInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [userId, username, email]
    );

    return userId;
  };

  const createVerificationRow = async ({
    userId,
    code,
    now,
    attempts = 0,
    sendCount = 1,
    lastSentAt = now,
    windowStartedAt = now,
  }) => {
    await db.run(`
      INSERT INTO email_verification (
        user_id,
        code_hash,
        expires_at,
        attempts,
        send_count,
        last_sent_at,
        window_started_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        attempts = excluded.attempts,
        send_count = excluded.send_count,
        last_sent_at = excluded.last_sent_at,
        window_started_at = excluded.window_started_at
    `, [userId, hashCode(code), now + 600, attempts, sendCount, lastSentAt, windowStartedAt]);
  };

  beforeEach(async () => {
    db = await createTestDb();
    app = makeTestApp(db);
  });

  afterEach(async () => {
    if (db) {
      await new Promise((resolve) => db.close(resolve));
    }
  });

  describe("POST /api/auth/register", () => {
    it("should register a user successfully", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "TestUser1",
        password: "Password1",
        email: "test@example.com",
      });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("user");
      expect(res.body).to.have.property("accessToken");
      expect(res.body).to.have.property("refreshToken");
      expect(res.body.user.username).to.equal("TestUser1");
      expect(res.body.user.email).to.equal("test@example.com");
    });

    it("should reject duplicate usernames (409)", async () => {
      const hash = await bcrypt.hash("Password1", 12);
      const userInsert = await db.run(
        "INSERT INTO users (username, password_hash) VALUES (?,?)",
        ["TestUser1", hash]
      );

      const userId = userInsert.lastID;

      await db.run(
        "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
        [userId, "Test User", "test@example.com"]
      );

      const res = await request(app).post("/api/auth/register").send({
        username: "TestUser1",
        password: "Password1",
      });

      expect(res.status).to.equal(409);
      expect(res.body).to.have.property("error");
    });

    it("should fail validation for short username (400)", async () => {
      const res = await request(app).post("/api/auth/register").send({
        username: "abc",
        password: "Password1",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Validation failed");
      expect(res.body).to.have.property("details");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with correct password", async () => {

      // ---- create user ----
      const hash = await bcrypt.hash("Password1", 12);

      const userInsert = await db.run(
        "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
        ["TestUser1", hash, 0]
      );

      const userId = userInsert.lastID;

      await db.run(
        "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
        [userId, "Test User", "test@example.com"]
      );

      // ---- attempt login ----
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "test@example.com",
          password: "Password1",
        });

      // ---- assertions ----
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("accessToken");
      expect(res.body).to.have.property("refreshToken");
      expect(res.body).to.have.property("user");
      expect(res.body.user.username).to.equal("TestUser1");
    });


    it("should reject login with wrong password (401)", async () => {
      const hash = await bcrypt.hash("Password1", 12);

      await db.run("INSERT INTO users (username, password_hash) VALUES (?,?)", [
        "TestUser1",
        hash,
      ]);

      const res = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "WrongPassword1",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid credentials");
    });

    it("should reject login for unknown user (401)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nouser@example.com",
        password: "Password1",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid credentials");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens successfully (200)", async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        username: "TestUser1",
        password: "Password1",
        email: "test@example.com",
      });

      expect(registerRes.status).to.equal(201);
      expect(registerRes.body).to.have.property("refreshToken");

      const oldRefreshToken = registerRes.body.refreshToken;

      const refreshRes = await request(app).post("/api/auth/refresh").send({
        refreshToken: oldRefreshToken,
      });

      expect(refreshRes.status).to.equal(200);
      expect(refreshRes.body).to.have.property("accessToken");
      expect(refreshRes.body).to.have.property("refreshToken");
    });

    it("should reject missing refreshToken (400)", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Refresh token is required");
    });

    it("should reject invalid refresh token (401)", async () => {
      const res = await request(app).post("/api/auth/refresh").send({
        refreshToken: "this.is.not.a.real.token",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid or expired refresh token");
    });

    it("should reject refresh token not found in DB (401)", async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        username: "TestUser2",
        password: "Password1",
        email: "test2@example.com",
      });

      expect(registerRes.status).to.equal(201);
      const refreshToken = registerRes.body.refreshToken;

      await db.run("DELETE FROM refresh_tokens WHERE token = ?", [refreshToken]);

      const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid or expired refresh token");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully (200) and remove refresh token", async () => {
      const registerRes = await request(app).post("/api/auth/register").send({
        username: "TestUser3",
        password: "Password1",
        email: "test3@example.com",
      });

      expect(registerRes.status).to.equal(201);
      const refreshToken = registerRes.body.refreshToken;

      const logoutRes = await request(app).post("/api/auth/logout").send({
        refreshToken,
      });

      expect(logoutRes.status).to.equal(200);
      expect(logoutRes.body.message).to.equal("Logged out successfully");

      const tokenRecord = await db.get(
        "SELECT * FROM refresh_tokens WHERE token = ?",
        [refreshToken]
      );

      expect(tokenRecord).to.equal(undefined);
    });

    it("should reject missing refreshToken (400)", async () => {
      const res = await request(app).post("/api/auth/logout").send({});

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Refresh token is required");
    });

    it("should reject invalid refresh token (401)", async () => {
      const res = await request(app).post("/api/auth/logout").send({
        refreshToken: "this.is.not.a.real.token",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid refresh token");
    });
  });

  describe("Email verification endpoints", () => {
    it("should send a verification email and return generic response (existing user)", async () => {
      const userId = await createUser({
        username: "verifyuser",
        email: "verify@example.com",
      });

      const res = await request(app).put("/api/auth/send-verification").send({
        email: "verify@example.com",
      });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal(genericVerificationMessage);

      const row = await db.get(
        "SELECT * FROM email_verification WHERE user_id = ?",
        [userId]
      );
      expect(row).to.exist;
      expect(row.expires_at).to.be.greaterThan(0);
      expect(row.send_count).to.equal(1);
    });

    it("should send-verification with generic response for unknown email", async () => {
      const res = await request(app).put("/api/auth/send-verification").send({
        email: "missing@example.com",
      });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal(genericVerificationMessage);
    });

    it("should match email case-insensitively for send-verification", async () => {
      const now = Math.floor(Date.now() / 1000);
      const userId = await createUser({
        username: "CaseUser",
        email: "mixed@example.com",
      });

      await createVerificationRow({
        userId,
        code: "111111",
        now: now - 61,
        sendCount: 1,
        lastSentAt: now - 61,
        windowStartedAt: now - 61,
      });

      const res = await request(app).put("/api/auth/send-verification").send({
        email: "MIXED@Example.com",
      });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal(genericVerificationMessage);

      const row = await db.get(
        "SELECT send_count FROM email_verification WHERE user_id = ?",
        [userId]
      );
      expect(row.send_count).to.equal(2);
    });

    it("should verify email successfully with valid code", async () => {
      const userId = await createUser({
        username: "VerifyUser",
        email: "verify2@example.com",
        verified: false,
      });

      const now = Math.floor(Date.now() / 1000);
      await createVerificationRow({
        userId,
        code: "123456",
        now,
      });

      const res = await request(app).post("/api/auth/verify-email").send({
        email: "Verify2@Example.com",
        code: "123456",
      });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal("Email verified");

      const userRow = await db.get(
        "SELECT verified_email FROM users WHERE user_id = ?",
        [userId]
      );
      const verificationRow = await db.get(
        "SELECT * FROM email_verification WHERE user_id = ?",
        [userId]
      );

      expect(userRow.verified_email).to.equal(1);
      expect(verificationRow).to.equal(undefined);
    });

    it("should reject invalid verification code and increment attempts", async () => {
      const userId = await createUser({
        username: "InvalidCodeUser",
        email: "invalidcode@example.com",
      });

      const now = Math.floor(Date.now() / 1000);
      await createVerificationRow({
        userId,
        code: "246810",
        now,
      });

      const res = await request(app).post("/api/auth/verify-email").send({
        email: "invalidcode@example.com",
        code: "000000",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Invalid code");

      const row = await db.get(
        "SELECT attempts FROM email_verification WHERE user_id = ?",
        [userId]
      );
      expect(row.attempts).to.equal(1);
    });

    it("should reject verification after too many attempts", async () => {
      const userId = await createUser({
        username: "AttemptsUser",
        email: "attempts@example.com",
      });

      const now = Math.floor(Date.now() / 1000);
      await createVerificationRow({
        userId,
        code: "135790",
        now,
        attempts: 5,
        sendCount: 1,
      });

      const res = await request(app).post("/api/auth/verify-email").send({
        email: "attempts@example.com",
        code: "135790",
      });

      expect(res.status).to.equal(429);
      expect(res.body.error).to.equal("Too many attempts");
    });

    it("should reject expired verification codes", async () => {
      const userId = await createUser({
        username: "ExpiredUser",
        email: "expired@example.com",
      });

      const now = Math.floor(Date.now() / 1000);
      await createVerificationRow({
        userId,
        code: "555555",
        now: now - 601,
      });

      const res = await request(app).post("/api/auth/verify-email").send({
        email: "expired@example.com",
        code: "555555",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Code expired");
    });

    it("should enforce minimum resend interval", async () => {
      await createUser({
        username: "ResendUser",
        email: "resend@example.com",
      });

      const firstRes = await request(app).put("/api/auth/send-verification").send({
        email: "resend@example.com",
      });
      expect(firstRes.status).to.equal(200);
      expect(firstRes.body.message).to.equal(genericVerificationMessage);

      const secondRes = await request(app).put("/api/auth/send-verification").send({
        email: "resend@example.com",
      });

      expect(secondRes.status).to.equal(429);
      expect(secondRes.body.error).to.equal("Please wait before requesting another verification code.");
    });

    it("should enforce max sends per 15-minute window", async () => {
      const userId = await createUser({
        username: "WindowUser",
        email: "window@example.com",
      });

      const now = Math.floor(Date.now() / 1000);
      await createVerificationRow({
        userId,
        code: "999999",
        now: now - 61,
        sendCount: 5,
        lastSentAt: now - 61,
        windowStartedAt: now - 120,
      });

      const res = await request(app).put("/api/auth/send-verification").send({
        email: "window@example.com",
      });

      expect(res.status).to.equal(429);
      expect(res.body.error).to.equal("Too many verification codes sent. Try again later.");
    });
  });
});
