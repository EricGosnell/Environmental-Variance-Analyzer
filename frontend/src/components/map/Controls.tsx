import { useEffect } from "react";
import { useMap } from "react-leaflet";

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
    control.onAdd = () => {
      // Reuse existing Leaflet control styling from Map.css by using leaflet-control-layers classes.
      const div = (L as any).DomUtil.create("div", "leaflet-control-layers leaflet-control eva-legend");
      div.innerHTML = `
        <div class="eva-legend-row">
          <span class="eva-legend-swatch" aria-hidden="true"></span>
          <span>EVA Pod</span>
        </div>
      `;
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
            const { latitude, longitude } = position.coords;
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

    return () => {
      try {
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
