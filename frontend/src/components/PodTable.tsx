import { useEffect, useState, useCallback } from "react";
import "../styles/PodTable.css";
import { getPodsLatestReadings } from "../utils/api";
import type { PodLatestReadings } from "../utils/apiTypes";

interface PodTableProps {
    isOpen: boolean;
    onClose: () => void;
    onHeightChange: (height: number) => void;
    visiblePodIds?: string[];
    selectedPods: string[];
    onSelectionChange: (selectedPods: string[]) => void;
    onZoomTo: (pods: { lat: number; lon: number }[]) => void;
}

export default function PodTable({ isOpen, onClose, onHeightChange, visiblePodIds = [], selectedPods, onSelectionChange, onZoomTo}: PodTableProps) {
    const [podTableHeight, setPodTableHeight] = useState(33);
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startHeight, setStartHeight] = useState(33);

    const [pods, setPods] = useState<PodLatestReadings[]>([]);
    const [sensorTypes, setSensorTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPodData = useCallback(async (podIds: string[], signal: AbortSignal) => {
        if (!podIds?.length) {
            setPods([]);
            setSensorTypes([]);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const { pods: fetchedPods } = await getPodsLatestReadings(podIds, signal);

            const allTypes = new Set<string>();
            for (const pod of fetchedPods) {
                for (const metric of Object.keys(pod.latestReadings)) {
                    allTypes.add(metric);
                }
            }

            setPods(fetchedPods);
            setSensorTypes([...allTypes]);
        } catch (err: any) {
            if (err?.name !== "AbortError") {
                setError("Failed to load pod data. Try reopening the pod table.");
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get pod data for visible pods, but not while dragging
    useEffect(() => {
        if (isDragging) return;
        const controller = new AbortController();
        fetchPodData(visiblePodIds, controller.signal);
        return () => controller.abort();
    }, [visiblePodIds, isDragging, fetchPodData]);

    // Toggle a pod's selection state
    const handleRowClick = (podName: string) => {
        const isSelected = selectedPods.includes(podName);
        if (isSelected) {
            onSelectionChange(selectedPods.filter(p => p !== podName));
        } else {
            onSelectionChange([...selectedPods, podName]);
        }
    };

    // Zoom map to all currently selected pods
    const zoomToSelection = () => {
        const targets = pods.filter(pod => selectedPods.includes(pod.podId));
        onZoomTo(targets.map(pod => ({
            lat: pod.latestReadings[Object.keys(pod.latestReadings)[0]]?.location.latitude,
            lon: pod.latestReadings[Object.keys(pod.latestReadings)[0]]?.location.longitude,
        })).filter(coords => coords.lat !== undefined && coords.lon !== undefined) as { lat: number; lon: number }[]);
    };

    // Clear pod selection

    const clearSelection = () => {
        onSelectionChange([]);
    };

    // Invert selection from list of pods in table
    const invertSelection = () => {
        const invertedPods = pods
            .map(pod => pod.podId)
            .filter(podId => !selectedPods.includes(podId));
        onSelectionChange(invertedPods);
    };

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

    const formatReading = (reading: PodLatestReadings["latestReadings"][string] | undefined): string => {
        if (!reading) return "N/A";
        const val = reading.value.toFixed(2).replace(/\.?0+$/, "");
        return reading.units ? `${val} ${reading.units}` : val;
    };

    return (
        <div className={`pod-table-drawer ${isOpen ? "open" : "closed"}`}
             style={{height: isOpen ? `${podTableHeight}%` : '33%'}}>

            <div className="pod-table-drawer-header">
                <div className="pod-table-selection-controls">
                    {selectedPods.length > 0 && (
                        <>
                            <span>{selectedPods.length} Selected</span>
                            <button className="btn primary-btn pod-table-selection-btn" onClick={zoomToSelection}>Zoom
                                to
                            </button>
                            <button className="btn primary-btn pod-table-selection-btn" onClick={clearSelection}>Clear
                            </button>
                            <button className="btn primary-btn pod-table-selection-btn"
                                    onClick={invertSelection}>Invert
                            </button>
                        </>
                    )}
                </div>

                <div className="pod-table-drawer-handle" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                    <div className="pod-table-drawer-handle-bar"></div>
                </div>

                <div className="pod-table-drawer-header-right">
                    {/*    Noting on the right side, just for spacing */}
                </div>

                <button className="pod-table-drawer-close-btn" onClick={handleClose} aria-label="Close drawer">
                    ×
                </button>
            </div>

            <div className="pod-table-drawer-content">
                {isLoading && <p className="pod-table-status">Loading pod data…</p>}
                {error && <p className="pod-table-status pod-table-error">{error}</p>}
                {!isLoading && !error && pods.length === 0 && (
                    <p className="pod-table-status">No pods visible.</p>
                )}
                {!isLoading && !error && pods.length > 0 && (
                    <table className="pod-data-table">
                        <thead>
                        <tr>
                            <th>Pod</th>
                            {sensorTypes.map(type => (
                                <th key={type}>{type}</th>
                            ))}
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {pods.map(pod => (
                            <tr key={pod.podId}
                                className={selectedPods.includes(pod.podId) ? "pod-row-selected" : ""}
                                onClick={() => handleRowClick(pod.podId)}
                            >
                                <td>{pod.podName ?? pod.podId}</td>
                                {sensorTypes.map(type => (
                                    <td key={type}>
                                        {formatReading(pod.latestReadings[type])}
                                    </td>
                                ))}
                                <td></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
