import { useEffect, useState } from "react";
import MapView from "../components/Map.tsx";
import PodTable from "../components/PodTable.tsx";

import { getMe } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";

import "../styles/Home.css";

export default function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isPodTableOpen, setIsPodTableOpen] = useState(false);
    const [podTableHeight, setPodTableHeight] = useState(33);

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
                    <MapView />
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
                />
            </div>
        </div>
    );
}
