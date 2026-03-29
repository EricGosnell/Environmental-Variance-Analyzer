import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MapView from "../components/Map.tsx";

import { getMe, getMeSilent } from "../utils/api.ts";
import type { User } from "../utils/apiTypes.ts";
import AuthPanel from "../components/AuthPanel.tsx";

import "../styles/Home.css";

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
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

    return (
        <div className="homepage-container">
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

                        <div className="filters-container">
                            <p>Filters</p>
                        </div>
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
            <div className="map-container">
                <MapView isAuthenticated={isAuthenticated} />
            </div>
        </div>
    )
}
