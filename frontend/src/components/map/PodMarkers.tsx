import { useEffect, useRef, useState } from "react";
import { Circle, Tooltip, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";

import { getPodData, getPodLocations } from "../../utils/api";
import type { PodLocation } from "../../utils/apiTypes";

// ----------------------------
// Local helpers + constants (PodMarkers-only)
// ----------------------------

const EVENT_SEARCH_AREA = "searcharea";

const MAP_CLICK_SUPPRESS_MS = 250;
const TOOLTIP_CLOSE_CLEAR_DELAY_MS = 150;

const MARKER_BASE_RADIUS_METERS = 50;
const MARKER_MIN_RADIUS_PX = 6;

const TOOLTIP_GAP_PX = 8;
const TOOLTIP_ESTIMATED_WIDTH_PX = 215;

type MapLike = {
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  getSize: () => { x: number; y: number };
  project: (latlng: [number, number], zoom: number) => { add: (pt: [number, number]) => unknown };
  unproject: (pt: unknown, zoom: number) => { lat: number; lng: number };
  flyTo: (center: { lat: number; lng: number } | [number, number], zoom?: number, options?: unknown) => void;
};

function metersPerPixel(latitude: number, zoom: number): number {
  // Web Mercator approximate meters-per-pixel at given latitude.
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

function radiusFromViewportMeters(centerLat: number, zoom: number, widthPx: number, heightPx: number): number {
  const mpp = metersPerPixel(centerLat, zoom);
  // Roughly cover the visible viewport (half of the max dimension).
  return Math.max(1, Math.round(mpp * Math.max(widthPx, heightPx) * 0.5));
}

function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds} ${year}-${month}-${day}`;
  } catch {
    return "—";
  }
}

export default function PodMarkers() {
  const navigate = useNavigate();
  const [pods, setPods] = useState<PodLocation[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const podDataAbortRef = useRef<AbortController | null>(null);
  const lastPodClickAtRef = useRef<number>(0);
  const closeTooltipTimeoutRef = useRef<number | null>(null);

  const [selectedPodData, setSelectedPodData] = useState<unknown[] | null>(null);
  const [selectedPodDataLoading, setSelectedPodDataLoading] = useState(false);
  const [podDataCountById, setPodDataCountById] = useState<Record<string, number>>({});
  const [tooltipPodId, setTooltipPodId] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  async function fetchPods(map: MapLike) {
    const token = localStorage.getItem("eva.accessToken");
    if (!token) {
      setPods([]);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const center = map.getCenter();
    const zoom = map.getZoom();
    const size = map.getSize();

    const radius = radiusFromViewportMeters(center.lat, zoom, size.x, size.y);

    try {
      const res = await getPodLocations(
        {
          latitude: center.lat,
          longitude: center.lng,
          radius,
        },
        ac.signal,
      );
      setPods(Array.isArray(res.pods) ? res.pods : []);
    } catch (err) {
      // Ignore abort errors; other errors just result in no markers.
      if ((err as any)?.name === "AbortError") return;
      setPods([]);
    }
  }

  const map = useMapEvents({
    click: () => {
      // Click outside closes the tooltip.
      // Suppress the immediate map click that often follows a pod click.
      if (Date.now() - lastPodClickAtRef.current < MAP_CLICK_SUPPRESS_MS) return;
      closeTooltip();
    },
    [EVENT_SEARCH_AREA]: () => {
      void fetchPods(map as unknown as MapLike);
    },
  } as any) as unknown as MapLike;

  useEffect(() => {
    void fetchPods(map);
    return () => {
      abortRef.current?.abort();
      podDataAbortRef.current?.abort();
      if (closeTooltipTimeoutRef.current !== null) {
        window.clearTimeout(closeTooltipTimeoutRef.current);
        closeTooltipTimeoutRef.current = null;
      }
    };
    // map is stable for the lifetime of the MapContainer
  }, [map]);

  function closeTooltip() {
    if (!tooltipPodId) return;
    setTooltipVisible(false);
    podDataAbortRef.current?.abort();

    if (closeTooltipTimeoutRef.current !== null) {
      window.clearTimeout(closeTooltipTimeoutRef.current);
      closeTooltipTimeoutRef.current = null;
    }

    closeTooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltipPodId(null);
      setSelectedPodData(null);
      setSelectedPodDataLoading(false);
      closeTooltipTimeoutRef.current = null;
    }, TOOLTIP_CLOSE_CLEAR_DELAY_MS);
  }

  // Real-world radius in meters (scales naturally with zoom), with a minimum on-screen size.
  // Guarantee the circle is at least ~6px radius when zoomed out by converting px->meters at current zoom.
  const center = map.getCenter();
  const zoom = map.getZoom();
  const minRadiusMetersAtThisZoom = MARKER_MIN_RADIUS_PX * metersPerPixel(center.lat, zoom);
  const markerRadiusMeters = Math.max(MARKER_BASE_RADIUS_METERS, minRadiusMetersAtThisZoom);

  function flyToWithRightTooltipRoom(p: PodLocation) {
    const z = map.getZoom();
    try {
      // Put the pod slightly left of center so the right-side tooltip has room,
      // while keeping it as a single smooth animation (no follow-up pan jerk).
      const pxRadius = markerRadiusMeters / metersPerPixel(p.latitude, z);
      const dx = Math.round(TOOLTIP_ESTIMATED_WIDTH_PX / 2 + pxRadius + TOOLTIP_GAP_PX);

      // Shift the center to the RIGHT of the pod by dx pixels, so the pod appears left of center.
      const podPoint = map.project([p.latitude, p.longitude], z) as any;
      const desiredCenterPoint = podPoint.add([dx, 0]);
      const desiredCenterLatLng = map.unproject(desiredCenterPoint, z);
      map.flyTo(desiredCenterLatLng as any, z, { animate: true });
    } catch {
      try {
        map.flyTo([p.latitude, p.longitude], z, { animate: true });
      } catch {
        // no-op
      }
    }
  }

  async function selectPod(p: PodLocation) {
    const token = localStorage.getItem("eva.accessToken");
    if (!token) {
      closeTooltip();
      return;
    }

    // If a close animation is in progress, cancel it so we can switch immediately.
    if (closeTooltipTimeoutRef.current !== null) {
      window.clearTimeout(closeTooltipTimeoutRef.current);
      closeTooltipTimeoutRef.current = null;
    }

    // Single smooth movement: center with a right-side margin so the tooltip is visible,
    // without a second "pan" jerk.
    flyToWithRightTooltipRoom(p);

    setSelectedPodDataLoading(true);
    setSelectedPodData(null);
    setTooltipPodId(p.id);
    setTooltipVisible(true);

    podDataAbortRef.current?.abort();
    const ac = new AbortController();
    podDataAbortRef.current = ac;

    try {
      const res = await getPodData(p.id, ac.signal);
      const data = Array.isArray((res as any)?.data) ? ((res as any).data as unknown[]) : [];
      setSelectedPodData(data);
      setPodDataCountById((prev) => ({ ...prev, [p.id]: data.length }));
    } catch (err) {
      if ((err as any)?.name === "AbortError") return;
      setSelectedPodData([]);
      setPodDataCountById((prev) => ({ ...prev, [p.id]: 0 }));
    } finally {
      setSelectedPodDataLoading(false);
    }
  }

  // For Circles, Leaflet anchors tooltips on the center point. Offset it by the on-screen circle radius
  // so it sits fully to the right of the circle at any zoom level.
  function tooltipOffsetForPod(p: PodLocation): [number, number] {
    const pxRadius = markerRadiusMeters / metersPerPixel(p.latitude, map.getZoom());
    return [Math.round(pxRadius + TOOLTIP_GAP_PX), 0];
  }

  return (
    <>
      {pods.map((p) => (
        <Circle
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={markerRadiusMeters}
          pathOptions={{ color: "red", weight: 2, fillOpacity: 0.5 }}
          eventHandlers={{
            click: (e: any) => {
              // Prevent the map's click handler from immediately closing the tooltip.
              e?.originalEvent?.stopPropagation?.();
              lastPodClickAtRef.current = Date.now();
              void selectPod(p);
            },
          }}
        >
          {tooltipPodId === p.id ? (
            <Tooltip
              direction="right"
              offset={tooltipOffsetForPod(p)}
              opacity={tooltipVisible ? 1 : 0}
              permanent
              interactive
              className={tooltipVisible ? "pod-tooltip pod-tooltip--open" : "pod-tooltip pod-tooltip--closing"}
            >
              <div>
                <div>
                  <strong>{p.nickname || p.id}</strong>
                </div>
                <div>Visibility: {p.visibility}</div>
                <div>Last updated: {formatDate(p.lastUpdated)}</div>
                <div>
                  Data points:{" "}
                  {podDataCountById[p.id] !== undefined
                    ? podDataCountById[p.id]
                    : selectedPodDataLoading
                      ? "Loading…"
                      : (selectedPodData?.length ?? "—")}
                </div>
                <button
                  className="btn primary-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/pod/${p.id}`);
                  }}
                  style={{ marginTop: "8px", marginBottom: "0", padding: "8px 16px", fontSize: "0.875rem", width: "100%" }}
                >
                  View Full Data
                </button>
              </div>
            </Tooltip>
          ) : null}
        </Circle>
      ))}
    </>
  );
}

