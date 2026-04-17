import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MapView from "../components/Map.tsx";
import PodTable from "../components/PodTable.tsx";

import { getMe, getMeSilent, getPodsLatestReadings } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import type { PodLocation } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";
import Filters from "../components/Filters.tsx";
import type { FiltersState } from "../components/Filters.tsx";
import { uploadTimeframeToFromDate, uploadTimeframeToToDate } from "../components/Filters.tsx";

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
        customFrom: "",
        customTo: "",
        sensorTypes: [],
        ownerFilter: "all",
        nameSearch: "",
    });
    const [availableSensorTypes, setAvailableSensorTypes] = useState<string[]>([]);
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

    useEffect(() => {
        if (visiblePods.length === 0) {
            setAvailableSensorTypes([]);
            return;
        }
        const ac = new AbortController();

        (async () => {
            try {
                const res = await getPodsLatestReadings(visiblePods.map((p) => p.id), ac.signal);
                const types = new Set<string>();
                for (const pod of res.pods) {
                    for (const key of Object.keys(pod.latestReadings)) {
                        types.add(key);
                    }
                }
                setAvailableSensorTypes((prev) => {
                    const next = Array.from(types).sort();
                    return prev.join(",") === next.join(",") ? prev : next;
                });
            } catch {
                // no-op
            }
        })();

        return () => ac.abort();
    }, [visiblePods]);

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

    const { fromDate, toDate } = useMemo(
        () => ({
            fromDate: uploadTimeframeToFromDate(filters),
            toDate: uploadTimeframeToToDate(filters),
        }),
        [filters]
    );

    const sensorTypes = useMemo(() => filters.sensorTypes, [filters.sensorTypes.join(",")]);

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
                            <button className="btn primary-btn">Manage EVA Pods</button>
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
                    availableSensorTypes={availableSensorTypes}
                    isAuthenticated={isAuthenticated}
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
                        toDate={toDate}
                        sensorTypes={sensorTypes}
                        ownerFilter={filters.ownerFilter}
                        nameSearch={filters.nameSearch}
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
                    visiblePodIds={visiblePods.map(p => p.id)}
                    selectedPods={selectedPods}
                    onSelectionChange={setSelectedPods}
                    onZoomTo={handleZoomTo}
                />
            </div>
        </div>
    );
}
