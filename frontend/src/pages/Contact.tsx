import "../styles/InfoPages.css";

export default function Contact() {
    return (
        <div className="info-container">
            <div className="info-card">
                <div className="info-header">
                    <h1 className="info-title">Contact Us</h1>
                </div>
                <div className="info-body">
                    <p className="info-content">
                        For any inquiries, please email{" "}
                        <a href="mailto:cospacegrant@colorado.edu" className="info-link">
                            cospacegrant@colorado.edu
                        </a>
                        .
                    </p>
                    <p className="info-content">
                        Address: 1095 Regent Dr., Boulder CO 80309, Discovery Learning Center, Room 270
                    </p>
                </div>
            </div>
        </div>
    );
 }
