import { Link, NavLink } from "react-router-dom";
import "./Header.css";
import cosgc_logo from "../assets/COSGC_Logo.jpeg"

export default function Header() {
    return (
        <header className="navbar">
            <div className="nav-container">
                <div className="navbar-home">
                    <Link to="/">Environmental Variance Analyzer</Link>
                </div>

                <nav className="navbar-links">
                    <NavLink to="/">Map</NavLink>
                    <NavLink to="/about">About</NavLink>
                    <NavLink to="/contact">Contact</NavLink>
                    <NavLink to="/managepods">Manage Pods</NavLink>
                    <NavLink to="/profile">Profile</NavLink>
                    <div className="nav-separator"></div>
                    <Link to="https://www.colorado.edu/center/spacegrant/" target="_blank">
                        <img
                            src={cosgc_logo}
                            alt="COSGC Logo"
                            className="cosgc-logo"
                        />
                    </Link>
                    <Link to="https://www.nasa.gov/" target="_blank">
                        <img
                            src="https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg"
                            alt="NASA Logo"
                            className="nasa-logo"
                        />
                    </Link>

                </nav>
            </div>
        </header>
    );
}
