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

    return (
        <div
            className={`pod-table-drawer ${isOpen ? "open" : "closed"}`}
            style={{
                height: isOpen ? `${podTableHeight}%` : '33%'
            }}
        >
            <div
                className="pod-table-drawer-handle"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
            >
                <div className="pod-table-drawer-handle-bar"></div>
            </div>

            <button
                className="pod-table-drawer-close-btn"
                onClick={handleClose}
                aria-label="Close drawer"
            >
                ×
            </button>

            <div className="pod-table-drawer-content">
                <p>Pod Table Body</p>
                <p>Current height: {Math.round(podTableHeight)}%</p>
            </div>
        </div>
    );
}
