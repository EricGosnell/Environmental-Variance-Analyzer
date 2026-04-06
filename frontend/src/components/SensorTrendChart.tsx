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

  const isSinglePoint = chartData !== null && chartData.yValues.length === 1 && chartData.yValues[0].length === 1;

  if (!chartData) {
    return (
      <div className="pod-chart--empty">
        No data available for selected sensor and time range.
      </div>
    );
  }

  if (isSinglePoint) {
    const dayLabel = chartData.xLabels[0];
    const value = chartData.yValues[0][0];
    return (
      <div className="single-point-card">
        <div className="single-point-date">{dayLabel}:</div>
        <div className="single-point-value">
          {value}{units ? ` ${units}` : ""}
        </div>
        <div className="single-point-disclaimer">
          Only 1 data point available for this view. A trend chart will appear once more readings are collected.
        </div>
      </div>
    );
  }

  const jitterMax = 0.12;

  const xJittered: number[] = [];
  const yValues: number[] = [];
  const hoverTexts: string[] = [];

  for (let i = 0; i < chartData.xLabels.length; i++) {
    const dayLabel = chartData.xLabels[i];
    const dayValues = chartData.yValues[i];
    const pointCount = dayValues.length;
    const jitterForDay = pointCount <= 2 ? 0 : pointCount <= 5 ? 0.08 : jitterMax;
    for (const val of dayValues) {
      const jitter = (Math.random() - 0.5) * 2 * jitterForDay;
      xJittered.push(i + jitter);
      yValues.push(val);
      hoverTexts.push(dayLabel);
    }
  }

  const unitsLabel = units ? ` ${units}` : "";

  return (
      <Plot
        data={[
          {
            type: "scatter",
            mode: "markers",
            x: xJittered,
            y: yValues,
            marker: {
              size: 8,
              color: "rgba(255, 255, 255, 0.7)",
            },
            hovertemplate:
              "Value: %{y}" + unitsLabel + "<br>Date: %{text}<extra></extra>",
            text: hoverTexts,
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
            tickvals: chartData.xLabels.map((_, i) => i),
            ticktext: chartData.xLabels,
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
