import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { PodDataEntry } from "../utils/apiTypes";

type Props = {
  data: PodDataEntry[];
  sensorType: string;
  day: string;
};

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function DailySensorChart({ data, sensorType, day }: Props) {
  const chartData = useMemo(() => {
    const filtered = data.filter((e) => {
      if (e?.data?.sensor_type !== sensorType) return false;
      const d = new Date(e.timestamp);
      if (isNaN(d.getTime())) return false;
      const dayKey = d.toISOString().slice(0, 10);
      return dayKey === day;
    });

    if (filtered.length === 0) return null;

    const points = filtered
      .map((e) => ({
        time: new Date(e.timestamp),
        value: e.data.reading_value,
      }))
      .filter((p) => !isNaN(p.time.getTime()) && typeof p.value === "number")
      .sort((a, b) => a.time.getTime() - b.time.getTime());

    if (points.length === 0) return null;

    return {
      times: points.map((p) => formatTimeLabel(p.time)),
      timesRaw: points.map((p) => p.time),
      values: points.map((p) => p.value),
    };
  }, [data, sensorType, day]);

  const units = useMemo(() => {
    const entry = data.find((e) => e?.data?.sensor_type === sensorType);
    return entry?.data?.reading_units || "";
  }, [data, sensorType]);

  const isSinglePoint = chartData !== null && chartData.values.length === 1;

  if (!chartData) {
    return (
      <div className="pod-chart--empty">
        No data available for selected sensor on this day.
      </div>
    );
  }

  if (isSinglePoint) {
    const time = chartData.times[0];
    const value = chartData.values[0];
    return (
      <div className="single-point-card">
        <div className="single-point-time">{time}:</div>
        <div className="single-point-value">
          {value}{units ? ` ${units}` : ""}
        </div>
        <div className="single-point-disclaimer">
          Only 1 data point available for this day. A trend chart will appear once more readings are collected.
        </div>
      </div>
    );
  }

  return (
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            x: chartData.times,
            y: chartData.values,
            marker: {
              color: "rgba(255, 255, 255, 1)",
              size: 8,
            },
            line: {
              color: "rgba(255, 255, 255, 0.8)",
              width: 2,
              shape: "linear",
            },
            hovertemplate: "%{y} " + (units ? units : "") + "<extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          margin: { l: 60, r: 20, t: 20, b: 60 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "rgba(255, 255, 255, 0.85)" },
          xaxis: {
            title: { text: "Time", standoff: 10 },
            gridcolor: "rgba(255, 255, 255, 0.1)",
            zerolinecolor: "rgba(255, 255, 255, 0.2)",
            tickangle: -45,
          },
          yaxis: {
            title: { text: units ? `Value (${units})` : "Value" },
            gridcolor: "rgba(255, 255, 255, 0.1)",
            zerolinecolor: "rgba(255, 255, 255, 0.2)",
          },
        }}
        config={{
          responsive: true,
          displayModeBar: false,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
  );
}
