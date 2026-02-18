export const MARKER_BASE_RADIUS_METERS = 50;
export const MARKER_MIN_VISIBLE_RADIUS_PX = 8;

export function metersPerPixel(latitude: number, zoom: number): number {
  // Web Mercator approximate meters-per-pixel at given latitude.
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

export function radiusFromViewportMeters(centerLat: number, zoom: number, widthPx: number, heightPx: number): number {
  const mpp = metersPerPixel(centerLat, zoom);
  // Roughly cover the visible viewport (half of the max dimension).
  return Math.max(1, Math.round(mpp * Math.max(widthPx, heightPx) * 0.5));
}

export function formatPodLastUpdated(dateString: string | undefined | null): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds} ${year}-${month}-${day}`;
  } catch {
    return "—";
  }
}

export function shouldUsePinAtZoom(
  markerRadiusMeters: number,
  latitude: number,
  zoom: number,
  minVisibleRadiusPx: number,
): boolean {
  const pxRadius = markerRadiusMeters / metersPerPixel(latitude, zoom);
  return pxRadius < minVisibleRadiusPx;
}

export function circleTooltipOffset(
  markerRadiusMeters: number,
  latitude: number,
  zoom: number,
  tooltipGapPx: number,
): [number, number] {
  const pxRadius = markerRadiusMeters / metersPerPixel(latitude, zoom);
  return [Math.round(pxRadius + tooltipGapPx), 0];
}

export function pinTooltipOffset(pinWidthPx: number, pinHeightPx: number, tooltipGapPx: number): [number, number] {
  return [Math.round(pinWidthPx / 2 + tooltipGapPx), -Math.round(pinHeightPx / 2)];
}
