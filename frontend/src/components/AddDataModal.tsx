import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";

import "../styles/Map.css";
import "../styles/AddDataModal.css";
import type { UserPod } from "../utils/apiTypes";

type AddDataModalProps = {
  show: boolean;
  onCancel: () => void;
  pods?: UserPod[];
  initialPodId?: string;
  onUpload?: (payload: {
    file: File | null;
    podId: string;
    latitude?: number;
    longitude?: number;
    podDataNotes: string;
  }) => void;
};

const DEFAULT_CENTER: [number, number] = [40, -105.26];

function MapCenterTracker({
  onCenterChange,
}: {
  onCenterChange: (latitude: number, longitude: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onCenterChange(center.lat, center.lng);
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onCenterChange(center.lat, center.lng);
  }, [map, onCenterChange]);

  return null;
}

function RecenterMap({ center }: { center: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo(center, 17, { duration: 1 });
  }, [map, center]);

  return null;
}

const AddDataModal: React.FC<AddDataModalProps> = ({ show, onCancel, pods, initialPodId, onUpload }) => {
  const MapContainerAny = MapContainer as any;
  const TileLayerAny = TileLayer as any;
  const ZoomControlAny = ZoomControl as any;

  const [file, setFile] = useState<File | null>(null);
  const [podId, setPodId] = useState<string>("");
  const [podDataNotes, setPodDataNotes] = useState<string>("");
  const [updateLocation, setUpdateLocation] = useState<boolean>(false);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locating, setLocating] = useState<boolean>(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateCenter, setLocateCenter] = useState<[number, number] | null>(null);
  const ownedPods = pods ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    setFile(selected);
  };
  

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpload) {
      onUpload({
        file,
        podId,
        latitude: updateLocation ? latitude : undefined,
        longitude: updateLocation ? longitude : undefined,
        podDataNotes,
      });
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }

    setLocateError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter: [number, number] = [position.coords.latitude, position.coords.longitude];
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocateCenter(nextCenter);
        setLocating(false);
      },
      () => {
        setLocateError("Unable to retrieve your location. You can still pan/zoom the map to pick a location.");
        setLocating(false);
      }
    );
  };

  useEffect(() => {
    if (!updateLocation) {
      setLatitude(undefined);
      setLongitude(undefined);
      setLocateError(null);
      setLocateCenter(null);
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      setLatitude(DEFAULT_CENTER[0]);
      setLongitude(DEFAULT_CENTER[1]);
    }
  }, [updateLocation, latitude, longitude]);

  useEffect(() => {
    if (ownedPods.length === 0) {
      setPodId("");
      return;
    }

    if (!ownedPods.some((pod) => String(pod.id) === podId)) {
      setPodId(String(ownedPods[0].id));
    }
  }, [ownedPods, podId]);

  useEffect(() => {
    if (!show) return;
    if (!initialPodId) return;
    if (!ownedPods.some((pod) => String(pod.id) === initialPodId)) return;
    setPodId(initialPodId);
  }, [show, initialPodId, ownedPods]);

  if (!show) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Upload EVA Data">
      <div className="modal">
        <header className="modal-header">
          <h2>Upload EVA Data</h2>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              File
              <input
                type="file"
                name="evaFile"
                accept=".ndjson,application/x-ndjson,application/ndjson"
                onChange={handleFileChange}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Pod ID
              <select
                name="podId"
                value={podId}
                onChange={(e) => setPodId(e.target.value)}
                disabled={ownedPods.length === 0}
                required
              >
                {ownedPods.length === 0 ? <option value="">No owned pods available</option> : null}
                {ownedPods.map((pod) => (
                  <option key={pod.id} value={String(pod.id)}>
                    {`${pod.name} (${pod.id})`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label className="checkbox-row">
              <input
                type="checkbox"
                name="updateLocation"
                checked={updateLocation}
                onChange={(e) => setUpdateLocation(e.target.checked)}
              />
              <span>Update location?</span>
            </label>
          </div>
          {updateLocation ? (
            <div className="form-row">
              {locateError ? <div>{locateError}</div> : null}
              <div>
                {typeof latitude === "number" && typeof longitude === "number"
                  ? `Selected location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                  : "Selected location: not set"}
              </div>
              <div className="map-container upload-location-map">
                <div className="modal-map-locate-control">
                  <button
                    type="button"
                    className="user-location-button"
                    onClick={handleLocateMe}
                    disabled={locating}
                    aria-label="Locate me"
                    title={locating ? "Locating..." : "Locate me"}
                    data-locating={locating ? "true" : "false"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
                      <circle cx="12" cy="12" r="4" fill="currentColor" />
                      <line x1="12" y1="0" x2="12" y2="4" stroke="currentColor" strokeWidth="2" />
                      <line x1="20" y1="12" x2="24" y2="12" stroke="currentColor" strokeWidth="2" />
                      <line x1="12" y1="20" x2="12" y2="24" stroke="currentColor" strokeWidth="2" />
                      <line x1="0" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </button>
                </div>
                <MapContainerAny
                  center={locateCenter ?? DEFAULT_CENTER}
                  zoom={13}
                  zoomControl={false}
                  style={{ width: "100%", height: "100%" }}
                >
                  <ZoomControlAny position="bottomright" />
                  <TileLayerAny
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                  <MapCenterTracker onCenterChange={(lat, lon) => {
                    setLatitude(lat);
                    setLongitude(lon);
                  }} />
                  <RecenterMap center={locateCenter} />
                </MapContainerAny>
                <div className="modal-map-center-pin">
                  <div className="user-location-dot" />
                </div>
              </div>
            </div>
          ) : null}
          <div className="form-row">
            <label>
              Notes
              <textarea
                name="podDataNotes"
                value={podDataNotes}
                onChange={(e) => setPodDataNotes(e.target.value)}
                rows={3}
              />
            </label>
          </div>
          <footer className="modal-footer">
            <button type="button" className="btn secondary-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn primary-btn">
              Upload
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddDataModal;
