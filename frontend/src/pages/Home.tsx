import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MapView from "../components/Map.tsx";
import PodTable from "../components/PodTable.tsx";

import { getMe, getMeSilent } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import type { PodLocation } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";
import Filters from "../components/Filters.tsx";
import type { FiltersState } from "../components/Filters.tsx";
import { uploadTimeframeToFromDate } from "../components/Filters.tsx";

import "../styles/Home.css";

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isPodTableOpen, setIsPodTableOpen] = useState(false);
    const [podTableHeight, setPodTableHeight] = useState(33);
    const [visiblePods, setVisiblePods] = useState<PodLocation[]>([]);
    const [selectedPods, setSelectedPods] = useState<string[]>([]);
    const [filters, setFilters] = useState<FiltersState>({
        uploadTimeframe: "any",
    });
    const mapRef = useRef<any>(null);
    const [showVerifiedBanner, setShowVerifiedBanner] = useState(false);

    const authParam = searchParams.get("auth");
    const emailParam = searchParams.get("email") ?? "";
    const verifiedParam = searchParams.get("verified");
    const authPanelKey = authParam === "login" ? `login:${emailParam}` : "default";

    useEffect(() => {
        if (verifiedParam !== "1") return;
        setShowVerifiedBanner(true);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("verified");
        setSearchParams(nextParams, { replace: true });
    }, [verifiedParam, searchParams, setSearchParams]);

    useEffect(() => {
        if (isAuthenticated) {
            setShowVerifiedBanner(false);
        }
    }, [isAuthenticated]);

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

    const handleVisiblePodsChange = useCallback((pods: PodLocation[]) => {
        setVisiblePods((prev) => {
            const prevIds = prev.map((p) => p.id).join(",");
            const nextIds = pods.map((p) => p.id).join(",");
            return prevIds === nextIds ? prev : pods;
        });
    }, []);

    const handlePodSelect = useCallback((podId: string) => {
        setSelectedPods((prev) =>
            prev.includes(podId) ? prev.filter((p) => p !== podId) : [...prev, podId]
        );
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

    const fromDate = uploadTimeframeToFromDate(filters.uploadTimeframe);

    return (
        <div className="homepage-container">
            <div className="sidebar">
                <div className={`controls-container ${isAuthenticated === false ? "controls-container--unauthenticated" : ""}`}>
                    {showVerifiedBanner && (
                        <div className="home-info-banner" role="status">
                            <p>Email verified. Please log in to continue.</p>
                            <button type="button" className="home-info-banner-dismiss" onClick={() => setShowVerifiedBanner(false)}>
                                Dismiss
                            </button>
                        </div>
                    )}

                    {isAuthenticated && user ? (
                        <>
                            {(user.pods?.length ?? 0) === 0 && (
                                <div className="warning-message"><p>You currently have no pods registered. Register a pod to upload data.</p></div>
                            )}
                            <button className="btn primary-btn" disabled={(user.pods?.length ?? 0) === 0}>Upload EVA Data</button>
                            <br />
                            <button className="btn secondary-btn">Manage EVA Pods</button>
                        </>
                    ) : null}

                    {isAuthenticated === false ? (
                        <AuthPanel
                            key={authPanelKey}
                            initialMode={authParam === "login" ? "login" : undefined}
                            initialLoginEmail={authParam === "login" ? emailParam : undefined}
                            onAuthSuccess={async () => {
                                try {
                                    const profile = await getMe();
                                    setUser(profile.user);
                                    setIsAuthenticated(true);
                                    window.dispatchEvent(new Event("eva.login"));
                                } catch {
                                    setUser(null);
                                    setIsAuthenticated(false);
                                }
                            }}
                        />
                    ) : null}
                </div>
                <Filters
                    filters={filters}
                    onChange={setFilters}
                />
            </div>


            <div className="map-container">
                <div className="map-content" style={{flex: isPodTableOpen ? `0 0 ${100 - podTableHeight}%` : '1'}}>
                    <MapView
                        mapRef={mapRef}
                        onVisiblePodsChange={handleVisiblePodsChange}
                        selectedPods={selectedPods}
                        onPodSelect={handlePodSelect}
                        isAuthenticated={isAuthenticated}
                        fromDate={fromDate}
                    />
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
