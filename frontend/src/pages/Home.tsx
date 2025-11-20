export default function Home() {
    return (
        <div className="homepage-container">
            <div className="controls-container">
                <p>Controls</p>
                <button className="primary-btn">Add EVA Pod</button>
                <br/>
                <button className="secondary-btn">Edit EVA Pod</button>

                <div className="filters-container">
                    <p>Filters</p>
                </div>
            </div>
            <div className="map-container">
                <p>Map Here</p>
            </div>
        </div>
    )
}
