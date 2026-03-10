import { LayersControl, MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";

import "../styles/Map.css";

import Controls from "./map/Controls";
import PodMarkers from "./map/PodMarkers";
import type { PodLocation } from "../utils/apiTypes";
import type { MutableRefObject } from "react";

const MAP_VIEW_STORAGE_KEY = "eva.mapView";
const BASE_LAYER_STORAGE_KEY = "eva.baseLayer";
const BASE_LAYER_OPEN_STREET_MAP = "OpenStreetMap";
const BASE_LAYER_ESRI_SATELLITE = "ESRI Satellite";
const DEFAULT_CENTER: [number, number] = [40, -105.26];
const DEFAULT_ZOOM = 12;

type StoredMapView = {
    lat: number;
    lng: number;
    zoom: number;
};

type BaseLayerPreference = typeof BASE_LAYER_OPEN_STREET_MAP | typeof BASE_LAYER_ESRI_SATELLITE;

type MapViewProps = {
    onVisiblePodsChange: (pods: PodLocation[]) => void;
    selectedPods: string[];
    onPodSelect: (podId: string) => void;
    mapRef: MutableRefObject<any>;
};

function readSavedMapView(): StoredMapView | null {
    try {
        const raw = window.localStorage.getItem(MAP_VIEW_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<StoredMapView>;
        if (
            typeof parsed.lat !== "number"
            || typeof parsed.lng !== "number"
            || typeof parsed.zoom !== "number"
            || !Number.isFinite(parsed.lat)
            || !Number.isFinite(parsed.lng)
            || !Number.isFinite(parsed.zoom)
        ) {
            return null;
        }

        return { lat: parsed.lat, lng: parsed.lng, zoom: parsed.zoom };
    } catch {
        return null;
    }
}

function readSavedBaseLayer(): BaseLayerPreference {
    try {
        const raw = window.localStorage.getItem(BASE_LAYER_STORAGE_KEY);
        if (raw === BASE_LAYER_ESRI_SATELLITE) return BASE_LAYER_ESRI_SATELLITE;
        return BASE_LAYER_OPEN_STREET_MAP;
    } catch {
        return BASE_LAYER_OPEN_STREET_MAP;
    }
}

function PersistMapView() {
    useMapEvents({
        moveend: (event) => {
            const map = event.target;
            const center = map.getCenter();
            const zoom = map.getZoom();

            const mapView: StoredMapView = {
                lat: center.lat,
                lng: center.lng,
                zoom,
            };

            try {
                window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(mapView));
            } catch {
                // no-op
            }
        },
        baselayerchange: (event: any) => {
            const nextLayerName = event?.name;
            if (nextLayerName !== BASE_LAYER_OPEN_STREET_MAP && nextLayerName !== BASE_LAYER_ESRI_SATELLITE) return;

            try {
                window.localStorage.setItem(BASE_LAYER_STORAGE_KEY, nextLayerName);
            } catch {
                // no-op
            }
        },
    });

    return null;
}

export default function MapView({ mapRef, onVisiblePodsChange, selectedPods, onPodSelect }: MapViewProps) {
    const savedView = readSavedMapView();
    const savedBaseLayer = readSavedBaseLayer();
    const initialCenter: [number, number] = savedView ? [savedView.lat, savedView.lng] : DEFAULT_CENTER;
    const initialZoom = savedView ? savedView.zoom : DEFAULT_ZOOM;

    // Work around leafet/react-leaflet type resolution issues in this repo (missing Leaflet type declarations).
    const MapContainerAny = MapContainer as any;
    const LayersControlAny = LayersControl as any;
    const TileLayerAny = TileLayer as any;
    const ZoomControlAny = ZoomControl as any;


    return (
        <MapContainerAny
            center={initialCenter}
            zoom={initialZoom}
            zoomControl={false}
            style={{ width: "100%", height: "100%" }}
            ref={mapRef}
        >

            <ZoomControlAny position="bottomright" />
            <LayersControlAny position="bottomright">
                <LayersControlAny.BaseLayer name={BASE_LAYER_OPEN_STREET_MAP} checked={savedBaseLayer === BASE_LAYER_OPEN_STREET_MAP}>
                    <TileLayerAny url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                  attribution="&copy; OpenStreetMap contributors" />
                </LayersControlAny.BaseLayer>
                <LayersControlAny.BaseLayer name={BASE_LAYER_ESRI_SATELLITE} checked={savedBaseLayer === BASE_LAYER_ESRI_SATELLITE}>
                    <TileLayerAny url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                  attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics" />
                </LayersControlAny.BaseLayer>
            </LayersControlAny>

            <PodMarkers onPodsLoaded={onVisiblePodsChange} selectedPods={selectedPods} onPodSelect={onPodSelect} />
            <Controls />
            <PersistMapView />
        </MapContainerAny>
    );
}
