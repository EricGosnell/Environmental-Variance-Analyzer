// TODO - Implemet
import request from "supertest";
import { expect } from "chai";
import bcrypt from "bcryptjs";

import { makeTestApp, createTestDb } from "../testApp.mjs";

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
    it("should return 404 if the user is not found", async () => {
      const res = await request(app)
        .get("/api/user/me")
        .set("Authorization", `Bearer invalidtoken`);
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
});
