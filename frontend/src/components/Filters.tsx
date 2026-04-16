import { useState } from "react";
import "../styles/Filters.css";

export type UploadTimeframe = "24h" | "7d" | "30d" | "any";

export type OwnerFilter = "all" | "owned";

export interface FiltersState {
    uploadTimeframe: UploadTimeframe;
    customFrom: string;
    customTo: string;
    sensorTypes: string[];
    ownerFilter: OwnerFilter;
    nameSearch: string;
}

export function uploadTimeframeToFromDate(filters: FiltersState): string | undefined {
    if (filters.customFrom) return new Date(filters.customFrom).toISOString();
    if (filters.uploadTimeframe === "any") return undefined;
    const now = new Date();
    if (filters.uploadTimeframe === "24h") now.setTime(now.getTime() - 24 * 60 * 60 * 1000);
    else if (filters.uploadTimeframe === "7d") now.setDate(now.getDate() - 7);
    else if (filters.uploadTimeframe === "30d") now.setDate(now.getDate() - 30);
    return now.toISOString();
}

export function uploadTimeframeToToDate(filters: FiltersState): string | undefined {
    if (filters.customTo) return new Date(filters.customTo + "T23:59:59.999Z").toISOString();
    return undefined;
}

interface FiltersProps {
    filters: FiltersState;
    onChange: (filters: FiltersState) => void;
    availableSensorTypes: string[];
    isAuthenticated: boolean | null;
}

export default function Filters({ filters, onChange, availableSensorTypes, isAuthenticated }: FiltersProps) {
    const { uploadTimeframe, customFrom, customTo, sensorTypes, ownerFilter, nameSearch } = filters;
    const [sensorDropdownOpen, setSensorDropdownOpen] = useState(false);

    const setUploadTimeframe = (value: UploadTimeframe) =>
        onChange({ ...filters, uploadTimeframe: value, customFrom: "", customTo: "" });

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const handleCustomFrom = (value: string) => {
        const update: Partial<FiltersState> = { uploadTimeframe: "any", customFrom: value };
        if (customTo && value > customTo) update.customTo = "";
        onChange({ ...filters, ...update });
    };

    const handleCustomTo = (value: string) => {
        const update: Partial<FiltersState> = { uploadTimeframe: "any", customTo: value };
        if (customFrom && value < customFrom) update.customFrom = "";
        onChange({ ...filters, ...update });
    };

    const toggleSensorType = (type: string) => {
        const next = sensorTypes.includes(type)
            ? sensorTypes.filter((t) => t !== type)
            : [...sensorTypes, type];
        onChange({ ...filters, sensorTypes: next });
    };

    const isDefault =
        uploadTimeframe === "any" &&
        customFrom === "" &&
        customTo === "" &&
        sensorTypes.length === 0 &&
        ownerFilter === "all" &&
        nameSearch === "";

    const handleClear = () =>
        onChange({ uploadTimeframe: "any", customFrom: "", customTo: "", sensorTypes: [], ownerFilter: "all", nameSearch: "" });

    return (
        <div className="filters-container">
            <div className="filters-header">
                <p className="filters-heading">Filters</p>
                <button className="filters-clear-btn" onClick={handleClear} disabled={isDefault}>
                    Clear
                </button>
            </div>

            <div className="filter-group">
                <p className="filter-group-label">Pod Name</p>
                <input
                    type="text"
                    className={`filter-text-input ${nameSearch ? "active" : ""}`}
                    placeholder="Search by name…"
                    value={nameSearch}
                    onChange={(e) => onChange({ ...filters, nameSearch: e.target.value })}
                />
            </div>

            {isAuthenticated && (
                <div className="filter-group">
                    <p className="filter-group-label">Pod Ownership</p>
                    <div className="filter-chip-row">
                        <button
                            className={`filter-chip ${ownerFilter === "all" ? "active" : ""}`}
                            onClick={() => onChange({ ...filters, ownerFilter: "all" })}
                        >All</button>
                        <button
                            className={`filter-chip ${ownerFilter === "owned" ? "active" : ""}`}
                            onClick={() => onChange({ ...filters, ownerFilter: "owned" })}
                        >My Pods</button>
                    </div>
                </div>
            )}

            <div className="filter-group">
                <p className="filter-group-label">Last Upload</p>
                <div className="filter-chip-row">
                    {(["24h", "7d", "30d", "any"] as const).map((range) => (
                        <button
                            key={range}
                            className={`filter-chip ${uploadTimeframe === range && !customFrom && !customTo ? "active" : ""}`}
                            onClick={() => setUploadTimeframe(range)}
                        >
                            {range === "24h" ? "Last 24h" : range === "7d" ? "Last 7d" : range === "30d" ? "Last 30d" : "Any time"}
                        </button>
                    ))}
                </div>

                <div className="filter-date-range">
                    <div className="filter-date-field">
                        <label className="filter-date-label">From</label>
                        <input
                            type="date"
                            className={`filter-date-input ${customFrom ? "active" : ""}`}
                            value={customFrom}
                            max={customTo || today}
                            onChange={(e) => handleCustomFrom(e.target.value)}
                        />
                    </div>
                    <div className="filter-date-field">
                        <label className="filter-date-label">To</label>
                        <input
                            type="date"
                            className={`filter-date-input ${customTo ? "active" : ""}`}
                            value={customTo}
                            min={customFrom}
                            max={today}
                            onChange={(e) => handleCustomTo(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="filter-group">
                <p className="filter-group-label">Data Types</p>
                <button
                    className={`filter-dropdown-toggle ${sensorTypes.length > 0 ? "active" : ""}`}
                    onClick={() => setSensorDropdownOpen((o) => !o)}
                >
                    <span>
                        {sensorTypes.length > 0 ? `${sensorTypes.length} selected` : "Any"}
                    </span>
                    <span className={`filter-dropdown-chevron ${sensorDropdownOpen ? "open" : ""}`}>▾</span>
                </button>

                {sensorDropdownOpen && (
                    <div className="filter-dropdown">
                        {availableSensorTypes.length === 0 ? (
                            <p className="filter-dropdown-empty">No data types found</p>
                        ) : (
                            availableSensorTypes.map((type) => (
                                <label key={type} className="filter-dropdown-option">
                                    <input
                                        type="checkbox"
                                        className="filter-dropdown-checkbox"
                                        checked={sensorTypes.includes(type)}
                                        onChange={() => toggleSensorType(type)}
                                    />
                                    <span>{type}</span>
                                </label>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
