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
                    <Link to="/about/assembly-instructions">Assembly Instructions</Link>
                    <Link to="/faqs">FAQs</Link>

                </div>
                <div className="footer-column">
                    <h4>About</h4>
                    <Link to="/about/EVA-pod">The EVA Pod</Link>
                    <Link to="/about/NASA-STELLA">NASA STELLA</Link>
                    <Link to="/about/meet-CARMA">Meet CARMA</Link>
                    <Link to="/contact">Contact Us</Link>
                    <Link to="/privacy">Privacy</Link>
                </div>
                <div className="footer-column footer-column-images">
                    <div className="footer-images">
                        <a
                            href="https://www.colorado.edu/center/spacegrant/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img
                                src={cosgc_logo}
                                alt="COSGC Logo"
                            />
                        </a>
                        <a
                            href="https://www.nasa.gov/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <img
                                src="https://www.nasa.gov/wp-content/themes/nasa/assets/images/nasa-logo.svg"
                                alt="NASA Logo"
                            />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
