import { MapContainer, TileLayer, LayersControl, ZoomControl } from "react-leaflet";

export default function MapView() {
    return (
        <MapContainer
            center={[40, -105.26]}
            zoom={12}
            zoomControl={false}
            style={{ width: "100%", height: "100%" }}
        >

        <ZoomControl position="bottomright" />
        <LayersControl position="bottomright">
            <LayersControl.BaseLayer name="OpenStreetMap" checked>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                           attribution="&copy; OpenStreetMap contributors"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="ESRI Satellite">
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                           attribution="Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics"/>
            </LayersControl.BaseLayer>
        </LayersControl>

        </MapContainer>
    );
}
