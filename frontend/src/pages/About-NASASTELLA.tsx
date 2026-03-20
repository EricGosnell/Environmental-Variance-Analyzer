import "../styles/InfoPages.css";

export default function About_NASASTELLA() {
    return (
        <div className="info-container">
            <div className="info-card">
                <div className="info-header">
                    <h1 className="info-title">The NASA STELLA Device</h1>
                </div>
                <div className="info-body">
                    <h2 className="info-subheader">What Is STELLA?</h2>
                    <p className="info-content">
                        STELLA (Science and Technology Education for Land/Life Assessment) are open-source spectroscopic instruments designed to make remote sensing technology accessible to enthusiasts of all ages and backgrounds. Composed of commercial off-the-shelf components, STELLA measures a diverse set of environmental variables that any user can build and tailor to match their own needs. With beginner friendly software, customizable interfaces, detailed documentation, and an open forum with the STELLA team, the STELLA units allow users to gain deeper understandings of Earth science through exploration of ecosystems around the world.
                    </p>
                    <p>
                        For more information about the STELLA devices, including versions, build instructions, example applications, history, and other related resources, visit{" "}
                        <a
                            href="https://science.gsfc.nasa.gov/stella/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="info-link"
                        >
                            the NASA STELLA website.
                        </a>
                    </p>
                    <h2 className="info-subheader">Using STELLA for Plant Health Analysis</h2>
                    <p className="info-content">
                        Interested in seeing how the STELLA 1.1 and 1.2 models measure and collect data for plant stress? The{" "}
                        {/*<a href="" target="_blank" className="info-link">*/}
                            STELLA capstone website
                        {/*</a>*/}
                        {" "}contains video tutorials and training modules to assist with utilizing the STELLA, as well as a map to view and interact with local STELLA devices.
                    </p>
                </div>
            </div>
        </div>
    );
}
