import Header from "../components/Header";
import Footer from "../components/Footer";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { setAuthLostHandler } from "../utils/api";

export default function MainLayout() {
    const navigate = useNavigate();

    useEffect(() => {
        setAuthLostHandler(() => navigate("/", { replace: true }));
        return () => setAuthLostHandler(null);
    }, [navigate]);

    return (
        <>
            <Header />
            <main>
                <Outlet />
            </main>
            <Footer />
        </>
    );
}
