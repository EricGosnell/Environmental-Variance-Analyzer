import type { PodDataEntry } from "./apiTypes";

const GOLDEN_RATIO = 0.6180339887;
let colorCounter = 0;
const colorCache = new Map<string, string>();

export function getSensorColor(sensorType: string): string {
  if (colorCache.has(sensorType)) return colorCache.get(sensorType)!;
  const hue = Math.round((colorCounter * GOLDEN_RATIO * 360) % 360);
  colorCounter++;
  const color = `hsl(${hue}, 65%, 75%)`;
  colorCache.set(sensorType, color);
  return color;
}

export function buildUnitsMap(data: PodDataEntry[], sensorTypes: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const st of sensorTypes) {
    const entry = data.find((e) => e?.data?.sensor_type === st);
    map.set(st, entry?.data?.reading_units || "");
  }
  return map;
}
