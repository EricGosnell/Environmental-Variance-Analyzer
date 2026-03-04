import {FocusEvent, KeyboardEvent, useRef, useState} from "react";
import {Link, NavLink, useNavigate} from "react-router-dom";
import {ApiError, authLogout, getAccessToken} from "../utils/api";
import "../styles/Header.css";

type DropdownMenu = "about" | "profile" | null;

export default function Header() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<DropdownMenu>(null);
    const login = !!getAccessToken();
    const aboutButtonRef = useRef<HTMLButtonElement | null>(null);
    const profileButtonRef = useRef<HTMLButtonElement | null>(null);

    const toggleDropdown = (name: Exclude<DropdownMenu, null>) => {
        setOpenDropdown((current) => (current === name ? null : name));
    };

    const closeDropdown = () => setOpenDropdown(null);

    const focusDropdownButton = (menu: Exclude<DropdownMenu, null>) => {
        if (menu === "about") {
            aboutButtonRef.current?.focus();
        } else {
            profileButtonRef.current?.focus();
        }
    };

    const submitLogout = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await authLogout();
            if (location.pathname === "/") {
                navigate(0);
            } else {
                navigate("/", { replace: true });
            }
        } catch (err) {
            if (err instanceof ApiError) {
                console.error("Logout failed", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDropdownKeyDown = (event: KeyboardEvent<HTMLButtonElement>, menu: Exclude<DropdownMenu, null>) => {
        if (event.key === "Escape") {
            closeDropdown();
            focusDropdownButton(menu);
            return;
        }

        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            toggleDropdown(menu);
        }
    };

    const handleMenuItemKeyDown = (event: KeyboardEvent<HTMLElement>, menu: Exclude<DropdownMenu, null>) => {
        if (event.key === "Escape") {
            closeDropdown();
            focusDropdownButton(menu);
        }
    };

    const closeIfUnfocused = (event: FocusEvent<HTMLDivElement>, menu: Exclude<DropdownMenu, null>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            if (menu === openDropdown) {
                closeDropdown();
            }
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
                    <div className="dropdown" onBlur={(event) => closeIfUnfocused(event, "about")}>
                        <button
                            ref={aboutButtonRef}
                            type="button"
                            id="about-menu-button"
                            className="dropdown-toggle"
                            onClick={() => toggleDropdown("about")}
                            onKeyDown={(event) => handleDropdownKeyDown(event, "about")}
                            aria-expanded={openDropdown === "about"}
                            aria-controls="about-menu"
                            aria-haspopup="menu"
                        >
                            About
                        </button>
                        <div
                            id="about-menu"
                            role="menu"
                            aria-labelledby="about-menu-button"
                            className={`dropdown-menu dropdown-menu-center ${openDropdown === "about" ? "open" : ""}`}
                            onKeyDown={(event) => handleMenuItemKeyDown(event, "about")}
                        >
                            <Link to="/about/EVA-pod" role="menuitem" className="dropdown-item" onClick={closeDropdown}>
                                The EVA Pod
                            </Link>
                            <Link
                                to="/about/assembly-instructions"
                                role="menuitem"
                                className="dropdown-item"
                                onClick={closeDropdown}
                            >
                                Assembly Instructions
                            </Link>
                            <Link to="/about/NASA-STELLA" role="menuitem" className="dropdown-item" onClick={closeDropdown}>
                                NASA STELLA
                            </Link>
                            <Link
                                to="/about/meet-CARMA"
                                role="menuitem"
                                className="dropdown-item"
                                onClick={closeDropdown}
                            >
                                Meet CARMA
                            </Link>
                        </div>
                    </div>
                    <NavLink to="/faqs">FAQs</NavLink>
                    {login && (
                        <div className="dropdown" onBlur={(event) => closeIfUnfocused(event, "profile")}>
                            <button
                                ref={profileButtonRef}
                                type="button"
                                id="profile-menu-button"
                                className="dropdown-toggle"
                                onClick={() => toggleDropdown("profile")}
                                onKeyDown={(event) => handleDropdownKeyDown(event, "profile")}
                                aria-expanded={openDropdown === "profile"}
                                aria-controls="profile-menu"
                                aria-haspopup="menu"
                            >
                                Profile
                            </button>
                            <div
                                id="profile-menu"
                                role="menu"
                                aria-labelledby="profile-menu-button"
                                className={`dropdown-menu dropdown-menu-right ${openDropdown === "profile" ? "open" : ""}`}
                                onKeyDown={(event) => handleMenuItemKeyDown(event, "profile")}
                            >
                                <Link to="/profile" role="menuitem" className="dropdown-item" onClick={closeDropdown}>
                                    View Profile
                                </Link>
                                <Link to="/settings" role="menuitem" className="dropdown-item" onClick={closeDropdown}>
                                    Settings
                                </Link>
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        closeDropdown();
                                        submitLogout();
                                    }}
                                    onKeyDown={(event) => handleMenuItemKeyDown(event, "profile")}
                                    className="dropdown-item"
                                    disabled={loading}
                                >
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
