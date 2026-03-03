import {Link, NavLink, useNavigate} from "react-router-dom";
import {ApiError, authLogout, getAccessToken} from "../utils/api";
import "../styles/Header.css";
import {useEffect, useState} from "react";

export default function Header() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [login, setLogin] = useState(false);

    useEffect(() => {
        const token = getAccessToken();
        setLogin(!!token);
    }, []);

    const submitLogout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        try {
            await authLogout();
            setLogin(false);
            navigate("/");
        } catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                console.error("Logout failed", err);
                alert("Logout failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <header className="navbar">
            <div className="nav-container">
                <div className="navbar-home">
                    <Link to="/">Environmental Variance Analyzer</Link>
                </div>

                <nav className="navbar-links">
                    <NavLink to="/">Map</NavLink>
                    <div className="dropdown">
                        <NavLink to="/about" className="dropdown-toggle">
                            About
                        </NavLink>
                        <div className="dropdown-menu dropdown-menu-center">
                            <Link to="/about/EVA-pod" className="dropdown-item">The EVA Pod</Link>
                            <Link to="/about/assembly-instructions" className="dropdown-item">Assembly Instructions</Link>
                            <Link to="/about/NASA-STELLA" className="dropdown-item">NASA STELLA</Link>
                            <Link to="/about/meet-CARMA" className="dropdown-item">Meet CARMA</Link>
                        </div>
                    </div>
                    <NavLink to="/faqs">FAQs</NavLink>
                    {login && (
                        <div className="dropdown">
                            <NavLink to="/profile" className="dropdown-toggle">
                                Profile
                            </NavLink>
                            <div className="dropdown-menu dropdown-menu-right">
                                <Link to="/profile" className="dropdown-item">View Profile</Link>
                                <Link to="/settings" className="dropdown-item">Settings</Link>
                                <button onClick={submitLogout} className="dropdown-item" disabled={loading}>
                                    {loading ? "Logging out..." : "Logout"}
                                </button>
                            </div>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
