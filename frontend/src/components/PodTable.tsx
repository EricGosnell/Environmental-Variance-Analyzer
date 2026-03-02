import { useEffect, useState } from "react";
import "../styles/PodTable.css";

interface PodTableProps {
    isOpen: boolean;
    onClose: () => void;
    onHeightChange: (height: number) => void;
}

export default function PodTable({ isOpen, onClose, onHeightChange }: PodTableProps) {
    const [podTableHeight, setPodTableHeight] = useState(33);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startHeight, setStartHeight] = useState(33);

    // Notify parent of height changes
    useEffect(() => {
        onHeightChange(podTableHeight);
    }, [podTableHeight, onHeightChange]);

    // Trigger map resize when pod table opens/closes or height changes
    useEffect(() => {
        window.dispatchEvent(new Event('resize'));
    }, [isOpen, podTableHeight]);

    // Handle drag start
    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setStartY(clientY);
        setStartHeight(podTableHeight);
    };

    // Handle dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleDragMove = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            const mapContainer = document.querySelector('.map-container');
            if (!mapContainer) return;

            const containerHeight = mapContainer.clientHeight;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            const deltaY = startY - clientY;
            const deltaPercent = (deltaY / containerHeight) * 100;

            let newHeight = startHeight + deltaPercent;
            newHeight = Math.max(10, Math.min(80, newHeight));

            setPodTableHeight(newHeight);
        };

        const handleDragEnd = () => {
            setIsDragging(false);

            if (podTableHeight < 15) {
                onClose();
                setPodTableHeight(33);
            }
        };

        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);

        return () => {
            document.removeEventListener('mousemove', handleDragMove);
            document.removeEventListener('mouseup', handleDragEnd);
            document.removeEventListener('touchmove', handleDragMove);
            document.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, startY, startHeight, podTableHeight, onClose]);

    const handleClose = () => {
        onClose();
        setPodTableHeight(33);
    };

    // Mock data
    const mockData = [
        {
            pod: 'Pod 1',
            lat: 40.0150,
            lon: -105.2705,
            battery: 87,
            airTemp: 22.4,
            airPressure: 101.3,
            humidity: 45,
            soilTemp: 18.2,
            soilPH: 6.8
        },
        {
            pod: 'Pod 2',
            lat: 40.0162,
            lon: -105.2798,
            battery: 92,
            airTemp: 23.1,
            airPressure: 101.2,
            humidity: 48,
            soilTemp: 19.1,
            soilPH: 7.1
        },
        {
            pod: 'Pod 3',
            lat: 40.0138,
            lon: -105.2689,
            battery: 65,
            airTemp: 21.8,
            airPressure: 101.4,
            humidity: 43,
            soilTemp: 17.9,
            soilPH: 6.5
        }
    ];

    return (
        <div className={`pod-table-drawer ${isOpen ? "open" : "closed"}`}
             style={{height: isOpen ? `${podTableHeight}%` : '33%'}}>

            <h2 className="pod-table-drawer-title">Pod Data</h2>

            <div className="pod-table-drawer-handle" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                <div className="pod-table-drawer-handle-bar"></div>
            </div>

            <button className="pod-table-drawer-close-btn" onClick={handleClose} aria-label="Close drawer">
                ×
            </button>

            <div className="pod-table-drawer-content">
                <table className="pod-data-table">
                    <thead>
                    <tr>
                        {/* for sensor_type in [api get all sensor_types]
                                <th>sensor_type</th> */}
                        <th>Pod</th>
                        <th>Lat</th>
                        <th>Lon</th>
                        <th>Battery %</th>
                        <th>Air Temp (°C)</th>
                        <th>Air Pressure (kPa)</th>
                        <th>Humidity %</th>
                        <th>Soil Temp (°C)</th>
                        <th>Soil pH</th>
                    </tr>
                    </thead>
                    <tbody>
                    {/* for pod in [api get all visible pods
                            <tr>
                            for sensor_type in [api get all sensor types]
                                <td> [api get latest reading for this sensor from this pod]
                    */}
                    {mockData.map((row) => (
                        <tr key={row.pod}>
                            <td>{row.pod}</td>
                            <td>{row.lat.toFixed(4)}</td>
                            <td>{row.lon.toFixed(4)}</td>
                            <td>{row.battery}%</td>
                            <td>{row.airTemp.toFixed(1)}</td>
                            <td>{row.airPressure.toFixed(1)}</td>
                            <td>{row.humidity}%</td>
                            <td>{row.soilTemp.toFixed(1)}</td>
                            <td>{row.soilPH.toFixed(1)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
