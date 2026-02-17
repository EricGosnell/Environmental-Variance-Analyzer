import "../styles/InfoPages.css";

export default function About_MeetCarma() {
    return (
        <div className="info-container">
            <div className="info-card">
                <div className="info-header">
                    <h1 className="info-title">Meet the CARMA Team</h1>
                </div>
                <div className="info-body">
                    <h2 className="info-subheader">What is CARMA?</h2>
                    <p className="info-content">
                        The CU Boulder Climate Adaptation and Resilience Monitoring Alliance (CARMA) team is a multidisciplinary team of researchers, students, and experts committed to exploring the impacts of climate change on communities worldwide by carrying out a variety of innovative projects. Through collaboration and hands-on research, members work together towards the advancements of environmental science and engineering in new, creative, and inventive ways.
                    </p>
                    <h2 className="info-subheader">CARMA and STELLA</h2>
                    <p className="info-content">
                        One of CARMA’s projects includes using NASA’s STELLA spectroscopy device to test its capabilities in measuring the impacts of climate change on plant health across a range of vulnerable environments. By reading the reflected levels of Near-Infared (NIR) and visible red, green, and blue wavelengths, CARMA can detect physiological stress in plants before any visual symptoms appear. CARMA also works to validate the accuracy and reliability of the STELLA device for broader use in climate research, environmental monitoring, and agricultural applications.
                    </p>
                    <p className="info-content">
                        For more information on CARMA, including related programs, see NASA Colorado Space Grant Consortium’s{" "}
                        <a href="https://www.colorado.edu/center/spacegrant/climate-projects" target="_blank" className="info-link">
                            Earth System Projects.
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}