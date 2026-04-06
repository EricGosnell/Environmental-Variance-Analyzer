import "../styles/Filters.css";

export type UploadTimeframe = "24h" | "7d" | "30d" | "any";

export interface FiltersState {
    uploadTimeframe: UploadTimeframe;
}

export function uploadTimeframeToFromDate(timeframe: UploadTimeframe): string | undefined {
    if (timeframe === "any") return undefined;
    const now = new Date();
    if (timeframe === "24h") now.setMinutes(now.getHours() - 24);
    else if (timeframe === "7d") now.setDate(now.getDate() - 7);
    else if (timeframe === "30d") now.setDate(now.getDate() - 30);
    return now.toISOString();
}

interface FiltersProps {
    filters: FiltersState;
    onChange: (filters: FiltersState) => void;
}

export default function Filters({ filters, onChange }: FiltersProps) {
    const { uploadTimeframe } = filters;

    const setUploadTimeframe = (value: UploadTimeframe) =>
        onChange({ ...filters, uploadTimeframe: value });

    return (
        <div className="filters-container">
            <p className="filters-heading">Filters</p>

            <div className="filter-group">
                <p className="filter-group-label">Last Upload</p>
                <div className="filter-chip-row">
                    {(["24h", "7d", "30d", "any"] as const).map((range) => (
                        <button
                            key={range}
                            className={`filter-chip ${uploadTimeframe === range ? "active" : ""}`}
                            onClick={() => setUploadTimeframe(range)}
                        >
                            {range === "24h" ? "Last 24h" : range === "7d" ? "Last 7d" : range === "30d" ? "Last 30d" : "Any time"}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
