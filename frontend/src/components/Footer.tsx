import {Link} from "react-router-dom";
import "../styles/Footer.css"
import cosgc_logo from "../assets/COSGC_Logo.jpeg";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-column">
                    <h4>Explore</h4>
                    <Link to="/">Map</Link>
                    <Link to="/about-assembly-instructions">Assembly Instructions</Link>
                    <Link to="/faqs">FAQs</Link>

                </div>
                <div className="footer-column">
                    <h4>About</h4>
                    <Link to="/about-the-EVA-pod">The EVA Pod</Link>
                    <Link to="/about-NASA-STELLA">NASA STELLA</Link>
                    <Link to="/about-meet-CARMA">CARMA</Link>
                    <Link to="/contact">Contact Us</Link>
                    <Link to="/privacy">Privacy</Link>
                </div>
                <div className="footer-column">
                    <Link to="https://www.colorado.edu/center/spacegrant/" target="_blank">
                        <img
                            src={cosgc_logo}
                            alt="COSGC Logo"
                            className="footer-image"
                        />
                    </Link>
                    <Link to="https://www.nasa.gov/" target="_blank">
                        <img
                            src="https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg"
                            alt="NASA Logo"
                            className="footer-image"
                        />
                    </Link>
                </div>
            </div>
        </footer>
    );
}