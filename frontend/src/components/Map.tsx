import { LayersControl, MapContainer, TileLayer, ZoomControl } from "react-leaflet";

import "../styles/Map.css";

import Controls from "./map/Controls";
import PodMarkers from "./map/PodMarkers";

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
        <Controls />


        </MapContainerAny>
    );
}
