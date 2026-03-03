import { Link, NavLink } from "react-router-dom";
import "../styles/Header.css";

export default function Header() {
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
                            <Link to="/about/EVA-pod">The EVA Pod</Link>
                            <Link to="/about/assembly-instructions">Assembly Instructions</Link>
                            <Link to="/about/NASA-STELLA">NASA STELLA</Link>
                            <Link to="/about/meet-CARMA">Meet CARMA</Link>
                        </div>
                    </div>
                    <NavLink to="/faqs">FAQs</NavLink>
                    <div className="dropdown">
                        <NavLink to="/profile" className="dropdown-toggle">
                            Profile
                        </NavLink>
                        <div className="dropdown-menu dropdown-menu-right">
                            <Link to="/profile">View Profile</Link>
                            <Link to="/settings">Settings</Link>
                            <Link to="/">Logout</Link>
                        </div>
                    </div>
                </nav>
            </div>
        </header>
    );
}
