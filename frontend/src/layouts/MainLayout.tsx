import Header from "../components/Header";
import Footer from "../components/Footer";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { GlobalErrorProvider, useGlobalError } from "../components/GlobalErrorContext";
import { setApiErrorHandler, setAuthLostHandler } from "../utils/api";

function MainLayoutContent() {
    const navigate = useNavigate();
    const { showError } = useGlobalError();

    useEffect(() => {
        setAuthLostHandler(() => navigate("/", { replace: true }));
        setApiErrorHandler((message) => showError(message));
        return () => {
            setAuthLostHandler(null);
            setApiErrorHandler(null);
        };
    }, [navigate, showError]);

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

export default function MainLayout() {
    return (
        <GlobalErrorProvider>
            <MainLayoutContent />
        </GlobalErrorProvider>
    );
}
