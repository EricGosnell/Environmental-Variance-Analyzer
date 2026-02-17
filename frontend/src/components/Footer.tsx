import {Link} from "react-router-dom";
import "../styles/Footer.css"
import cosgc_logo from "../assets/COSGC_Logo.jpeg";

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-left">
                    <p>NASA Colorado Space Grant Consortium</p>
                    <p>1095 Regent Dr.</p>
                    <p>Boulder, CO 80309</p>
                    <p>Discovery Leaning Center</p>
                    <p>Room 270</p>
                    <p>Webmaster</p>
                    <p>cospacegrant@colorado.edu</p>
                </div>
                <div className="footer-center">
                    <Link to="/contact-us">Contact Us</Link>
                    <Link to="/terms-and-conditions">Terms & Conditions</Link>
                    <Link to="/privacy-statement">Privacy Statement</Link>
                    <Link to="/copyright-and-other-notices">Copyright and Other Notices</Link>
                </div>
                <div className="footer-right">
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
                </div>
            </div>
        </footer>
    );
}