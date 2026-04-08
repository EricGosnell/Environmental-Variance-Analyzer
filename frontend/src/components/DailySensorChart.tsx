import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { PodDataEntry } from "../utils/apiTypes";
import { getSensorColor } from "../utils/sensorColors";

type Props = {
  data: PodDataEntry[];
  sensorTypes: string[];
  day: string;
};

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function DailySensorChart({ data, sensorTypes, day }: Props) {
  const chartData = useMemo(() => {
    if (sensorTypes.length === 0) return null;

    const sensorData = sensorTypes.map((sensorType) => {
      const filtered = data.filter((e) => {
        if (e?.data?.sensor_type !== sensorType) return false;
        const d = new Date(e.timestamp);
        if (isNaN(d.getTime())) return false;
        const dayKey = d.toISOString().slice(0, 10);
        return dayKey === day;
      });

      const points = filtered
        .map((e) => ({
          time: new Date(e.timestamp),
          value: e.data.reading_value,
        }))
        .filter((p) => !isNaN(p.time.getTime()) && typeof p.value === "number")
        .sort((a, b) => a.time.getTime() - b.time.getTime());

      return {
        sensorType,
        points,
      };
    });

    return { sensorData };
  }, [data, sensorTypes, day]);

  const unitsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const st of sensorTypes) {
      const entry = data.find((e) => e?.data?.sensor_type === st);
      map.set(st, entry?.data?.reading_units || "");
    }
    return map;
  }, [data, sensorTypes]);

  const isSinglePoint = chartData !== null && chartData.sensorData.length === 1 && chartData.sensorData[0].points.length === 1;

  if (!chartData || sensorTypes.length === 0) {
    return (
      <div className="pod-chart--empty">
        No sensors selected or no data available for this day.
      </div>
    );
  }

  const allPointsEmpty = chartData.sensorData.every((sd) => sd.points.length === 0);
  if (allPointsEmpty) {
    return (
      <div className="pod-chart--empty">
        No data available for the selected sensors on this day.
      </div>
    );
  }

  const traces: Plotly.Data[] = chartData.sensorData.map(({ sensorType, points }) => {
    const color = getSensorColor(sensorType);
    const units = unitsMap.get(sensorType) || "";

    return {
      type: "scatter",
      mode: "lines+markers",
      name: sensorType,
      x: points.map((p) => formatTimeLabel(p.time)),
      y: points.map((p) => p.value),
      marker: {
        color: color,
        size: 8,
      },
      line: {
        color: color,
        width: 2,
        shape: "linear",
      },
      hovertemplate: "%{y} " + (units || "") + "<extra></extra>",
    };
  });

  return (
    <Plot
      data={traces}
      layout={{
        autosize: true,
        margin: { l: 60, r: 20, t: 20, b: 60 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: { color: "rgba(255, 255, 255, 0.85)" },
        showlegend: sensorTypes.length > 1,
        legend: {
          font: { color: "rgba(255, 255, 255, 0.85)" },
          bgcolor: "transparent",
        },
        xaxis: {
          title: { text: "Time", standoff: 10 },
          gridcolor: "rgba(255, 255, 255, 0.1)",
          zerolinecolor: "rgba(255, 255, 255, 0.2)",
          tickangle: -45,
        },
        yaxis: {
          title: { text: "Value" },
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
