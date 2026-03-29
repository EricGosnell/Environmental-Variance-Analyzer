import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { PodDataEntry } from "../utils/apiTypes";

type Props = {
  data: PodDataEntry[];
  sensorType: string;
  dateRange: "Last 7 Days" | "Last 30 Days" | "All Time";
};

function getDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SensorTrendChart({ data, sensorType, dateRange }: Props) {
  const chartData = useMemo(() => {
    const filtered = data.filter((e) => e?.data?.sensor_type === sensorType);
    if (filtered.length === 0) return null;

    const cutoffDate =
      dateRange === "Last 7 Days"
        ? getDaysAgo(7)
        : dateRange === "Last 30 Days"
        ? getDaysAgo(30)
        : null;

    const grouped = new Map<string, number[]>();

    for (const entry of filtered) {
      const d = new Date(entry.timestamp);
      if (isNaN(d.getTime())) continue;
      if (cutoffDate && d < cutoffDate) continue;

      const dayKey = d.toISOString().slice(0, 10);
      const val = entry.data.reading_value;
      if (typeof val !== "number") continue;

      if (!grouped.has(dayKey)) grouped.set(dayKey, []);
      grouped.get(dayKey)!.push(val);
    }

    const sortedDays = Array.from(grouped.keys()).sort();
    if (sortedDays.length === 0) return null;

    const xLabels: string[] = [];
    const yValues: number[][] = [];

    for (const day of sortedDays) {
      const dayDate = new Date(day + "T00:00:00");
      xLabels.push(formatDateLabel(dayDate));
      yValues.push(grouped.get(day)!);
    }

    return { xLabels, yValues };
  }, [data, sensorType, dateRange]);

  const units = useMemo(() => {
    const entry = data.find((e) => e?.data?.sensor_type === sensorType);
    return entry?.data?.reading_units || "";
  }, [data, sensorType]);

  if (!chartData) {
    return (
      <div className="pod-chart pod-chart--empty">
        No data available for selected sensor and time range.
      </div>
    );
  }

  return (
    <Plot
      data={[
        {
          type: "box",
          x: chartData.xLabels,
          y: chartData.yValues.flat(),
          boxpoints: "outliers",
          marker: {
            color: "rgba(48, 164, 108, 0.6)",
            outliercolor: "rgba(255, 255, 255, 0.8)",
          },
          line: {
            color: "rgba(48, 164, 108, 1)",
          },
          fillcolor: "rgba(48, 164, 108, 0.3)",
          boxmean: true,
        },
      ]}
      layout={{
        autosize: true,
        margin: { l: 60, r: 20, t: 20, b: 50 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "rgba(255, 255, 255, 0.85)" },
        xaxis: {
          title: { text: "Date", standoff: 10 },
          gridcolor: "rgba(255, 255, 255, 0.1)",
          zerolinecolor: "rgba(255, 255, 255, 0.2)",
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
