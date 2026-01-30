import request from "supertest";
import { expect } from "chai";
import bcrypt from "bcryptjs";

import { makeTestApp, createTestDb } from "../testApp.mjs";

describe("Pod API Tests", function () {
  let db;
  let app;

  let accessTokenUser;
  let accessTokenAdmin;
  let userId;
  let adminId;

  beforeEach(async () => {
    db = await createTestDb();
    app = makeTestApp(db);

    // create a normal user
    const userHash = await bcrypt.hash("Password1", 12);
    const userInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      ["TestUser1", userHash, 0]
    );
    userId = userInsert.lastID;

    // create an admin user
    const adminHash = await bcrypt.hash("Password1", 12);
    const adminInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      ["AdminUser", adminHash, 1]
    );
    adminId = adminInsert.lastID;

    // login normal user
    const loginUserRes = await request(app).post("/api/auth/login").send({
      username: "TestUser1",
      password: "Password1",
    });
    accessTokenUser = loginUserRes.body.accessToken;

    // login admin user
    const loginAdminRes = await request(app).post("/api/auth/login").send({
      username: "AdminUser",
      password: "Password1",
    });
    accessTokenAdmin = loginAdminRes.body.accessToken;
  });

  afterEach(async () => {
    if (db) {
      await new Promise((resolve) => db.close(resolve));
    }
  });

  // -------------------------
  // GET /api/pods/locations
  // -------------------------
  describe("GET /api/pods/locations", () => {
    it("should return only public pods when anonymous", async () => {
      // create pods: 1 public, 1 private
      const pubPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );
      const privPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PrivatePod", 0]
      );

      // give them pod_data
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [pubPod.lastID, 40.0, -74.0]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [privPod.lastID, 40.0, -74.0]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .query({ latitude: 40.0, longitude: -74.0, radius: 5000 });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("pods");

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.not.include("PrivatePod");
    });

    it("should return public pods + owned pods when authenticated", async () => {
      const pubPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );
      const privateOwnedPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PrivateOwnedPod", 0]
      );

      // normal user owns private pod
      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        privateOwnedPod.lastID,
      ]);

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [pubPod.lastID, 40.0, -74.0]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [privateOwnedPod.lastID, 40.0, -74.0]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .query({ latitude: 40.0, longitude: -74.0, radius: 5000 });

      expect(res.status).to.equal(200);

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.include("PrivateOwnedPod");
    });

    it("should return all pods when admin", async () => {
      const pubPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );
      const privPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PrivatePod", 0]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [pubPod.lastID, 40.0, -74.0]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [privPod.lastID, 40.0, -74.0]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ latitude: 40.0, longitude: -74.0, radius: 5000 });

      expect(res.status).to.equal(200);

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.include("PrivatePod");
    });
  });

  // -------------------------
  // POST /api/pods/upload-pod-data
  // -------------------------
  describe("POST /api/pods/upload-pod-data", () => {
    it("should upload pod data for an owned pod", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      // user owns it
      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: podRes.lastID,
          data: {
            latitude: 40.0,
            longitude: -74.0,
            sensors: [
              {
                sensor_type: "temperature",
                reading_value: 25.5,
                reading_units: "C",
                raw_data: { source: "unit-test" },
              },
            ],
          },
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("podDataId");
      expect(res.body.message).to.equal("Pod data uploaded successfully");

      const insertedPodData = await db.get(
        "SELECT * FROM pod_data WHERE pod_id = ?",
        [podRes.lastID]
      );
      expect(insertedPodData).to.not.equal(undefined);

      const insertedSensorData = await db.get(
        "SELECT * FROM sensor_data WHERE pod_data_id = ?",
        [insertedPodData.pod_data_id]
      );
      expect(insertedSensorData).to.not.equal(undefined);
      expect(insertedSensorData.sensor_type).to.equal("temperature");
    });

    it("should reject upload to a pod the user does not own (403)", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["NotOwnedPod", 0]
      );

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: podRes.lastID,
          data: {
            latitude: 40.0,
            longitude: -74.0,
          },
        });

      expect(res.status).to.equal(403);
      expect(res.body).to.have.property("error");
    });
  });

  // -------------------------
  // GET /api/pods/:id/data
  // -------------------------
  describe("GET /api/pods/:id/data", () => {
    it("should allow anonymous access to public pod data", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40.0, -74.0]
      );

      const res = await request(app).get(`/api/pods/${podRes.lastID}/data`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("data");
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it("should reject anonymous access to private pod data (403)", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PrivatePod", 0]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40.0, -74.0]
      );

      const res = await request(app).get(`/api/pods/${podRes.lastID}/data`);

      expect(res.status).to.equal(403);
      expect(res.body.error).to.equal("Forbidden");
    });
  });

  // -------------------------
  // DELETE /api/pods/delete-pod-data
  // -------------------------
  describe("DELETE /api/pods/delete-pod-data", () => {
    it("should delete a pod_data row for an owned pod", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const pdRes = await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40.0, -74.0]
      );

      const res = await request(app)
        .delete("/api/pods/delete-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ podDataId: pdRes.lastID });

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal("Pod data deleted successfully");

      const row = await db.get(
        "SELECT * FROM pod_data WHERE pod_data_id = ?",
        [pdRes.lastID]
      );

      expect(row).to.equal(undefined);
    });

    it("should return 404 if pod_data does not exist", async () => {
      const res = await request(app)
        .delete("/api/pods/delete-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ podDataId: 99999 });

      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("Pod data not found");
    });
  });
});

