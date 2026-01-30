import request from "supertest";
import { expect } from "chai";
import bcrypt from "bcryptjs";

import { makeTestApp, createTestDb } from "../testApp.mjs";

describe("Auth API Tests", function () {
  let db;
  let app;

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
      await db.run("INSERT INTO users (username, password_hash) VALUES (?,?)", [
        "TestUser1",
        hash,
      ]);

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
      const hash = await bcrypt.hash("Password1", 12);

      await db.run("INSERT INTO users (username, password_hash) VALUES (?,?)", [
        "TestUser1",
        hash,
      ]);

      const res = await request(app).post("/api/auth/login").send({
        username: "TestUser1",
        password: "Password1",
      });

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
        username: "TestUser1",
        password: "WrongPassword1",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("Invalid credentials");
    });

    it("should reject login for unknown user (401)", async () => {
      const res = await request(app).post("/api/auth/login").send({
        username: "NoUser",
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
});

