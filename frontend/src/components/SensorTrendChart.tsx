import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { PodDataEntry } from "../utils/apiTypes";
import { getSensorColor, buildUnitsMap } from "../utils/sensorColors";

type Props = {
  data: PodDataEntry[];
  sensorTypes: string[];
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

export default function SensorTrendChart({ data, sensorTypes, dateRange }: Props) {
  const chartData = useMemo(() => {
    if (sensorTypes.length === 0) return null;

    const cutoffDate =
      dateRange === "Last 7 Days"
        ? getDaysAgo(7)
        : dateRange === "Last 30 Days"
        ? getDaysAgo(30)
        : null;

    const allDays = new Set<string>();

    const sensorData = sensorTypes.map((sensorType) => {
      const filtered = data.filter((e) => e?.data?.sensor_type === sensorType);
      const grouped = new Map<string, number[]>();

      for (const entry of filtered) {
        const d = new Date(entry.timestamp);
        if (isNaN(d.getTime())) continue;
        if (cutoffDate && d < cutoffDate) continue;

        const dayKey = d.toISOString().slice(0, 10);
        const val = entry.data.reading_value;
        if (typeof val !== "number") continue;

        allDays.add(dayKey);
        if (!grouped.has(dayKey)) grouped.set(dayKey, []);
        grouped.get(dayKey)!.push(val);
      }

      return {
        sensorType,
        grouped,
      };
    });

    const sortedDays = Array.from(allDays).sort();
    if (sortedDays.length === 0) return null;

    return {
      days: sortedDays,
      sensorData,
    };
  }, [data, sensorTypes, dateRange]);

  const unitsMap = useMemo(() => buildUnitsMap(data, sensorTypes), [data, sensorTypes]);

  const tracesAndLabels = useMemo(() => {
    if (!chartData) return null;

    const jitterMax = 0.12;

    const traces: Plotly.Data[] = chartData.sensorData.map(({ sensorType, grouped }) => {
      const xJittered: number[] = [];
      const yValues: number[] = [];
      const hoverTexts: string[] = [];

      for (let i = 0; i < chartData.days.length; i++) {
        const day = chartData.days[i];
        const dayDate = new Date(day + "T00:00:00");
        const dayLabel = formatDateLabel(dayDate);
        const dayValues = grouped.get(day) || [];
        const pointCount = dayValues.length;
        const jitterForDay = pointCount <= 2 ? 0 : pointCount <= 5 ? 0.08 : jitterMax;

        for (const val of dayValues) {
          const jitter = (Math.random() - 0.5) * 2 * jitterForDay;
          xJittered.push(i + jitter);
          yValues.push(val);
          hoverTexts.push(dayLabel);
        }
      }

      const units = unitsMap.get(sensorType) || "";
      const unitsLabel = units ? ` ${units}` : "";
      const color = getSensorColor(sensorType);

      return {
        type: "scatter",
        mode: "markers",
        name: sensorType,
        x: xJittered,
        y: yValues,
        marker: {
          size: 8,
          color: color,
        },
        hovertemplate: "Value: %{y}" + unitsLabel + "<br>Date: %{text}<extra></extra>",
        text: hoverTexts,
      };
    });

    const xLabels = chartData.days.map((day) => {
      const dayDate = new Date(day + "T00:00:00");
      return formatDateLabel(dayDate);
    });

    return { traces, xLabels };
  }, [chartData, unitsMap]);

  if (!chartData || sensorTypes.length === 0) {
    return (
      <div className="pod-chart--empty">
        No sensors selected or no data available.
      </div>
    );
  }

  const totalPoints = chartData.sensorData.reduce((sum, sd) => {
    for (const vals of sd.grouped.values()) sum += vals.length;
    return sum;
  }, 0);

  if (totalPoints === 1) {
    let singleSensorType = "";
    let singleDay = "";
    let singleValue = 0;
    for (const sd of chartData.sensorData) {
      for (const [day, vals] of sd.grouped.entries()) {
        if (vals.length > 0) {
          singleSensorType = sd.sensorType;
          singleDay = day;
          singleValue = vals[0];
        }
      }
    }
    const units = unitsMap.get(singleSensorType) || "";
    const dayDate = new Date(singleDay + "T00:00:00");
    return (
      <div className="pod-chart--single-point">
        <div className="single-point-card">
          <div className="single-point-value">
            {singleValue}{units ? ` ${units}` : ""}
          </div>
          <div className="single-point-date">{singleSensorType}</div>
          <div className="single-point-time">{formatDateLabel(dayDate)}</div>
          <div className="single-point-disclaimer">
            Only one reading available for this period. More data is needed to display a trend chart.
          </div>
        </div>
      </div>
    );
  }

  const uniqueUnits = [...new Set(sensorTypes.map((st) => unitsMap.get(st) || ""))].filter(Boolean);
  const yAxisTitle =
    uniqueUnits.length > 1 ? "Value (mixed units)" : uniqueUnits.length === 1 ? `Value (${uniqueUnits[0]})` : "Value";

  return (
    <Plot
      data={tracesAndLabels.traces}
      layout={{
        autosize: true,
        margin: { l: 60, r: 20, t: 20, b: 50 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "rgba(255, 255, 255, 0.85)" },
        showlegend: sensorTypes.length > 1,
        legend: {
          font: { color: "rgba(255, 255, 255, 0.85)" },
          bgcolor: "transparent",
        },
        xaxis: {
          title: { text: "Date", standoff: 10 },
          gridcolor: "rgba(255, 255, 255, 0.1)",
          zerolinecolor: "rgba(255, 255, 255, 0.2)",
          tickvals: tracesAndLabels.xLabels.map((_, i) => i),
          ticktext: tracesAndLabels.xLabels,
        },
        yaxis: {
          title: { text: yAxisTitle },
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
