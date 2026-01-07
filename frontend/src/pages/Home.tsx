import React, { useEffect, useState } from "react";
import MapView from "../components/Map.tsx";

import { getMe } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";

export default function Home() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const ac = new AbortController();
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
            <div className="controls-container">
                {isAuthenticated && user && (
                    <>
                        <p>Controls</p>
                        {(user.pods?.length ?? 0) === 0 && (
                            <div className="warning-message">You currently have no pods registered. Register a pod to upload data.</div>
                        )}
                        <button className="btn primary-btn" disabled={(user.pods?.length ?? 0) === 0}>Upload EVA Data</button>
                        <br/>
                        <button className="btn secondary-btn">Manage EVA Pods</button>
                    </>
                )}

                <div className="filters-container">
                    <p>Filters</p>
                </div>
            </div>
            <div className="map-container">
                <MapView />
            </div>
        </div>
    )
}
