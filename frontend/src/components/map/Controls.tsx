import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { shouldUsePinAtZoom } from "./podMarkerUtils"

import * as L from "leaflet";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - this package ships without types in this repo; we only need the side-effect import to register the control.
import "leaflet-control-geocoder";

function Geocoder() {
  const map = useMap();

  useEffect(() => {
    const geocoder = (L as any).Control.geocoder({
      defaultMarkGeocode: true,
      position: "topleft",
      collapsed: false,
    }).addTo(map);

    let container: HTMLElement | undefined;
    let input: HTMLInputElement | null = null;
    const clearResultsIfEmpty = () => {
      if (!container || !input) return;
      if (input.value.trim() !== "") return;

      const alts = container.querySelector(".leaflet-control-geocoder-alternatives") as HTMLElement | null;
      if (alts) alts.innerHTML = "";
    };

    try {
      container = (geocoder as any)?.getContainer?.() as HTMLElement | undefined;
      input = container?.querySelector('input[type="search"], input') as HTMLInputElement | null;

      // Clear stale results when the input is cleared (backspace or the native "x" clear button).
      input?.addEventListener("input", clearResultsIfEmpty);
      input?.addEventListener("search", clearResultsIfEmpty);
    } catch {
      // no-op
    }

    return () => {
      try {
        // Ensure we don't leave listeners behind.
        input?.removeEventListener("input", clearResultsIfEmpty);
        input?.removeEventListener("search", clearResultsIfEmpty);
      } catch {
        // no-op
      }
      map.removeControl(geocoder);
    };
  }, [map]);

  return null;
}

const MARKER_BASE_RADIUS_METERS = 50;
const MARKER_MIN_VISIBLE_RADIUS_PX = 8;
function LegendControl() {
  const map = useMap() as any;

  useEffect(() => {
    const control: any = (L as any).control({ position: "topright" });

    let swatch: HTMLElement | null = null;
    function updateSwatch() {
      if (!swatch) return;
      const center = map.getCenter();
      const zoom = map.getZoom();
      const isPin = shouldUsePinAtZoom(MARKER_BASE_RADIUS_METERS, center.lat, zoom, MARKER_MIN_VISIBLE_RADIUS_PX);

      if (isPin) {
        swatch.className = "pod-pin-icon eva-legend-swatch-pin";
        swatch.innerHTML = '<span class="pod-pin-marker" aria-hidden="true"></span>';
      } else {
        swatch.className = "eva-legend-swatch";
        swatch.innerHTML = "";
      }
    }

    control.onAdd = () => {
      // Reuse existing Leaflet control styling from Map.css by using leaflet-control-layers classes.
      const div = (L as any).DomUtil.create("div", "leaflet-control-layers leaflet-control eva-legend");
      div.innerHTML = ``;
      swatch = (L as any).DomUtil.create("span", "eva-legend-swatch");

      const row = (L as any).DomUtil.create("div", "eva-legend-row", div);
      row.appendChild(swatch);

      const label = (L as any).DomUtil.create("span", "", row);
      label.textContent = "EVA Pod";

      (L as any).DomEvent.disableClickPropagation(div);
      (L as any).DomEvent.disableScrollPropagation(div);

      updateSwatch();

      return div;
    };

    control.addTo(map);
    map.on("zoomend", updateSwatch);

    return () => {
      map.off("zoomend", updateSwatch);
      try {
        control?.remove?.();
      } catch {
        // no-op
      }
    };
  }, [map]);

  return null;
}

function SearchAreaControl() {
  const map = useMap() as any;

  useEffect(() => {
    const control: any = (L as any).control({ position: "topleft" });
    control.onAdd = () => {
      const div = (L as any).DomUtil.create("div", "leaflet-control-layers leaflet-control eva-search-area");
      const button = (L as any).DomUtil.create("button", "eva-search-area-button");
      button.textContent = "Search this area";
      button.type = "button";

      button.addEventListener("click", () => {
        // Trigger fetchPods by dispatching a custom event that PodMarkers can listen to
        map.fire("searcharea");
      });

      div.appendChild(button);
      (L as any).DomEvent.disableClickPropagation(div);
      (L as any).DomEvent.disableScrollPropagation(div);
      return div;
    };
    control.addTo(map);

    return () => {
      try {
        control?.remove?.();
      } catch {
        // no-op
      }
    };
  }, [map]);

  return null;
}

export default function Controls() {
  // Preserve the existing add-to-map ordering:
  // Legend (top-right), then Geocoder (top-left), then Search this area (top-left).
  return (
    <>
      <LegendControl />
      <Geocoder />
      <SearchAreaControl />
    </>
  );
}
