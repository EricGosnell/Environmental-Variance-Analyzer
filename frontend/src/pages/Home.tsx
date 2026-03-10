import { useEffect, useRef, useState } from "react";
import MapView from "../components/Map.tsx";
import PodTable from "../components/PodTable.tsx";

import { getMe, getMeSilent } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import type { PodLocation } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";

import "../styles/Home.css";

export default function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isPodTableOpen, setIsPodTableOpen] = useState(false);
    const [podTableHeight, setPodTableHeight] = useState(33);
    const [visiblePods, setVisiblePods] = useState<PodLocation[]>([]);
    const [selectedPods, setSelectedPods] = useState<string[]>([]);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        const ac = new AbortController();

        const token = localStorage.getItem("eva.accessToken");

        if (!token) {
            setIsAuthenticated(false);
            return;
        }

        (async () => {
            try {
                const profile = await getMeSilent(ac.signal);
                setUser(profile.user);
                setIsAuthenticated(true);
            } catch {
                setUser(null);
                setIsAuthenticated(false);
            }
        })();

        return () => ac.abort();
    }, []);

    const handleZoomTo = (pods: { lat: number; lon: number }[]) => {
        if (!mapRef.current || pods.length === 0) return;
        const L = (window as any).L;
        if (!L) return;

        if (pods.length === 1) {
            mapRef.current.setView([pods[0].lat, pods[0].lon], 16);
        } else {
            const bounds = L.latLngBounds(pods.map((p) => [p.lat, p.lon]));
            mapRef.current.fitBounds(bounds, { padding: [60, 60] });
        }
    };

    return (
        <div className="homepage-container">
            <div className={`controls-container ${isAuthenticated === false ? "controls-container--unauthenticated" : ""}`}>
                {isAuthenticated && user ? (
                    <>
                        {(user.pods?.length ?? 0) === 0 && (
                            <div className="warning-message"><p>You currently have no pods registered. Register a pod to upload data.</p></div>
                        )}
                        <button className="btn primary-btn" disabled={(user.pods?.length ?? 0) === 0}>Upload EVA Data</button>
                        <br />
                        <button className="btn secondary-btn">Manage EVA Pods</button>

                        <div className="filters-container">
                            <p>Filters</p>
                        </div>
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
                <div className="map-content" style={{flex: isPodTableOpen ? `0 0 ${100 - podTableHeight}%` : '1'}}>
                    <MapView
                        mapRef={mapRef}
                        onVisiblePodsChange={setVisiblePods}
                        selectedPods={selectedPods}
                        onPodSelect={(podId) => setSelectedPods((prev) =>
                            prev.includes(podId) ? prev.filter((p) => p !== podId) : [...prev, podId]
                        )
                    }/>
                </div>

                {!isPodTableOpen && (
                    <button className="pod-table-open-btn" onClick={() => setIsPodTableOpen(true)}>
                        Pod Table
                    </button>
                )}

                <PodTable
                    isOpen={isPodTableOpen}
                    onClose={() => setIsPodTableOpen(false)}
                    onHeightChange={setPodTableHeight}
                    visiblePodIds={visiblePods.map(p => Number(p.id))}
                    selectedPods={selectedPods}
                    onSelectionChange={setSelectedPods}
                    onZoomTo={handleZoomTo}
                />
            </div>
        </div>
    );
}
