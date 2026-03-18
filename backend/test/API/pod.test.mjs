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
  let collaboratorId;

  const userEmail = "testuser1@example.com";
  const adminEmail = "admin@example.com";
  const collaboratorEmail = "collab@example.com";

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

    // collaborator user
    const collaboratorHash = await bcrypt.hash("Password1", 12);
    const collaboratorInsert = await db.run(
      "INSERT INTO users (username, password_hash, admin) VALUES (?, ?, ?)",
      ["CollaboratorUser", collaboratorHash, 0]
    );
    collaboratorId = collaboratorInsert.lastID;

    await db.run(
      "INSERT INTO user_contact (user_id, user_name, email) VALUES (?, ?, ?)",
      [collaboratorId, "Collaborator User", collaboratorEmail]
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

    it("should set isOwner=true only for pods the authenticated user owns", async () => {
      const ownedPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 1]
      );
      const otherPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OtherPod", 1]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        ownedPod.lastID,
      ]);

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [ownedPod.lastID, 40, -74]
      );
      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [otherPod.lastID, 40, -74]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .query({ latitude: 40, longitude: -74, radius: 5000 });

      expect(res.status).to.equal(200);
      const owned = res.body.pods.find((p) => p.nickname === "OwnedPod");
      const other = res.body.pods.find((p) => p.nickname === "OtherPod");
      expect(owned.isOwner).to.equal(true);
      expect(other.isOwner).to.equal(false);
    });

    it("should set isOwner=false for all pods when anonymous", async () => {
      const pubPod = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["PublicPod", 1]
      );

      await db.run(
        "INSERT INTO pod_data (pod_id, latitude, longitude) VALUES (?, ?, ?)",
        [pubPod.lastID, 40, -74]
      );

      const res = await request(app)
        .get("/api/pods/locations")
        .query({ latitude: 40, longitude: -74, radius: 5000 });

      expect(res.status).to.equal(200);
      const pod = res.body.pods.find((p) => p.nickname === "PublicPod");
      expect(pod.isOwner).to.equal(false);
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
          pod_data: [
            {
              pod_id: podRes.lastID,
              ts: Math.floor(Date.now() / 1000),
              seq: 1,
              readings: [
                { metric: "temperature", value: 25.5, unit: "C" }
              ],
            },
          ],
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
          pod_data: [
            {
              pod_id: podRes.lastID,
              ts: Math.floor(Date.now() / 1000),
              seq: 1,
              readings: [
                { metric: "temperature", value: 25.5, unit: "C" }
              ],
            },
          ],
        });

      expect(res.status).to.equal(403);
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
        [podRes.lastID, 40, -74]
      );

      const res = await request(app).get(`/api/pods/${podRes.lastID}/data`);
      expect(res.status).to.equal(200);
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
  });

  // -------------------------
  // POST /api/pods/:id/owners
  // -------------------------
  describe("POST /api/pods/:id/owners", () => {
    it("should allow a pod owner to add another owner", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post(`/api/pods/${podRes.lastID}/owners`)
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ userId: collaboratorId });

      expect(res.status).to.equal(201);

      const ownerRow = await db.get(
        "SELECT 1 FROM user_pod WHERE user_id = ? AND pod_id = ?",
        [collaboratorId, podRes.lastID]
      );
      expect(ownerRow).to.not.equal(undefined);
    });

    it("should reject adding an owner when requester does not own pod", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["NotOwnedPod", 0]
      );

      const res = await request(app)
        .post(`/api/pods/${podRes.lastID}/owners`)
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ userId: collaboratorId });

      expect(res.status).to.equal(403);
    });

    it("should return 404 when target user does not exist", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post(`/api/pods/${podRes.lastID}/owners`)
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ userId: 99999 });

      expect(res.status).to.equal(404);
    });

    it("should return 409 when target user is already an owner", async () => {
      const podRes = await db.run(
        "INSERT INTO pod (pod_name, pod_data_public) VALUES (?, ?)",
        ["OwnedPod", 0]
      );

      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        userId,
        podRes.lastID,
      ]);
      await db.run("INSERT INTO user_pod (user_id, pod_id) VALUES (?, ?)", [
        collaboratorId,
        podRes.lastID,
      ]);

      const res = await request(app)
        .post(`/api/pods/${podRes.lastID}/owners`)
        .set("Authorization", `Bearer ${accessTokenUser}`)
        .send({ userId: collaboratorId });

      expect(res.status).to.equal(409);
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
  });
});
