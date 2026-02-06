const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const loadTestData = async (db) => {

    const path = require("path");
    const fs = require("fs");
    const bcrypt = require("bcryptjs");

    const peoplePath = path.join(__dirname, "testDataPeople.json");
    const podDataPath = path.join(__dirname, "testDataPodData.json");

    if (!fs.existsSync(peoplePath)) {
        console.log("No people seed data — skipping");
        return;
    }

    const peopleRaw = JSON.parse(fs.readFileSync(peoplePath));

    const podRaw = fs.existsSync(podDataPath)
        ? JSON.parse(fs.readFileSync(podDataPath))
        : { pod_data: [] };

    await db.run("BEGIN TRANSACTION");

    // pick up where DB left off (safe for reruns)
    const row = await db.get("SELECT MAX(pod_id) AS m FROM pod");
    let nextPodId = (row?.m ?? 0) + 1;

    // ===========================
    // USERS + PODS
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

            let podRow = await db.get(
                "SELECT pod_id FROM pod WHERE pod_name = ?",
                [pod.name]
            );

            let podId;

            if (podRow) {
                podId = podRow.pod_id;
            } else {

                podId = nextPodId++;

                await db.run(
                    `INSERT INTO pod (pod_id, pod_name, pod_data_public)
           VALUES (?, ?, ?)`,
                    [podId, pod.name, pod.visibility]
                );
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
    // SENSOR TELEMETRY
    // ===========================

    for (const entry of podRaw.pod_data) {

        const podRow = await db.get(
            "SELECT pod_id FROM pod WHERE pod_name = ?",
            [entry.pod_name]
        );

        if (!podRow) continue;

        const podId = podRow.pod_id;

        const podDataRow = await db.get(
            `SELECT pod_data_id FROM pod_data
       WHERE pod_id = ?
       ORDER BY pod_data_id LIMIT 1`,
            [podId]
        );

        if (!podDataRow) continue;

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

    console.log("People + pods + telemetry seeded successfully");
};

module.exports = { loadTestData };


module.exports = { loadTestData };
