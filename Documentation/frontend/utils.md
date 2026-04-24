# Utilities

Utility modules live in `src/utils/`. They contain shared logic with no React dependencies (except type imports).

---

## `sensorColors.ts`

Provides a deterministic, collision-resistant color palette for sensor types.

### `getSensorColor(sensorType: string): string`

Returns an HSL color string (e.g., `"hsl(137, 65%, 45%)"`) for a given sensor type key.

**Algorithm:**
- Uses the **golden ratio** (`φ ≈ 0.618...`) to step through the hue wheel, ensuring colors are maximally spread apart regardless of how many sensor types exist.
- A module-level `Map<string, string>` caches each sensor type's color so the same type always gets the same color across renders.
- Saturation is fixed at 65%, lightness at 45% for consistent legibility.

**Example:**
```ts
getSensorColor("temperature_c")  // → "hsl(137, 65%, 45%)"
getSensorColor("humidity")       // → "hsl(274, 65%, 45%)"
getSensorColor("temperature_c")  // → "hsl(137, 65%, 45%)" (cached)
```

**Used by:** `MultiSensorDropdown`, `DailySensorChart`, `SensorTrendChart`.

---

### `buildUnitsMap(data: PodDataEntry[], sensorTypes: string[]): Record<string, string>`

Creates a lookup of `{ [sensorType]: units }` from an array of `PodDataEntry`.

**Algorithm:**
1. For each `sensorType` in `sensorTypes`, find the first `PodDataEntry` where `entry.sensor_type === sensorType`.
2. Record its `units` string.
3. Return the full map.

**Purpose:** Eliminates duplicated `find()` logic across chart components that need to label their y-axis with the correct units for each sensor type.

**Example:**
```ts
buildUnitsMap(data, ["temperature_c", "humidity"])
// → { temperature_c: "°C", humidity: "%" }
```

**Used by:** `DailySensorChart`, `SensorTrendChart`.

---

## `leaflet-react-geocoder.d.ts`

Type declaration file for the `leaflet-control-geocoder` package, which does not ship its own TypeScript types. This file provides the minimum type surface needed by `Controls.tsx`:

- `L.Control.Geocoder` class and its `initialize` method
- `L.control.geocoder()` factory function
- The `GeocoderResult` interface
- Extension of the `L.Map` type to include the geocoder control

This file has no exports — it augments the global Leaflet `L` namespace via `declare module "leaflet"`.

---

## `api.ts` and `apiTypes.ts`

See [api-layer.md](api-layer.md) for full documentation of the API client and type definitions.
