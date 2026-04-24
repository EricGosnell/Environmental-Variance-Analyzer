# Map System

The map system is built on **Leaflet** via **React-Leaflet**. The relevant files are:

- `src/components/Map.tsx` — Map container and base layers
- `src/components/map/PodMarkers.tsx` — Marker rendering and pod data fetching
- `src/components/map/Controls.tsx` — Geocoder, legend, search area, user location
- `src/components/map/podMarkerUtils.ts` — Pure utility functions for marker geometry

---

## Map Container (`Map.tsx`)

Renders the `MapContainer` (Leaflet root) with two switchable tile layers.

### Base Layers

| Name | Provider | Description |
|---|---|---|
| OpenStreetMap | Tile.openstreetmap.org | Default street map |
| ESRI World Imagery | arcgisonline.com | Satellite imagery |

The active layer is persisted to `localStorage` key `eva.baseLayer` and restored on load.

### Persistent View

The map position (lat, lng, zoom) is saved on every `moveend` event to `localStorage` key `eva.mapView`. On initial render, if a saved view exists, the map starts there instead of the default center (`[40, -105.26]`, zoom `12`).

### Map Reference

`Map.tsx` receives a `mapRef: React.RefObject<LeafletMap>` and attaches the Leaflet map instance to it. `Home.tsx` uses this ref to imperatively call `fitBounds` and `setView` for the "Zoom to Selected" feature.

---

## Pod Markers (`map/PodMarkers.tsx`)

The most complex component in the system. It manages pod fetching and all marker rendering.

### Pod Fetching

Pods are fetched whenever filters or the map viewport changes. The fetch call is:

```ts
getPodLocations({
  lat: center.lat,
  lng: center.lng,
  radius: radiusFromViewportMeters(map),
  from_date: fromDate,
  to_date: toDate,
  sensor_types: sensorTypes
})
```

`radius` is calculated from the visible viewport so the server returns only nearby pods. After getting locations, if `ownerFilter === "owned"` or `sensorTypes` filtering is needed, `getPodsLatestReadings` is called to filter further client-side.

**`nameSearch`** is filtered client-side on the full pod name.

**Triggers for re-fetch:**
- Filter props change (`fromDate`, `toDate`, `sensorTypes`, `ownerFilter`, `nameSearch`)
- Custom `"searcharea"` event fired on the map (from the Search Area button in Controls)
- `"eva.login"` window event (fired after successful login, so the map shows owned pods immediately)

### Marker Types

At each zoom level, markers are rendered as either **pins** (for far-out zoom) or **circles** (for close-up zoom).

```ts
function shouldUsePinAtZoom(zoom: number, lat: number): boolean
// Returns true if the computed circle radius would be < 8px at this zoom
```

| Situation | Rendering |
|---|---|
| Far zoom + unselected pod | Small default pin icon |
| Far zoom + selected pod | Highlighted pin icon |
| Far zoom + owned pod | Colored/owned pin icon |
| Close zoom + unselected pod | Circle marker (radius = ~50m in meters) |
| Close zoom + selected pod | Selected-style circle marker |
| Close zoom + owned pod | Owned-style circle marker |

### Tooltip

Hovering a marker shows a popup with:
- Pod nickname
- Visibility (Public/Private)
- Last updated timestamp (formatted via `formatPodLastUpdated`)
- Data point count
- "View Full Data" link → navigates to `/pod/:podId`

The tooltip is positioned to avoid going off-screen. It uses different offsets for pin vs. circle markers (`pinTooltipOffset` / `circleTooltipOffset`).

### Pod Selection

Clicking a marker:
1. Calls `onPodSelect(podId)` to toggle selection in `Home`.
2. Calls `getPodData(podId)` to load the pod's data into the tooltip.
3. Pans the map to center the pod with extra right margin so the tooltip isn't cut off (`flyToWithRightTooltipRoom`).

---

## Controls (`map/Controls.tsx`)

Four custom Leaflet controls embedded in the map:

### Geocoder Control

Uses the `leaflet-control-geocoder` library. Placed in the top-left. Allows searching for a location by name. If the search input is cleared, results are automatically cleared.

### Legend Control (Custom)

A small legend panel (bottom-right) showing:
- EVA Pod symbol (pin or circle, matching current zoom level)
- Your Pod symbol

The legend re-renders when `zoomLevel` changes to reflect whether markers are currently pins or circles.

### Search Area Control

A custom button (top-right) labeled "Search This Area". Clicking it fires a custom `"searcharea"` event on the Leaflet map, which `PodMarkers` listens for to trigger a pod re-fetch centered on the current viewport.

### User Location Control

A custom button that:
1. Checks if `geolocation` is available in the browser.
2. If available: calls `navigator.geolocation.getCurrentPosition`.
3. On success: places a blue dot marker at the user's location with a circle representing GPS accuracy.
4. The accuracy circle's radius in pixels is recalculated on each zoom so it stays geographically accurate.
5. On failure: shows an error message ("Location access denied", "Location unavailable", "Location request timed out").

---

## Pod Marker Utilities (`map/podMarkerUtils.ts`)

Pure functions with no React dependencies.

```ts
// Web Mercator: how many meters per pixel at a given latitude and zoom level
function metersPerPixel(lat: number, zoom: number): number

// Compute a radius (in meters) that covers roughly half the visible viewport
function radiusFromViewportMeters(map: LeafletMap): number

// Format an ISO timestamp for tooltip display: "HH:MM:SS YYYY-MM-DD"
function formatPodLastUpdated(isoString: string): string

// True if a circle at this zoom would render smaller than MARKER_MIN_VISIBLE_RADIUS_PX
function shouldUsePinAtZoom(zoom: number, lat: number): boolean

// Tooltip pixel offset when the marker is a circle
function circleTooltipOffset(radiusPx: number): [number, number]

// Tooltip pixel offset when the marker is a pin
function pinTooltipOffset(): [number, number]
```

### Constants

```ts
MARKER_BASE_RADIUS_METERS = 50   // Physical radius of each pod circle marker
MARKER_MIN_VISIBLE_RADIUS_PX = 8 // Threshold below which pins are used instead
```

---

## Map Interaction Flow

```
User pans/zooms map
  → PodMarkers re-fetches visible pods from API
  → Pods rendered as pins or circles depending on zoom
  → onPodsLoaded callback → Home updates visiblePods

User hovers a marker
  → Tooltip shown with pod summary
  → If selected: getPodData() called to show data count

User clicks a marker
  → Pod toggled in selectedPods (Home state)
  → Map pans to pod with tooltip room

User clicks "View Full Data" in tooltip
  → navigate("/pod/:podId")

User clicks "Search This Area" button
  → "searcharea" event fired on map
  → PodMarkers re-fetches centered on current view

User clicks location button
  → Browser geolocation API called
  → Blue dot + accuracy radius placed on map

User switches base layer (Leaflet control)
  → New layer name saved to localStorage
```

---

## Custom Events

| Event Name | Fired By | Heard By | Purpose |
|---|---|---|---|
| `"searcharea"` | Controls (Search Area button) | PodMarkers | Trigger pod re-fetch for current viewport |
| `"eva.login"` | AuthPanel (after login) | PodMarkers | Refresh pod list to show owned pods |
