import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Circle, Marker, Tooltip, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import * as L from "leaflet";

import { getPodData, getPodLocations, getPodsLatestReadings } from "../../utils/api";
import type { PodLocation } from "../../utils/apiTypes";
import {
  circleTooltipOffset,
  formatPodLastUpdated,
  MARKER_BASE_RADIUS_METERS,
  MARKER_MIN_VISIBLE_RADIUS_PX,
  metersPerPixel,
  pinTooltipOffset,
  radiusFromViewportMeters,
  shouldUsePinAtZoom,
} from "./podMarkerUtils";

const EVENT_SEARCH_AREA = "searcharea";

const MAP_CLICK_SUPPRESS_MS = 250;
const TOOLTIP_CLOSE_CLEAR_DELAY_MS = 150;

const PIN_ICON_WIDTH_PX = 24;
const PIN_ICON_HEIGHT_PX = 24;

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

type PodTooltipContentProps = {
  pod: PodLocation;
  selectedPodData: unknown[] | null;
  selectedPodDataLoading: boolean;
  podDataCountById: Record<string, number>;
  onViewFullData: (podId: string, event: MouseEvent<HTMLButtonElement>) => void;
};

type PodMarkersProps = {
  onPodsLoaded: (pods: PodLocation[]) => void;
  selectedPods: string[];
  onPodSelect: (podId: string) => void;
  fromDate?: string;
  toDate?: string;
  sensorTypes: string[];
  ownerFilter: "all" | "owned";
  nameSearch: string;
};

function PodTooltipContent({
                             pod,
                             selectedPodData,
                             selectedPodDataLoading,
                             podDataCountById,
                             onViewFullData,
                           }: PodTooltipContentProps) {
  return (
      <div>
        <div>
          <strong>{pod.nickname || pod.id}</strong>
        </div>
        <div>Visibility: {pod.visibility}</div>
        <div>Last updated: {formatPodLastUpdated(pod.lastUpdated)}</div>
        <div>
          Data points:{" "}
          {podDataCountById[pod.id] !== undefined
              ? podDataCountById[pod.id]
              : selectedPodDataLoading
                  ? "Loading…"
                  : (selectedPodData?.length ?? "—")}
        </div>
        <button
            className="btn primary-btn"
            onClick={(e) => onViewFullData(pod.id, e)}
            style={{ marginTop: "8px", marginBottom: "0", padding: "8px 16px", fontSize: "0.875rem", width: "100%" }}
        >
          View Full Data
        </button>
      </div>
  );
}

export default function PodMarkers({ onPodsLoaded, selectedPods, onPodSelect, fromDate, toDate, sensorTypes, ownerFilter, nameSearch }: PodMarkersProps) {
  const navigate = useNavigate();
  const [pods, setPods] = useState<PodLocation[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const podDataAbortRef = useRef<AbortController | null>(null);
  const lastPodClickAtRef = useRef<number>(0);
  const closeTooltipTimeoutRef = useRef<number | null>(null);
  const fromDateRef = useRef<string | undefined>(fromDate);
  fromDateRef.current = fromDate;
  const toDateRef = useRef<string | undefined>(toDate);
  toDateRef.current = toDate;
  const sensorTypesRef = useRef<string[]>(sensorTypes);
  sensorTypesRef.current = sensorTypes;
  const ownerFilterRef = useRef<"all" | "owned">(ownerFilter);
  ownerFilterRef.current = ownerFilter;

  const [selectedPodData, setSelectedPodData] = useState<unknown[] | null>(null);
  const [selectedPodDataLoading, setSelectedPodDataLoading] = useState(false);
  const [podDataCountById, setPodDataCountById] = useState<Record<string, number>>({});
  const [tooltipPodId, setTooltipPodId] = useState<string | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(12);

  const pinIcon = useMemo(
      () =>
          L.divIcon({
            className: "pod-pin-icon",
            html: '<span class="pod-pin-marker" aria-hidden="true"></span>',
            iconSize: [PIN_ICON_WIDTH_PX, PIN_ICON_HEIGHT_PX],
            iconAnchor: [PIN_ICON_WIDTH_PX / 2, PIN_ICON_HEIGHT_PX],
          }),
      [],
  );
  const selectedPinIcon = useMemo(
      () =>
          L.divIcon({
            className: "pod-pin-icon pod-pin-icon--selected",
            html: '<span class="pod-pin-marker pod-pin-marker--selected" aria-hidden="true"></span>',
            iconSize: [PIN_ICON_WIDTH_PX, PIN_ICON_HEIGHT_PX],
            iconAnchor: [PIN_ICON_WIDTH_PX / 2, PIN_ICON_HEIGHT_PX],
          }),
      [],
  );

  const pinIconOwned = useMemo(
      () =>
          L.divIcon({
            className: "pod-pin-icon",
            html: '<span class="pod-pin-marker pod-pin-marker-owned" aria-hidden="true"></span>',
            iconSize: [PIN_ICON_WIDTH_PX, PIN_ICON_HEIGHT_PX],
            iconAnchor: [PIN_ICON_WIDTH_PX / 2, PIN_ICON_HEIGHT_PX],
          }),
      [],
  );

  async function fetchPods(map: MapLike) {
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
            fromDate: fromDateRef.current,
            toDate: toDateRef.current,
          },
          ac.signal,
      );
      let loadedPods = Array.isArray(res.pods) ? res.pods : [];

      if (ownerFilterRef.current === "owned") {
        loadedPods = loadedPods.filter((p) => p.isOwner);
      }

      if (sensorTypesRef.current.length > 0 && loadedPods.length > 0) {
        const ids = loadedPods.map((p) => p.id);
        try {
          const { pods: readings } = await getPodsLatestReadings(ids, ac.signal);
          const readingsById = new Map(readings.map((r) => [r.podId, r.latestReadings]));
          loadedPods = loadedPods.filter((p) => {
            const podReadings = readingsById.get(p.id);
            if (!podReadings) return false;
            return sensorTypesRef.current.every((type) => {
              const reading = podReadings[type];
              return reading !== undefined;
            });
          });
        } catch (err) {
          if ((err as any)?.name === "AbortError") return;
          loadedPods = [];
        }
      }

      setPods(loadedPods);
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
    zoomend: () => {
      setZoomLevel(map.getZoom());
    },
  } as any) as unknown as MapLike;

  useEffect(() => {
    setZoomLevel(map.getZoom());
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

  useEffect(() => {
    const handleLogin = () => void fetchPods(map as unknown as MapLike);
    window.addEventListener("eva.login", handleLogin);
    return () => window.removeEventListener("eva.login", handleLogin);
  }, [map]);

  const sensorTypesKey = sensorTypes.join(",");

  const filtersMountedRef = useRef(false);
  useEffect(() => {
    if (!filtersMountedRef.current) {
      filtersMountedRef.current = true;
      return;
    }
    void fetchPods(map as unknown as MapLike);
  // nameSearch is intentionally excluded — name filtering is done client-side on visiblePods,
  // so no server refetch is needed when it changes.
  }, [fromDate, toDate, sensorTypesKey, ownerFilter]);

  const visiblePods = useMemo(() => {
    const query = nameSearch.trim().toLowerCase();
    return query
        ? pods.filter((p) => (p.nickname ?? p.id).toLowerCase().includes(query))
        : pods;
  }, [pods, nameSearch]);

  const onPodsLoadedRef = useRef(onPodsLoaded);
  onPodsLoadedRef.current = onPodsLoaded;

  useEffect(() => {
    onPodsLoadedRef.current(visiblePods);
  }, [visiblePods]);

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

  // Keep pod coverage radius stable in real-world units (meters), independent of zoom level.
  const markerRadiusMeters = MARKER_BASE_RADIUS_METERS;

  function flyToWithRightTooltipRoom(p: PodLocation) {
    const z = map.getZoom();
    try {
      // Put the pod slightly left of center so the right-side tooltip has room,
      // while keeping it as a single smooth animation (no follow-up pan jerk).
      const pxRadius = markerRadiusMeters / metersPerPixel(p.latitude, z);
      const markerHalfWidthPx = shouldUsePinAtZoom(markerRadiusMeters, p.latitude, z, MARKER_MIN_VISIBLE_RADIUS_PX)
          ? PIN_ICON_WIDTH_PX / 2
          : pxRadius;
      const dx = Math.round(TOOLTIP_ESTIMATED_WIDTH_PX / 2 + markerHalfWidthPx + TOOLTIP_GAP_PX);

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
  function tooltipOffsetForPod(p: PodLocation, isPin: boolean): [number, number] {
    if (isPin) return pinTooltipOffset(PIN_ICON_WIDTH_PX, PIN_ICON_HEIGHT_PX, TOOLTIP_GAP_PX);
    return circleTooltipOffset(markerRadiusMeters, p.latitude, zoomLevel, TOOLTIP_GAP_PX);
  }

  function handlePodClick(p: PodLocation, e: any) {
    // Prevent the map's click handler from immediately closing the tooltip.
    e?.originalEvent?.stopPropagation?.();
    lastPodClickAtRef.current = Date.now();
    onPodSelect(p.id);
    void selectPod(p);
  }

  function handleViewFullData(podId: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    navigate(`/pod/${podId}`);
  }

  return (
      <>
        {visiblePods.map((p) => {
          const isPin = shouldUsePinAtZoom(markerRadiusMeters, p.latitude, zoomLevel, MARKER_MIN_VISIBLE_RADIUS_PX);
          const isSelected = selectedPods.includes(p.id);
          const tooltip = tooltipPodId === p.id ? (
              <Tooltip
                  key={`tooltip-${p.id}-${zoomLevel}`}
                  direction="right"
                  offset={tooltipOffsetForPod(p, isPin)}
                  opacity={tooltipVisible ? 1 : 0}
                  permanent
                  interactive
                  className={tooltipVisible ? "pod-tooltip pod-tooltip--open" : "pod-tooltip pod-tooltip--closing"}
              >
                <PodTooltipContent
                    pod={p}
                    selectedPodData={selectedPodData}
                    selectedPodDataLoading={selectedPodDataLoading}
                    podDataCountById={podDataCountById}
                    onViewFullData={handleViewFullData}
                />
              </Tooltip>
          ) : null;

          if (isPin) {
            return (
                <Marker
                    key={p.id}
                    position={[p.latitude, p.longitude]}
                    icon={isSelected ? selectedPinIcon : p.isOwner ? pinIconOwned : pinIcon}
                    eventHandlers={{
                      click: (e: any) => handlePodClick(p, e),
                    }}
                >
                  {tooltip}
                </Marker>
            );
          }

          return (
              <Circle
                  key={p.id}
                  center={[p.latitude, p.longitude]}
                  radius={markerRadiusMeters}
                  pathOptions={
                    isSelected
                        ? { color: "#25b6eb", weight: 3, fillOpacity: 0.6 }
                        : p.isOwner
                            ? { color: "#30A46C", weight: 2, fillOpacity: 0.5 }
                            : { color: "red", weight: 2, fillOpacity: 0.5 }
                  }
                  eventHandlers={{
                    click: (e: any) => handlePodClick(p, e),
                  }}
              >
                {tooltip}
              </Circle>
          );
        })}
      </>
  );
}
