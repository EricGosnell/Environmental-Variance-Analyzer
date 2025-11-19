import { Link } from "react-router-dom";
import "./Header.css";

export default function Header() {
    return (
        <header className="navbar">
            <div className="navbar-logo"><Link to="/">Environmental Variance Analyzer</Link></div>

            <nav className="navbar-links">
                <Link to="/about">About</Link>
                <Link to="/contact">Contact</Link>
                <Link to="/profile">Profile</Link>
            </nav>
        </header>
    );
}
