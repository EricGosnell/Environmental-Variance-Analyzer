import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { MARKER_BASE_RADIUS_METERS, MARKER_MIN_VISIBLE_RADIUS_PX, shouldUsePinAtZoom } from "./podMarkerUtils";

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

function UserLocationControl() {
  const locate_button_icon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="vertical-align: middle; margin-right: 6px;">
      <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      <line x1="12" y1="0" x2="12" y2="4" stroke="currentColor" stroke-width="2"/> 
      <line x1="20" y1="12" x2="24" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="20" x2="12" y2="24" stroke="currentColor" stroke-width="2"/>
      <line x1="0" y1="12" x2="4" y2="12" stroke="currentColor" stroke-width="2"/>
    </svg>`
  const map = useMap() as any;

  useEffect(() => {
    let userMarker: any = null;
    let userAccuracy: number = 0;
    let userCoords: [number, number] | null = null;

    const updateMarkerSize = () => {
      // Updates blue circle marker based on map zoom level so it stays geographically accurate
      if (!userMarker || !userAccuracy || !userCoords) return;

      const zoom = map.getZoom();
      const metersPerPixel = 40075016.686 * Math.abs(Math.cos(userCoords[0] * Math.PI / 180)) / Math.pow(2, zoom + 8);
      const radiusInPixels = userAccuracy / metersPerPixel;
      const diameterInPixels = Math.min(radiusInPixels * 2, 2000);

      const icon = (L as any).divIcon({
        className: 'user-location-marker',
        html: `
          <div class="user-location-dot"></div>
          <div class="user-location-circle" style="width: ${diameterInPixels}px; height: ${diameterInPixels}px;"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarker.setIcon(icon);
    };

    const control: any = (L as any).control({ position: "topleft" });
    control.onAdd = () => {
      const div = (L as any).DomUtil.create("div", "leaflet-control-layers leaflet-control user-location");
      const button = (L as any).DomUtil.create("button", "user-location-button");
      button.innerHTML = locate_button_icon+"My Location";

      button.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("Geolocation is not supported by your browser");
          return;
        }

        // Show loading state
        button.disabled = true;
        button.innerHTML = locate_button_icon+"Locating...";

        // Get user location
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            // Store accuracy and coords for zoom updates
            userAccuracy = accuracy;
            userCoords = [latitude, longitude];

            // Remove existing marker if any
            if (userMarker) {
              map.removeLayer(userMarker);
            }

            // Calculate accuracy radius in pixels
            const zoom = map.getZoom();
            const metersPerPixel = 40075016.686 * Math.abs(Math.cos(latitude * Math.PI / 180)) / Math.pow(2, zoom + 8);
            const radiusInPixels = accuracy / metersPerPixel;
            const diameterInPixels = Math.min(radiusInPixels * 2, 2000); // Max size: 2000px

            // Draw blue dot at user location
            const userLocationIcon = (L as any).divIcon({
              className: 'user-location-marker',
              html: `
                <div class="user-location-dot"></div>
                <div class="user-location-circle" style="width: ${diameterInPixels}px; height: ${diameterInPixels}px;"></div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            // Add marker at user location
            userMarker = (L as any).marker([latitude, longitude], {
              icon: userLocationIcon,
              zIndexOffset: 1000
            }).addTo(map);

            map.flyTo([latitude, longitude], 17, {
              duration: 1
            });

            // Reset button state
            button.disabled = false;
            button.innerHTML = locate_button_icon+"My Location";
          },
          (error) => {
            console.error("Error getting location:", error);
            alert("Unable to retrieve your location");

            // Reset button state
            button.disabled = false;
            button.innerHTML = locate_button_icon+"My Location";
          }
        );
      });

      div.appendChild(button);
      (L as any).DomEvent.disableClickPropagation(div);
      (L as any).DomEvent.disableScrollPropagation(div);
      return div;
    };
    control.addTo(map);

    // Update blue circle when map zooms
    map.on('zoomend', updateMarkerSize);

    return () => {
      try {
        map.off('zoomend', updateMarkerSize);
        if (userMarker) {
          map.removeLayer(userMarker);
        }
        control?.remove?.();
      } catch {}
    };
  }, [map]);

  return null;
}

export default function Controls() {
  // Preserve the existing add-to-map ordering:
  // Legend (top-right), then Geocoder (top-left), then Search this area (top-left), then User Location (top-left).
  return (
    <>
      <LegendControl />
      <Geocoder />
      <SearchAreaControl />
      <UserLocationControl />
    </>
  );
}
