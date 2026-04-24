# Frontend Architecture

## Application Entry

```
index.html
  └── main.tsx         (React.StrictMode → <App />)
        └── App.tsx    (BrowserRouter → routing)
              └── MainLayout.tsx  (GlobalErrorProvider → Header, <Outlet />, Footer)
```

**`main.tsx`** — Mounts the React app into `#root`. Wraps everything in `StrictMode`.

**`App.tsx`** — Sets up `BrowserRouter` and imports Leaflet CSS. Defines all routes inside `MainLayout`.

---

## Routing

All routes are children of `MainLayout`, which provides the persistent `Header` and `Footer`.

| Path | Component | Description |
|---|---|---|
| `/` | `Home` | Main map and dashboard |
| `/pod/:podId` | `Pod` | Full pod data detail page |
| `/profile` | `Profile` | User profile (stub) |
| `/settings` | `Profile` | Settings (maps to same component) |
| `/friends` | `Friends` | Friends (stub) |
| `/verify-email` | `VerifyEmail` | Email verification flow |
| `/contact` | `Contact` | Contact info page |
| `/privacy` | `Privacy` | Privacy policy (stub) |
| `/faqs` | `FAQs` | Expandable FAQ list |
| `/about/the-eva-pod` | `AboutTheEVAPod` | Product info |
| `/about/assembly-instructions` | `AboutAssemblyInstructions` | Build guide |
| `/about/nasa-stella` | `AboutNASASTELLA` | NASA STELLA program |
| `/about/meet-carma` | `AboutMeetCARMA` | Team info |

---

## Layout: `MainLayout.tsx`

`MainLayout` is the root shell for every page:

1. Wraps children in `GlobalErrorProvider` (provides error banner context).
2. Registers a **auth-lost handler**: if the API signals the user's session expired, navigate to `/`.
3. Registers an **API error handler**: any unhandled API error shows the global error banner.
4. Renders `<Header />`, `<Outlet />` (the current page), and `<Footer />`.

Handlers are registered on mount and cleaned up on unmount to avoid stale closures.

---

## Global Error Context: `GlobalErrorContext.tsx`

A React context that owns the app-wide error banner:

```ts
interface GlobalErrorContextType {
  showError: (message: string, durationMs?: number) => void;
  clearError: () => void;
}
```

- `showError(message, durationMs=7000)` — Displays a dismissible error banner at the top of the page. Auto-dismisses after `durationMs`.
- `clearError()` — Dismisses the banner immediately.
- The banner renders inside the provider itself (not in a portal). Any component can call `useGlobalError()` to get these methods.

---

## Authentication Model

Auth state is **not stored in a global React context**. Instead:

- Access and refresh tokens are stored in **localStorage** via `utils/api.ts`.
- The `Home` page checks auth on mount with `getMeSilent()` and stores the result locally.
- The `Header` component independently determines auth state to render nav items.
- The API client transparently refreshes tokens on 401 responses.

This means auth state is derived on demand rather than centrally managed. Components that need auth call `getMeSilent()` or check `getAccessToken()`.

### Auth Lifecycle

```
User logs in (AuthPanel)
  → authLogin() → stores access + refresh tokens in localStorage
  → getMe() → returns User object to Home

Any API call
  → request() attaches Authorization: Bearer <accessToken>
  → On 401: authRefresh() called with refresh token
    → If refresh OK: retry original request with new token
    → If refresh fails: clearTokens() + call authLostHandler (navigate to /)

User logs out
  → authLogout() → clears tokens from localStorage
```

---

## Data Flow: Home Page

The `Home` page is the main coordinator. All filter state and pod selection state live here and are passed down to child components.

```
Home.tsx
├── State: filters (FiltersState), visiblePods, selectedPods, user, isAuthenticated
│
├── <Filters />           (reads + updates filters state)
├── <AuthPanel />         (shown when not authenticated)
│
└── <MapView />           (receives filter props + selectedPods)
      └── <PodMarkers />  (fetches pods from API based on filters + map bounds)
            ↓ onPodsLoaded callback
      visiblePods updated in Home
            ↓
      availableSensorTypes extracted from visiblePods
            ↓ passed into <Filters />
      Filters shows only sensor types present in current view
```

### Filter → Map → Filters Feedback Loop

1. User changes a filter in `<Filters />`.
2. `Home` updates `filters` state, which flows into `<MapView>` → `<PodMarkers>`.
3. `PodMarkers` re-fetches pods with new filter params.
4. Loaded pods are reported back via `onPodsLoaded` → `Home.visiblePods`.
5. `Home` extracts `availableSensorTypes` from visible pods and passes them to `<Filters>` to populate the sensor type dropdown.

---

## Data Flow: Pod Detail Page

`Pod.tsx` operates independently from `Home`. It fetches its own data using the `podId` from the URL.

```
URL: /pod/:podId
  → getPodData(podId) → PodDataEntry[]
  → Pod renders:
      ├── Latest stats (most recent reading per sensor type)
      ├── <SensorTrendChart /> (filtered by selectedSensorsOverall + dateRange)
      └── <DailySensorChart /> (filtered by selectedSensorsDaily + selectedDay)
```

---

## Key Conventions

- **Props-down, events-up**: State lives in the nearest common ancestor. Child components receive state as props and report changes via callback props.
- **No global state library**: No Redux, Zustand, or similar. Auth tokens in localStorage; UI state in component state.
- **Debouncing**: Search inputs (e.g., `SharePodModal` user search) are debounced with `setTimeout` + `AbortController` for cancellation.
- **Effect cleanup**: `useEffect` hooks that fetch data use cleanup flags or `AbortController` to avoid setting state after unmount.
- **Local storage persistence**: Map position/zoom and base layer preference are persisted in `localStorage` keys `eva.mapView` and `eva.baseLayer`.
