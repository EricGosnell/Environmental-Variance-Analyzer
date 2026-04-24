# Frontend Pages

All page components live in `src/pages/`. They are rendered via React Router inside `MainLayout`.

---

## `Home.tsx`

**Route**: `/`

The primary interactive page of the application. Coordinates the map, filters, auth panel, and pod selection.

### State

```ts
isAuthenticated: boolean | null   // null = loading
user: User | null
filters: FiltersState
visiblePods: PodLocation[]
selectedPods: string[]
availableSensorTypes: string[]    // Derived from visiblePods
isPodTableOpen: boolean
podTableHeight: number            // Percentage (10–80)
showVerifiedBanner: boolean
mapRef: React.RefObject<LeafletMap>
```

### Initialization

On mount:
1. If `getAccessToken()` is set, calls `getMeSilent()` to restore auth state.
2. Reads URL search params:
   - `?auth=login&email=X` → opens `AuthPanel` in login mode with email pre-filled.
   - `?verified=1` → shows a "Email verified!" success banner for 5 seconds.

### Key Callbacks

```ts
handleVisiblePodsChange(pods: PodLocation[]): void
```
Called by `MapView`/`PodMarkers` when the set of visible pods changes. Updates `visiblePods`, then derives `availableSensorTypes` by collecting all sensor types from `pods[].latest_readings`.

```ts
handlePodSelect(podId: string): void
```
Toggles a pod in/out of `selectedPods`.

```ts
handleZoomTo(ids: string[]): void
```
Imperatively zooms the Leaflet map. If multiple pods: calls `map.fitBounds(...)` over their locations. If a single pod: calls `map.setView(...)` at zoom 16.

### Layout

```
Home
├── Sidebar (left)
│   ├── <AuthPanel>      (if not authenticated)
│   └── <Filters>        (always shown)
│
└── Map container (right)
    ├── <MapView>
    └── <PodTable>       (collapsible bottom drawer)
```

- Upload Data and Manage Buttons appear if `isAuthenticated && user?.pods?.length > 0`.
- The "Email verified!" banner appears for 5 seconds after arriving from the verification flow.

---

## `Pod.tsx`

**Route**: `/pod/:podId`

Full data detail page for a single EVA pod.

### Route Params

- `podId` (string) — from URL

### State

```ts
loading: boolean
error: string | null
data: PodDataEntry[]
podMeta: {
  id: string;
  nickname: string;
  location: string;
  visibility: string;
  lastUpdated: string;
} | null
viewer: {
  isOwner: boolean;
  canManagePod: boolean;
} | null
selectedSensorsOverall: string[]   // For SensorTrendChart
selectedSensorsDaily: string[]     // For DailySensorChart
selectedRange: "Last 7 Days" | "Last 30 Days" | "All Time"
selectedDay: string                 // "YYYY-MM-DD"
showShareModal: boolean
podOwners: User[]
```

### Initialization

On mount (and when `podId` changes):
1. Calls `getPodData(podId)` — returns `{ data, pod_meta, viewer }`.
2. Populates `data`, `podMeta`, `viewer`.
3. Resets `selectedSensorsOverall` and `selectedSensorsDaily` to the first available sensor type.
4. Resets `selectedDay` to the most recent day that has data.

When `showShareModal` becomes `true`:
- Calls `getPodOwners(podId)` to load the current owners list.

### Sections

**Header**
- Pod nickname, location (formatted), last updated (formatted as M/D/YYYY).
- If `viewer.canManagePod`: "Upload Data" button (opens `AddDataModal`) and "Share Pod" button (opens `SharePodModal`).

**Latest Stats**
- Shows one card per sensor type with:
  - Sensor name (title-cased)
  - Latest reading value and units
  - Trend arrow: `↑` (increasing), `↓` (decreasing), or `→` (stable), determined by comparing the last two readings.

**Sensor Trends**
- `<SensorTrendChart>` with a date range dropdown ("Last 7 Days", "Last 30 Days", "All Time").
- `<MultiSensorDropdown>` to choose which sensor types to display.

**Daily Data**
- Tab row: one button per distinct day that has data (sorted descending, most recent first).
- `<DailySensorChart>` for the `selectedDay`.
- `<MultiSensorDropdown>` for per-day sensor selection.

### Helper Functions

```ts
function titleCaseSensor(sensor: string): string
// "temperature_c" → "Temperature C"

function formatDateMDY(iso: string): string
// "2024-03-15T00:00:00" → "3/15/2024"

function formatLocation(location: string): string
// Formats raw location string for display

function trendArrow(data: PodDataEntry[], sensorType: string): "↑" | "↓" | "→"
// Compares last two readings of a sensor type
```

---

## `VerifyEmail.tsx`

**Route**: `/verify-email`

Handles the email verification step after signup or when a user tries to log in with an unverified email.

### URL Search Params

| Param | Values | Description |
|---|---|---|
| `email` | string | Email address to verify |
| `reason` | `"signup"` \| `"login"` | Why verification is happening |
| `sent` | `"1"` \| `"0"` | Whether the code was already sent |
| `next` | path string | Where to navigate after success (validated against allowed paths) |

### State

```ts
code: string              // 6-digit input
loading: boolean
resendLoading: boolean
error: string | null
info: string | null
cooldownSeconds: number   // 60s cooldown after sending code
```

### Security

- `next` param is validated against a whitelist of safe paths to prevent open redirect.
- `email` is validated with a regex before sending to the API.
- `code` input strips non-digit characters.

### Behavior

**Verify:**
1. Validates `email` format and `code` is non-empty.
2. Calls `verifyEmail({ email, code })`.
3. On success: navigates to `next` (or `/` if `next` is not set/safe).

**Resend:**
1. Calls `sendVerification(email)`.
2. Starts 60-second cooldown on the Resend button.

The page message adapts to `reason`:
- `signup`: "Check your email for a 6-digit verification code."
- `login`: "Your account's email isn't verified yet."

---

## `FAQs.tsx`

**Route**: `/faqs`

Expandable FAQ sections.

### State

```ts
openIndex: number | null   // Index of currently open FAQ item
```

### Data

FAQ items are hardcoded in the component as an array of `{ category, question, answer }` objects.

**Categories covered:**
- Account Settings
- EVA Pod Management
- Map & Data Display
- Tips & Troubleshooting
- Social Navigation

### Behavior

- Clicking a question expands its answer. Clicking again collapses it.
- Only one question open at a time.
- Keyboard: `Enter` or `Space` toggles the focused question. `ArrowDown` moves focus to the next.
- Accessible: `aria-expanded` on each toggle button.

---

## `Profile.tsx`

**Route**: `/profile`, `/settings`

Currently a stub/placeholder component. No meaningful content yet.

---

## `Friends.tsx`

**Route**: `/friends`

Currently a stub/placeholder component. No meaningful content yet.

---

## `Contact.tsx`

**Route**: `/contact`

Static info page showing:
- Contact email address
- Physical mailing address
- Links to relevant organizations

---

## `Privacy.tsx`

**Route**: `/privacy`

Placeholder privacy policy page. Content not yet filled in.

---

## About Pages

Four static informational pages. All content is hardcoded — no API calls.

### `About-theEVAPod.tsx` — `/about/the-eva-pod`

Describes the EVA Pod device: what it is, what sensors it contains, how it connects.

### `About-assemblyInstructions.tsx` — `/about/assembly-instructions`

Step-by-step instructions for building an EVA Pod, with images from `src/assets/`.

### `About-NASASTELLA.tsx` — `/about/nasa-stella`

Information about the NASA STELLA program and its connection to CARMA/EVA. Includes external link to the NASA STELLA website.

### `About-meetCARMA.tsx` — `/about/meet-carma`

Team member bios for the CARMA team. Each member has:
- Photo (from assets)
- Name
- Role
- Contact email

Includes links to COSGC and CARMA external websites.
