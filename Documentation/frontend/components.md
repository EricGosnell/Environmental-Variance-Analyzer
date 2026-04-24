# Frontend Components

All reusable components live in `src/components/`. Map-specific sub-components are in `src/components/map/`.

---

## `GlobalErrorContext.tsx`

**Purpose**: App-wide dismissible error banner system.

### Exported

```ts
const GlobalErrorContext: React.Context<GlobalErrorContextType>
function GlobalErrorProvider({ children }: { children: React.ReactNode }): JSX.Element
function useGlobalError(): GlobalErrorContextType
```

### Context Shape

```ts
interface GlobalErrorContextType {
  showError: (message: string, durationMs?: number) => void;
  clearError: () => void;
}
```

### Behavior

- `showError(message, durationMs=7000)` sets an internal `message` state and schedules a `clearError` after `durationMs` milliseconds.
- The provider renders a red/pink dismissible banner at the top of the page when `message` is set. The banner has an `×` close button.
- Banner renders inside the provider, not in a portal, so it appears within the layout flow.
- Calling `showError` while a message is already visible cancels the previous auto-dismiss timer.

### Usage

```tsx
// Anywhere in the tree under GlobalErrorProvider:
const { showError } = useGlobalError();
showError("Something went wrong. Please try again.");
```

---

## `Header.tsx`

**Purpose**: Top navigation bar present on all pages.

### Props

None. Reads auth state independently via `getAccessToken()` + `getMe()`.

### State

```ts
aboutOpen: boolean       // About dropdown open
profileOpen: boolean     // Profile dropdown open
loggingOut: boolean      // Prevents double-click on logout
```

### Behavior

- Displays the app title as a link to `/`.
- Navigation links: **Map** (`/`), **About** dropdown, **FAQs** (`/faqs`).
- If authenticated: shows a **Profile** dropdown with "View Profile", "Settings", and "Logout".
- Dropdowns close on `Escape` keypress or click outside.
- Logout calls `authLogout()` then navigates to `/`.
- Keyboard navigation: `Enter`/`Space` to open dropdowns, `ArrowDown` to move focus into menu items.

---

## `Footer.tsx`

**Purpose**: Static site footer.

### Props

None.

### Content

Three columns:
- **Explore**: Links to Map, FAQs, Contact
- **About**: Links to The EVA Pod, Assembly Instructions, NASA STELLA, Meet CARMA
- **Images**: COSGC and NASA logos with external links

---

## `AuthPanel.tsx`

**Purpose**: Combined login/signup form displayed in the Home sidebar when the user is not authenticated.

### Props

```ts
interface AuthPanelProps {
  onAuthSuccess: (user: User) => void;
  initialMode?: "login" | "signup";
  initialLoginEmail?: string;
}
```

### State

```ts
// Shared
mode: "login" | "signup"
loading: boolean
error: string | null
info: string | null
showResetModal: boolean

// Login
loginEmail: string
loginPassword: string

// Signup
signupUsername: string
signupEmail: string
signupPhone: string
signupPassword: string
signupRetypePassword: string
```

### Behavior

**Login flow:**
1. Validates non-empty fields.
2. Calls `authLogin({ email, password })`.
3. On 403: navigates to `/verify-email?email=...&reason=login` (unverified account).
4. On 400: shows validation error from API.
5. On success: calls `getMe()` then calls `onAuthSuccess(user)`.

**Signup flow:**
1. Validates passwords match.
2. Calls `authRegister({ username, email, phone, password })`.
3. Calls `sendVerification(email)`.
4. Navigates to `/verify-email?email=...&reason=signup&sent=1`.

**Reset password:**
- "Forgot Password?" link opens `ForgotPasswordModal` with the current login email pre-filled.

---

## `ForgotPasswordModal.tsx`

**Purpose**: Two-step modal for password reset via email code.

### Props

```ts
interface ForgotPasswordModalProps {
  isOpen: boolean;
  initialEmail: string;
  onClose: () => void;
  onResetSuccess: (email: string) => void;
}
```

### State

```ts
step: "email" | "reset"
email: string
code: string          // 6-digit code
newPassword: string
confirmPassword: string
sendLoading: boolean
submitLoading: boolean
cooldownSeconds: number  // Countdown after sending code (60s)
error: string | null
info: string | null
```

### Behavior

**Step 1 — Email:**
1. Validates email format with regex.
2. Calls `authForgotPassword({ email })`.
3. Shows success info message, starts 60-second cooldown on the "Send Code" button.
4. Advances to step 2.

**Step 2 — Reset:**
1. Validates code is 6 digits, passwords match and are non-empty.
2. Calls `authResetPassword({ email, code, newPassword })`.
3. On success: calls `onResetSuccess(email)`, closes modal.
4. "Back" button returns to step 1 (email preserved, cooldown preserved).

---

## `Filters.tsx`

**Purpose**: Sidebar filter panel for the map view. Stateless — all filter state is owned by `Home`.

### Props

```ts
interface FiltersProps {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  availableSensorTypes: string[];
  isAuthenticated: boolean;
}
```

### `FiltersState` Type

```ts
interface FiltersState {
  uploadTimeframe: "24h" | "7d" | "30d" | "any";
  customFrom: string;    // ISO date string or ""
  customTo: string;      // ISO date string or ""
  sensorTypes: string[]; // Selected sensor type keys
  ownerFilter: "all" | "owned";
  nameSearch: string;
}
```

### Helpers (exported)

```ts
function uploadTimeframeToFromDate(filters: FiltersState): string | undefined
function uploadTimeframeToToDate(filters: FiltersState): string | undefined
```

`uploadTimeframeToFromDate` converts the timeframe preset to a UTC ISO date string (or `customFrom` if timeframe is `"any"`). `uploadTimeframeToToDate` returns `customTo` if set, otherwise `undefined`.

### UI Sections

1. **Pod Name Search** — text input, filters `nameSearch`.
2. **Pod Ownership** (auth only) — "All Pods" / "My Pods" toggle for `ownerFilter`.
3. **Last Upload** — preset buttons: 24h, 7d, 30d, Any. Selecting "Any" reveals custom date range inputs.
4. **Data Types** — `MultiSensorDropdown` populated with `availableSensorTypes`.
5. **Clear** button — resets all filters to defaults (disabled if already at defaults).

---

## `MultiSensorDropdown.tsx`

**Purpose**: A multi-select dropdown for choosing sensor types, with color swatches.

### Props

```ts
interface MultiSensorDropdownProps {
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}
```

### State

```ts
isOpen: boolean
```

### Behavior

- Clicking the button toggles the dropdown open/closed.
- Clicking outside or pressing `Escape` closes it.
- Each option shows a color swatch (via `getSensorColor(key)`) and a checkbox.
- Clicking an option toggles it in/out of `selected`.
- Button label shows count of selected sensors (e.g., "3 selected") or the `placeholder` when none.
- Accessible: `aria-expanded`, `aria-haspopup`, `Escape` key to close.

---

## `Map.tsx` (exports `MapView`)

**Purpose**: The Leaflet map container with base layers and persistent view state.

### Props

```ts
interface MapViewProps {
  onVisiblePodsChange: (pods: PodLocation[]) => void;
  selectedPods: string[];
  onPodSelect: (podId: string) => void;
  mapRef: React.RefObject<LeafletMap | null>;
  isAuthenticated: boolean;
  fromDate?: string;
  toDate?: string;
  sensorTypes?: string[];
  ownerFilter?: "all" | "owned";
  nameSearch?: string;
}
```

### Behavior

- Renders a `MapContainer` (Leaflet) centered on `[40, -105.26]` (Denver area) at zoom 12 by default.
- Provides two base layers switchable via the Leaflet layer control:
  - **OpenStreetMap** (default)
  - **ESRI World Imagery** (satellite)
- **Persistent view**: On map move or zoom, saves `{lat, lng, zoom}` to `localStorage` key `eva.mapView`. On load, restores this position.
- **Persistent base layer**: Saves the selected tile layer name to `localStorage` key `eva.baseLayer`. Restores on load.
- Renders `<PodMarkers>` (marker logic) and `<Controls>` (geocoder, legend, location) inside the map.
- Exposes the Leaflet map instance via `mapRef` for imperative operations (e.g., `fitBounds` from PodTable).

---

## `PodTable.tsx`

**Purpose**: A resizable bottom drawer showing a table of currently visible pods with selection controls.

### Props

```ts
interface PodTableProps {
  isOpen: boolean;
  onClose: () => void;
  onHeightChange: (heightPercent: number) => void;
  visiblePodIds: string[];
  selectedPods: string[];
  onSelectionChange: (ids: string[]) => void;
  onZoomTo: (ids: string[]) => void;
}
```

### State

```ts
podTableHeight: number      // Percentage (10–80)
isDragging: boolean
startY: number
startHeight: number
pods: PodLatestReadings[]
sensorTypes: string[]
isLoading: boolean
error: string | null
```

### Behavior

- Appears as a sliding drawer from the bottom of the map.
- **Drag resize**: A handle at the top of the drawer can be dragged (mouse or touch) to resize between 10% and 80% of viewport height. Dragging below 15% closes the drawer.
- **Data**: When opened and `visiblePodIds` changes, calls `getPodsLatestReadings(visiblePodIds)` to get pod data.
- **Table**: Shows one row per pod. Columns are pod name plus one column per sensor type (showing latest reading value).
- **Selection**: Clicking a row toggles that pod in `selectedPods`.
- **Action buttons**: "Zoom to Selected" calls `onZoomTo(selectedPods)`. "Clear" deselects all. "Invert" selects all unselected pods.

---

## `AddDataModal.tsx`

**Purpose**: Modal form for uploading sensor data to a pod.

### Props

```ts
interface AddDataModalProps {
  show: boolean;
  onCancel: () => void;
  onUpload: (file: File, podId: string, location: string, notes: string) => void;
}
```

### State

```ts
file: File | null
podId: string
podLocation: string
podDataNotes: string
```

### Behavior

Form with fields for CSV file upload, pod ID, location, and notes. Submits via `onUpload` callback. The `onUpload` handler is provided by the parent; the modal itself does not call the API directly.

> **Note**: The actual upload logic (`onUpload` implementation) is not yet wired up in `Home.tsx` — this modal is a UI skeleton.

---

## `DailySensorChart.tsx`

**Purpose**: Plotly line chart showing sensor readings for a single selected day.

### Props

```ts
interface DailySensorChartProps {
  data: PodDataEntry[];
  sensorTypes: string[];
  day: string;   // "YYYY-MM-DD"
}
```

### Behavior

1. Filters `data` to entries where `recorded_at` falls on `day` and `sensor_type` is in `sensorTypes`.
2. **No data**: Shows a "No data available" message.
3. **Single point**: Shows a summary card with the reading value and timestamp.
4. **Multiple points**: Renders a Plotly `scatter` chart with `mode: "lines+markers"`:
   - X-axis: time (formatted as 12-hour, e.g., "2:30 PM").
   - Y-axis: reading value with label showing units (or "mixed units" for multiple sensor types).
   - One trace per sensor type, each colored via `getSensorColor()`.
   - Legend visible for multi-sensor views.
   - Responsive (fills container width).

---

## `SensorTrendChart.tsx`

**Purpose**: Plotly scatter chart showing sensor readings over multiple days.

### Props

```ts
interface SensorTrendChartProps {
  data: PodDataEntry[];
  sensorTypes: string[];
  dateRange: "Last 7 Days" | "Last 30 Days" | "All Time";
}
```

### Behavior

1. Filters data to `dateRange` and selected `sensorTypes`.
2. **Single point**: Shows a summary card.
3. **Multiple points**: Renders a Plotly `scatter` chart with `mode: "markers"`:
   - X-axis: dates (YYYY-MM-DD labels).
   - Y-axis: reading value with units label.
   - **Jitter**: Points are horizontally jittered by a small amount (0–0.12) to avoid overlap on the same day. Jitter amount scales with the number of points on that day.
   - One trace per sensor type, colored via `getSensorColor()`.
   - Responsive rendering.

---

## `SharePodModal.tsx`

**Purpose**: Modal for searching users and adding them as pod co-owners.

### Props

```ts
interface SharePodModalProps {
  show: boolean;
  podId: string;
  onClose: () => void;
  currentOwnerIds: number[];
}
```

### State

```ts
query: string
results: PodOwnerCandidate[]
isSearching: boolean
searchError: string | null
addingUserId: number | null
feedback: Record<number, string>   // Per-user success/error messages
localOwnerIds: number[]            // IDs added this session
```

### Behavior

- Search requires ≥ 2 characters; shorter input clears results.
- Search is debounced 250ms; each search uses an `AbortController` to cancel the previous in-flight request.
- Results show user avatar (initials), username, and an "Add" button.
- Users already in `currentOwnerIds` or `localOwnerIds` show "Already an Owner" instead of the Add button.
- Clicking "Add" calls `addPodOwner({ podId, userId })` and adds the user to `localOwnerIds` on success.
- `Escape` key or click outside closes the modal.
