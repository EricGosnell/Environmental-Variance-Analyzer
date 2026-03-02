import "../styles/InfoPages.css";

export default function About_TheEVAPod() {
    return (
        <div className="info-container">
            <div className="info-card">
                <div className="info-header">
                    <h1 className="info-title">About the EVA Pod</h1>
                </div>
                <div className="info-body">
                    <h2 className="info-subheader">What It Is</h2>
                    <p className="info-content">
                        The EVA (Environmental Variance Analyzer) Pod is a self-contained, field-deployable device designed to autonomously monitor and record key environmental measurements over extended periods of time. Comprised of the EVA unit, which measures temperature, humidity, carbon dioxide, and light, along with the MOSS (Mushroom Off-gassing Soil Sensor) that tracks soil properties and off-gassing, the EVA Pod enables reliable, consistent data collection in remote locations and supports seamless data integration with other pods online.
                    </p>
                    <p>
                        The data collected by the EVA Pod provides comprehensive background information on local environmental conditions which can be used for detailed comparisons with readings taken using the NASA STELLA Module. Together, users can identify real-time, on-site measurements with longer-term environmental patterns. This combined approach supports thorough analysis of ecosystem conditions, climates, and changes, making the EVA Pod an effective tool for environmental research.
                    </p>
                    <h2 className="info-subheader">How It Works</h2>
                    <p className="info-content">

                    </p>
                    <h2 className="info-subheader">Goals and Objectives</h2>
                    <p className="info-content">
                        The EVA Pod aims to expand access to long-term environmental monitoring by serving as a reliable tool for gathering analytical data. Its intentions include the promotion of hands-on engagement in environmental research and to foster collaboration through its interactive online platform. By enabling approachable methods for collecting and sharing data, the EVA Pod supports the development of deeper understandings of local environmental conditions at any location possible.
                    </p>
                </div>
            </div>
        </div>

    );
}

