import { MapContainer, TileLayer } from "react-leaflet";

export default function MapView() {
    return (
        <MapContainer
            center={[40, -105.26]}
            zoom={12}
            style={{ width: "100%", height: "100%" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
            />
        </MapContainer>
    );
}
