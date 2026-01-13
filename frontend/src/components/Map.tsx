import { useEffect, useRef, useState } from "react";
import { Circle, LayersControl, MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";

import { getPodLocations } from "../utils/api";
import type { PodLocation } from "../utils/apiTypes";

function metersPerPixel(latitude: number, zoom: number): number {
  // Web Mercator approximate meters-per-pixel at given latitude.
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

function radiusFromViewportMeters(centerLat: number, zoom: number, widthPx: number, heightPx: number): number {
  const mpp = metersPerPixel(centerLat, zoom);
  // Roughly cover the visible viewport (half of the max dimension).
  return Math.max(1, Math.round(mpp * Math.max(widthPx, heightPx) * 0.5));
}

function PodMarkers() {
  const [pods, setPods] = useState<PodLocation[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchPods(map: any) {
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
    moveend: () => {
      void fetchPods(map);
    },
    zoomend: () => {
      void fetchPods(map);
    },
  });

  useEffect(() => {
    void fetchPods(map);
    return () => abortRef.current?.abort();
    // map is stable for the lifetime of the MapContainer
  }, [map]);

  // Real-world radius in meters (scales naturally with zoom), with a minimum on-screen size.
  // Guarantee the circle is at least ~6px radius when zoomed out by converting px->meters at current zoom.
  const baseRadiusMeters = 50;
  const minRadiusPx = 6;
  const center = map.getCenter();
  const zoom = map.getZoom();
  const minRadiusMetersAtThisZoom = minRadiusPx * metersPerPixel(center.lat, zoom);
  const markerRadiusMeters = Math.max(baseRadiusMeters, minRadiusMetersAtThisZoom);

  return (
    <>
      {pods.map((p) => (
        <Circle
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={markerRadiusMeters}
          pathOptions={{ color: "red", weight: 2, fillOpacity: 0.5 }}
        />
      ))}
    </>
  );
}

export default function MapView() {
    // Work around leafet/react-leaflet type resolution issues in this repo (missing Leaflet type declarations).
    const MapContainerAny = MapContainer as any;
    const LayersControlAny = LayersControl as any;
    const TileLayerAny = TileLayer as any;
    const ZoomControlAny = ZoomControl as any;

    return (
        <MapContainerAny
            center={[40, -105.26]}
            zoom={12}
            zoomControl={false}
            style={{ width: "100%", height: "100%" }}
        >

        <ZoomControlAny position="bottomright" />
        <LayersControlAny position="bottomright">
            <LayersControlAny.BaseLayer name="OpenStreetMap" checked>
                <TileLayerAny url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                           attribution="&copy; OpenStreetMap contributors"
                />
            </LayersControlAny.BaseLayer>

            <LayersControlAny.BaseLayer name="ESRI Satellite">
                <TileLayerAny url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                           attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"/>
            </LayersControlAny.BaseLayer>
        </LayersControlAny>

        <PodMarkers />

        </MapContainerAny>
    );
}
