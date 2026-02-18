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

  const userEmail = "testuser1@example.com";
  const adminEmail = "admin@example.com";

  beforeEach(async () => {
    db = await createTestDb();
    app = makeTestApp(db);

    // normal user
    const userHash = await bcrypt.hash("Password1", 12);
    const userInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      ["TestUser1", userHash, 0]
    );
    userId = userInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [userId, "Test User", userEmail]
    );

    // admin user
    const adminHash = await bcrypt.hash("Password1", 12);
    const adminInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      ["AdminUser", adminHash, 1]
    );
    adminId = adminInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [adminId, "Admin User", adminEmail]
    );

    // login user
    const loginUserRes = await request(app).post("/api/auth/login").send({
      email: userEmail,
      password: "Password1",
    });
    accessTokenUser = loginUserRes.body.accessToken;

    // login admin
    const loginAdminRes = await request(app).post("/api/auth/login").send({
      email: adminEmail,
      password: "Password1",
    });
    accessTokenAdmin = loginAdminRes.body.accessToken;
  });

  afterEach(async () => {
    if (db) await new Promise((resolve) => db.close(resolve));
  });

  // -------------------------
  // GET /api/pods/locations
  // -------------------------
  describe("GET /api/pods/locations", () => {
    it("should return only public pods when anonymous", async () => {
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
        [pubPod.lastID, 40, -74]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [privPod.lastID, 40, -74]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .query({ latitude: 40, longitude: -74, radius: 5000 });

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.not.include("PrivatePod");
    });

    it("should return public + owned private pods when authenticated", async () => {
      const pubPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );
      const ownedPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPrivatePod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        ownedPod.lastID,
      ]);

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [pubPod.lastID, 40, -74]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [ownedPod.lastID, 40, -74]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .query({ latitude: 40, longitude: -74, radius: 5000 });

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.include("OwnedPrivatePod");
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
        [pubPod.lastID, 40, -74]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [privPod.lastID, 40, -74]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .set("Authorization", `Bearer ${accessTokenAdmin}`)
        .query({ latitude: 40, longitude: -74, radius: 5000 });

      const names = res.body.pods.map((p) => p.nickname);
      expect(names).to.include("PublicPod");
      expect(names).to.include("PrivatePod");
    });
  });

  // -------------------------
  // POST /api/pods/upload-pod-data
  // -------------------------
  describe("POST /api/pods/upload-pod-data", () => {
    it("should upload telemetry for owned pod", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40, -74]
      );

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: String(podRes.lastID),
          data: {
            latitude: 40,
            longitude: -74,
            sensors: [
              {
                sensor_type: "temperature",
                reading_value: 25.5,
                reading_units: "C",
              },
            ],
          },
          notes: "test upload",
        });

      expect(res.status).to.equal(200);

      const row = await db.get("SELECT * FROM sensor_data");
      expect(row.sensor_type).to.equal("temperature");
    });

    it("should reject upload to unowned pod (403)", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["NotOwnedPod", 0]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40, -74]
      );

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: String(podRes.lastID),
          data: {
            latitude: 40,
            longitude: -74,
            sensors: [
              {
                sensor_type: "temperature",
                reading_value: 25.5,
                reading_units: "C",
              },
            ],
          },
        });

      expect(res.status).to.equal(403);
    });

    it("should return 400 for invalid pod data payload", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod2", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: String(podRes.lastID),
          data: "not-json",
        });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Invalid pod data");
    });

    it("should return 403 when location is not set", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod3", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post("/api/pods/upload-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({
          podId: String(podRes.lastID),
          data: { sensors: [{ sensor_type: "humidity", reading_value: 60 }] },
        });

      expect(res.status).to.equal(403);
      expect(res.body.error).to.equal("Pod location not set");
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

      const pdRes = await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40, -74]
      );
      await db.run(
        "INSERT INTO sensor_data (pod_data_id, sensor_type, reading_value, reading_units) VALUES (?, ?, ?, ?)",
        [pdRes.lastID, "temperature", 22.4, "C"]
      );

      const res = await request(app).get(`/api/pods/${podRes.lastID}/data`);
      expect(res.status).to.equal(200);
      expect(res.body).to.include.keys(
        "id",
        "nickname",
        "latitude",
        "longitude",
        "visibility",
        "lastUpdated",
        "data"
      );
      expect(res.body.id).to.equal(String(podRes.lastID));
      expect(res.body.nickname).to.equal("PublicPod");
      expect(res.body.visibility).to.equal("public");
      expect(res.body.data).to.be.an("array");
      expect(res.body.data.length).to.be.greaterThan(0);
      expect(res.body.data[0]).to.include.keys("id", "timestamp", "data", "visibility");
      expect(res.body.data[0].data).to.include.keys(
        "sensor_data_id",
        "pod_data_id",
        "sensor_type",
        "reading_value",
        "reading_units",
        "reading_timestamp",
        "raw_data",
        "created_at"
      );
    });

    it("should reject anonymous access to private pod data", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PrivatePod", 0]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [podRes.lastID, 40, -74]
      );

      const res = await request(app).get(`/api/pods/${podRes.lastID}/data`);
      expect(res.status).to.equal(403);
    });

    it("should return 404 when pod does not exist", async () => {
      const res = await request(app).get("/api/pods/999999/data");
      expect(res.status).to.equal(404);
      expect(res.body.error).to.equal("Pod not found");
    });
  });

  // -------------------------
  // DELETE /api/pods/delete-pod-data
  // -------------------------
  describe("DELETE /api/pods/delete-pod-data", () => {
    it("should delete pod_data row for owned pod", async () => {
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
        [podRes.lastID, 40, -74]
      );

      const res = await request(app)
        .delete("/api/pods/delete-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ podDataId: pdRes.lastID });

      expect(res.status).to.equal(200);

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
    });

    it("should return 400 for invalid podDataId", async () => {
      const res = await request(app)
        .delete("/api/pods/delete-pod-data")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ podDataId: "not-a-number" });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("Invalid pod data ID");
    });
  });
});
