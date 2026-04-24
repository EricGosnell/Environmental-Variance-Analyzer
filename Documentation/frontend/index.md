# Frontend Documentation — Overview

## Table of Contents

- [index.md](index.md) — This file: tech stack, directory structure, setup
- [architecture.md](architecture.md) — App architecture, routing, context providers, data flow
- [components.md](components.md) — All reusable UI components
- [pages.md](pages.md) — All page-level components and their behavior
- [api-layer.md](api-layer.md) — API client, request lifecycle, token management
- [map-system.md](map-system.md) — Map architecture, marker rendering, controls

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool and dev server |
| React Router | 6 | Client-side routing |
| Leaflet + React-Leaflet | — | Interactive map |
| Plotly.js | — | Data charts |
| ESLint | — | Linting |

---

## Directory Structure

```
frontend/
├── index.html                  # HTML entry point
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript config
├── package.json
└── src/
    ├── main.tsx                # React DOM render entry
    ├── App.tsx                 # Router setup and route definitions
    ├── assets/                 # Static images and logos
    ├── components/             # Reusable UI components
    │   ├── AddDataModal.tsx
    │   ├── AuthPanel.tsx
    │   ├── DailySensorChart.tsx
    │   ├── Filters.tsx
    │   ├── Footer.tsx
    │   ├── ForgotPasswordModal.tsx
    │   ├── GlobalErrorContext.tsx
    │   ├── Header.tsx
    │   ├── Map.tsx
    │   ├── MultiSensorDropdown.tsx
    │   ├── PodTable.tsx
    │   ├── SensorTrendChart.tsx
    │   ├── SharePodModal.tsx
    │   └── map/                # Map-specific sub-components
    │       ├── Controls.tsx
    │       ├── PodMarkers.tsx
    │       └── podMarkerUtils.ts
    ├── layouts/
    │   └── MainLayout.tsx      # Root layout with global error context
    ├── pages/                  # Route-level page components
    │   ├── Home.tsx
    │   ├── Pod.tsx
    │   ├── Profile.tsx
    │   ├── Friends.tsx
    │   ├── VerifyEmail.tsx
    │   ├── Contact.tsx
    │   ├── FAQs.tsx
    │   ├── Privacy.tsx
    │   ├── About-theEVAPod.tsx
    │   ├── About-assemblyInstructions.tsx
    │   ├── About-NASASTELLA.tsx
    │   └── About-meetCARMA.tsx
    ├── styles/                 # Global CSS
    └── utils/
        ├── api.ts              # API client with auth and token management
        ├── apiTypes.ts         # TypeScript type definitions for all API models
        ├── sensorColors.ts     # Color palette utilities for sensor types
        └── leaflet-react-geocoder.d.ts  # Type declarations for geocoder
```

---

## Local Development Setup

```bash
cd frontend
npm install
npm run dev        # Start dev server (Vite, typically http://localhost:5173)
npm run build      # Production build to dist/
npm run lint       # ESLint check
```

The frontend communicates with the backend API. In development the backend is typically accessed via docker-compose. See `Documentation/docker.md` for the full stack setup.
