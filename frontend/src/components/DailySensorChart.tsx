import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { PodDataEntry } from "../utils/apiTypes";
import { getSensorColor, buildUnitsMap } from "../utils/sensorColors";

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

  const unitsMap = useMemo(() => buildUnitsMap(data, sensorTypes), [data, sensorTypes]);

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

  const totalPoints = chartData.sensorData.reduce((sum, sd) => sum + sd.points.length, 0);
  if (totalPoints === 1) {
    const sensorWithPoint = chartData.sensorData.find((sd) => sd.points.length === 1)!;
    const point = sensorWithPoint.points[0];
    const units = unitsMap.get(sensorWithPoint.sensorType) || "";
    return (
      <div className="pod-chart--single-point">
        <div className="single-point-card">
          <div className="single-point-value">
            {point.value}{units ? ` ${units}` : ""}
          </div>
          <div className="single-point-date">{sensorWithPoint.sensorType}</div>
          <div className="single-point-time">{formatTimeLabel(point.time)}</div>
          <div className="single-point-disclaimer">
            Only one reading available for this day. More data is needed to display a chart.
          </div>
        </div>
      </div>
    );
  }

  const uniqueUnits = [...new Set(sensorTypes.map((st) => unitsMap.get(st) || ""))].filter(Boolean);
  const yAxisTitle =
    uniqueUnits.length > 1 ? "Value (mixed units)" : uniqueUnits.length === 1 ? `Value (${uniqueUnits[0]})` : "Value";

  const traces: Plotly.Data[] = chartData.sensorData.map(({ sensorType, points }) => {
    const color = getSensorColor(sensorType);
    const units = unitsMap.get(sensorType) || "";

    return {
      type: "scatter",
      mode: "lines+markers",
      name: sensorType,
      x: points.map((p) => p.time.toISOString()),
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
          type: "date",
          title: { text: "Time", standoff: 10 },
          gridcolor: "rgba(255, 255, 255, 0.1)",
          zerolinecolor: "rgba(255, 255, 255, 0.2)",
          tickangle: -45,
          tickformat: "%I:%M %p",
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
