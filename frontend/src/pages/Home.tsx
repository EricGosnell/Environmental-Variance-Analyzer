import { useEffect, useState } from "react";
import MapView from "../components/Map.tsx";
import AddDataModal from "../components/AddDataModal.tsx";

import { getMe, uploadPodData } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";

import "../styles/Home.css";

export default function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [showAddDataModal, setShowAddDataModal] = useState(false);
    const ownedPodsCount = user?.pods?.length ?? 0;

    const handleModalUpload = async (payload: {
        file: File | null;
        podId: string;
        latitude?: number;
        longitude?: number;
        podDataNotes: string;
    }) => {
        if (!payload.file) {
            alert("Please select an NDJSON file before uploading.");
            return;
        }

        try {
            await uploadPodData({
                podId: payload.podId,
                data: payload.file,
                notes: payload.podDataNotes || undefined,
                latitude: payload.latitude,
                longitude: payload.longitude,
            });
            setShowAddDataModal(false);
        } catch (e: any) {
            alert(e?.message ? String(e.message) : "Failed to upload data.");
        }
    };

    useEffect(() => {
        const ac = new AbortController();

        const token = localStorage.getItem("eva.accessToken");

        if (!token) {
            setIsAuthenticated(false);
            return;
        }

        (async () => {
            try {
                const profile = await getMe(ac.signal);
                setUser(profile.user);
                setIsAuthenticated(true);
            } catch {
                setUser(null);
                setIsAuthenticated(false);
            }
        })();

        return () => ac.abort();
    }, []);

    return (
        <div className="homepage-container">
            <div className={`controls-container ${isAuthenticated === false ? "controls-container--unauthenticated" : ""}`}>
                {isAuthenticated && user ? (
                    <>
                        {(user.pods?.length ?? 0) === 0 && (
                            <div className="warning-message"><p>You currently have no pods registered. Register a pod to upload data.</p></div>
                        )}
                        <button
                            className="btn primary-btn"
                            disabled={ownedPodsCount === 0}
                            onClick={() => setShowAddDataModal(true)}
                        >
                            Upload EVA Data
                        </button>
                        <br />
                        <button className="btn secondary-btn">Manage EVA Pods</button>

                        <div className="filters-container">
                            <p>Filters</p>
                        </div>
                        <AddDataModal
                            show={showAddDataModal}
                            onCancel={() => setShowAddDataModal(false)}
                            pods={user.pods ?? []}
                            onUpload={handleModalUpload}
                        />
                    </>
                ) : null}

                {isAuthenticated === false ? (
                    <AuthPanel
                        onAuthSuccess={async () => {
                            try {
                                const profile = await getMe();
                                setUser(profile.user);
                                setIsAuthenticated(true);
                            } catch {
                                setUser(null);
                                setIsAuthenticated(false);
                            }
                        }}
                    />
                ) : null}
            </div>
            <div className="map-container">
                <MapView />
            </div>
        </div>
    )
}
