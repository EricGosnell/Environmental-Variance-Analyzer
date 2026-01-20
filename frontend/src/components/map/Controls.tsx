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

    return () => {
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


