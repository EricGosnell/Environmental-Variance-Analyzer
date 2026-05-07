import { useState, useRef, useEffect } from "react";
import { getSensorColor } from "../utils/sensorColors";

type Props = {
  options: { key: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

export default function MultiSensorDropdown({
  options,
  selected,
  onChange,
  placeholder = "Select sensors",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleSensor = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find((o) => o.key === selected[0])?.label || "1 sensor"
      : `${selected.length} sensors`;

  return (
    <div className="multi-sensor-dropdown" ref={containerRef}>
      <button
        type="button"
        className="select-control multi-sensor-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{displayText}</span>
        <span className="multi-sensor-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && (
        <div className="multi-sensor-menu">
          {options.map((option) => {
            const isSelected = selected.includes(option.key);
            const color = getSensorColor(option.key);
            return (
              <label
                key={option.key}
                className={`multi-sensor-option ${isSelected ? "selected" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSensor(option.key)}
                />
                <span
                  className="sensor-color-dot"
                  style={{ backgroundColor: color }}
                />
                <span className="sensor-label">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
