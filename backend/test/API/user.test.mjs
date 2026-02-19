// TODO - Implemet
import request from "supertest";
import { expect } from "chai";

import { makeTestApp, createTestDb } from "../testApp.mjs";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../../util/JWT.js";

/*
    Routes are specified in API_routes.md. Test database and app is created before each test and destroyed after each test. 
*/
describe("User API Tests", function () {
  let db;
  let app;
  let validToken; // To store a valid token for authenticated requests

  beforeEach(async () => {
    db = await createTestDb();
    app = makeTestApp(db);

    // Create a test user and get a valid token
    const res = await request(app).post("/api/auth/register").send({
      username: "TestUser1",
      password: "Password1",
      email: "test@example.com",
    });
    validToken = res.body.accessToken;
  });

  afterEach(async () => {
    if (db) {
      await new Promise((resolve) => db.close(resolve));
    }
  });

  // Tests for GET /api/user/me
  describe("GET api/user/me ", () => {
    it("should return 403 if authentication token is invalid", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer invalidtoken`);
      expect(res.status).to.equal(403);
    });

    it("should return 401 if authentication token is missing", async () => {
      const res = await request(app).get("/api/user/me");
      expect(res.status).to.equal(401);
    });

    it("should return 403 if authentication token is expired", async () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(
        { id: 1, username: "TestUser1" },
        JWT_CONFIG.accessTokenSecret,
        { expiresIn: "1ms" }
      );
      // Wait for the token to expire
      await new Promise((resolve) => setTimeout(resolve, 100));
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(res.status).to.equal(403);
    });

    it("should return 404 if the user is not found", async () => {
      // Create a valid token for a non-existent user
      const nonExistentUserToken = jwt.sign(
        { id: 9999, username: "NonExistentUser" },
        JWT_CONFIG.accessTokenSecret,
        { expiresIn: JWT_CONFIG.accessTokenExpiry });
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${nonExistentUserToken}`);
      expect(res.status).to.equal(404);
    });

    it("should return user details for a valid user", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer ${validToken}`);
      expect(res.status).to.equal(200);

      expect(res.body).to.have.property("username", "TestUser1");
      expect(res.body).to.have.property("email", "test@example.com");
    });
  });

  // Tests for GET /api/user/:id
  describe("GET api/user/:id ", () => {
    it("should return 400 if the user ID is not a valid number", async () => {
      const res = await request(app)
        .get("/api/user/-1")
        .set("Authorization", `Bearer ${validToken}`);
      expect(res.status).to.equal(400);
    });
    // Pass in a valid number but not a valid ID
    it("should return 404 if the user is not found", async () => {
      const res = await request(app)
        .get("/api/user/9999")
        .set("Authorization", `Bearer ${validToken}`);
      expect(res.status).to.equal(404);
    });
  });

  // Tests for PUT /api/user/me/username
  describe("PUT api/user/me/username ", () => {
    it("should return 400 if the new username is too short", async () => {
      const res = await request(app)
        .put("/api/user/me/username")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ username: "ab" }); // Too short
      expect(res.status).to.equal(400);
    });
    it("should return 400 if the new username is too long", async () => {
      const res = await request(app)
        .put("/api/user/me/username")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ username: "a".repeat(31) }); // Too long
      expect(res.status).to.equal(400);
    });
    // It should return 409 if the username is already taken
    it("should return 409 if the new username is already taken", async () => {
      // Create another user with a different username
      await request(app).post("/api/auth/register").send({
        username: "TestUser2",
        password: "Password2",
        email: "test2@example.com",
      });

      // Attempt to change the first user's username to the second user's username
      const res = await request(app)
        .put("/api/user/me/username")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ username: "TestUser2" }); // Username already taken
      expect(res.status).to.equal(409);
    });

    it("should update the username successfully", async () => {
      const res = await request(app)
        .put("/api/user/me/username")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ username: "NewUsername" });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property(
        "message",
        "Username updated successfully",
      );
    });
  });
  // Test request for email change
  describe("POST api/user/me/email/request-change ", () => {
    it("should return 400 if the new email is not valid", async () => {
      const res = await request(app)
        .post("/api/user/me/email/request-change")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "invalidemail" });
      expect(res.status).to.equal(400);
    });

    it("should return 409 if the new email is already taken", async () => {
      // Create another user with a different email
      await request(app).post("/api/auth/register").send({
        username: "TestUser2",
        password: "Password2",
        email: "TestEmail2@email.com",
      });

      // Attempt to request an email change to the second user's email
      const res = await request(app)
        .post("/api/user/me/email/request-change")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "TestEmail2@email.com" });
      expect(res.status).to.equal(409);
    });

    it("should request an email change successfully", async () => {
      const res = await request(app)
        .post("/api/user/me/email/request-change")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "NewEmail@example.com" });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property(
        "message",
        "Email change requested. Please check your email for the confirmation link.",
      );
    });
  });
  // Verify and update email
  describe("PUT api/user/me/email ", () => {
    it("should return 400 if the new email is not valid", async () => {
      const res = await request(app)
        .put("/api/user/me/email")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "invalidemail" }); // Invalid email
      expect(res.status).to.equal(400);
    });

    it("should return 409 if the new email is already taken", async () => {
      // Create another user with a different email
      await request(app).post("/api/auth/register").send({
        username: "TestUser3",
        password: "Password3",
        email: "TestEmail3@email.com",
      });

      // Attempt to change the first user's email to the second user's email
      const res = await request(app)
        .put("/api/user/me/email")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "TestEmail3@email.com" });
      expect(res.status).to.equal(409);
    });

    it("should update the email successfully", async () => {
      const res = await request(app)
        .put("/api/user/me/email")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ email: "NewEmail@example.com" });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property(
        "message",
        "Email updated successfully",
      );
    });
  });
  // Test updating password /me/password
  describe("PUT api/user/me/password ", () => {
    it("should return 400 if the new password is too short", async () => {
      const res = await request(app)
        .put("/api/user/me/password")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ password: "short" }); // Too short
      expect(res.status).to.equal(400);
    });

    it("should update the password successfully", async () => {
      const res = await request(app)
        .put("/api/user/me/password")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ password: "NewPassword1" });
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property(
        "message",
        "Password updated successfully",
      );
    });
  });
});
