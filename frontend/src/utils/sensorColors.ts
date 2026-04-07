export function getSensorColor(sensorType: string): string {
  let hash = 0;
  for (let i = 0; i < sensorType.length; i++) {
    hash = sensorType.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 75%)`;
}