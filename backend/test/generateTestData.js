const path = require("path");
const fs = require("fs");

const SEED = 42;

function seededRandom(seed) {
    let s = seed;
    return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}

const random = seededRandom(SEED);

function randomInRange(min, max) {
    return min + random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomInRange(min, max + 1));
}

function pickRandom(arr) {
    return arr[Math.floor(random() * arr.length)];
}

const ALL_SENSORS = [
    { metric: "moisture", unit: "%", min: 0, max:100 },
    { metric: "soil temperature", unit: "C", min: 15, max: 30 },
    { metric: "soil pH", unit: "pH", min: 5, max: 8 },
    { metric: "Temp", unit: "C", min: 18, max: 35 },
    { metric: "Ambient Pressure", unit: "Pa", min: 80000, max: 83000 },
    { metric: "Humidity", unit: "%", min: 10, max: 95 },
    { metric: "Illuminance", unit: "lux", min: 200, max: 2500 },
    { metric: "CO", unit: "ppm", min: 390, max: 1400 },
    { metric: "Gas", unit: "ppm", min: 1000, max: 1500 },
    { metric: "CH4", unit: "ppm", min: 400, max: 500 },
    { metric: "H2", unit: "ppm", min: 1600, max: 1800 },
    { metric: "CO2", unit: "ppm", min: 380, max: 420 }
];

const SENSOR_SUBSETS = {
    full: ALL_SENSORS.map(s => ({ ...s })),
    partial1: ALL_SENSORS.filter(s => ["moisture", "soil temperature", "soil pH", "Temp", "Humidity", "Illuminance", "CO2", "CO"].includes(s.metric)),
    partial2: ALL_SENSORS.filter(s => ["soil temperature", "soil pH", "Temp", "Ambient Pressure", "Humidity", "CO", "CH4"].includes(s.metric)),
    partial3: ALL_SENSORS.filter(s => ["moisture", "soil temperature", "soil pH", "Temp", "CO2"].includes(s.metric)),
    partial4: ALL_SENSORS.filter(s => ["Temp", "Humidity", "Illuminance", "CO", "Gas", "CH4"].includes(s.metric)),
    minimal1: ALL_SENSORS.filter(s => ["moisture", "soil temperature", "soil pH"].includes(s.metric)),
    minimal2: ALL_SENSORS.filter(s => ["Temp", "Ambient Pressure", "Humidity"].includes(s.metric)),
    minimal3: ALL_SENSORS.filter(s => ["soil pH", "Temp", "CO2"].includes(s.metric))
};

function getReadingCountDistribution() {
    const roll = random();
    if (roll < 0.1) return randomInt(0, 5);
    if (roll < 0.6) return randomInt(10, 50);
    if (roll < 0.85) return randomInt(50, 150);
    return randomInt(150, 500);
}

function getSensorSubset() {
    const roll = random();
    if (roll < 0.6) return SENSOR_SUBSETS.full;
    if (roll < 0.85) {
        const partials = [SENSOR_SUBSETS.partial1, SENSOR_SUBSETS.partial2, SENSOR_SUBSETS.partial3, SENSOR_SUBSETS.partial4];
        return pickRandom(partials);
    }
    const minimals = [SENSOR_SUBSETS.minimal1, SENSOR_SUBSETS.minimal2, SENSOR_SUBSETS.minimal3];
    return pickRandom(minimals);
}

function generateReading(sensors, baseValues, timeDrift) {
    const readings =[];
    for (const sensor of sensors) {
        const baseValue = baseValues[sensor.metric] ?? randomInRange(sensor.min, sensor.max);
        const drift = (random() - 0.5) * (sensor.max - sensor.min) * 0.1;
        const timeVariation = Math.sin(timeDrift) * (sensor.max - sensor.min) * 0.05;
        let value = baseValue + drift + timeVariation;
        value = Math.max(sensor.min, Math.min(sensor.max, value));
        if (sensor.metric === "soil pH" || sensor.unit === "pH") {
            value = Math.round(value * 1000) / 1000;
        } else if (sensor.unit === "hPa") {
            value = Math.round(value);
        } else if (sensor.unit === "ppm") {
            value = Math.round(value);
        } else if (sensor.unit === "%") {
            value = Math.round(value * 100) / 100;
        } else {
            value = Math.round(value * 100) / 100;
        }
        readings.push({
            metric: sensor.metric,
            value: value,
            unit: sensor.unit
        });
    }
    return readings;
}

function generatePodData(podName) {
    const readingCount = getReadingCountDistribution();
    if (readingCount === 0) return [];
    const sensors = getSensorSubset();
    const baseValues = {};
    for (const sensor of sensors) {
        baseValues[sensor.metric] = randomInRange(sensor.min, sensor.max);
    }
    const now = Date.now();
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
    const timeRange = now - sixtyDaysAgo;
    const timestamps = [];
    for (let i =0; i < readingCount; i++) {
        timestamps.push(sixtyDaysAgo + random() * timeRange);
    }
    timestamps.sort((a, b) => a - b);
    const podData = [];
    for (let i =0; i < timestamps.length; i++) {
        const ts = Math.floor(timestamps[i] /1000);
        const timeDrift = i / timestamps.length * Math.PI * 2;
        const readings = generateReading(sensors, baseValues, timeDrift);
        for (const key of Object.keys(baseValues)) {
            for (const r of readings) {
                if (r.metric === key) {
                    baseValues[key] = baseValues[key] * 0.9 + r.value * 0.1;
                }
            }
        }
        podData.push({
            pod_name: podName,
            ts: ts,
            seq:Math.floor(ts %10000),
            readings: readings
        });
    }
    return podData;
}

async function main() {
    const peoplePath = path.join(__dirname, "testDataPeople.json");
    const outputPath = path.join(__dirname, "testDataPodData.json");
    const peopleRaw = JSON.parse(fs.readFileSync(peoplePath));
    const allPodData = [];
    for (const person of peopleRaw.people) {
        for (const pod of person.pods) {
            console.log(`Generating data for pod: ${pod.name}`);
            const podData = generatePodData(pod.name);
            allPodData.push(...podData);
        }
    }
    const output = { pod_data: allPodData };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`Generated ${allPodData.length} total readings for ${peopleRaw.people.reduce((sum, p) => sum + p.pods.length, 0)} pods`);
    console.log(`Output written to: ${outputPath}`);
}

main().catch(console.error);