import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { FiUpload, FiShare2 } from "react-icons/fi";

import "../styles/Pod.css";
import { getPodData, getPodOwners } from "../utils/api";
import type { PodDataEntry, PodOwnerCandidate } from "../utils/apiTypes";
import SharePodModal from "../components/SharePodModal";
import SensorTrendChart from "../components/SensorTrendChart";
import DailySensorChart from "../components/DailySensorChart";
import MultiSensorDropdown from "../components/MultiSensorDropdown";

function titleCaseSensor(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  return raw
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDateMDY(date: Date): string {
  // Match the screenshot feel (M/D/YYYY).
  return date.toLocaleDateString("en-US", { year: "numeric", month: "numeric", day: "numeric" });
}

function formatLocation(lat?: number | null, lon?: number | null): string {
  if (typeof lat !== "number" || typeof lon !== "number") return "—";
  const fmt = (n: number) => (Math.round(n * 10000) / 10000).toFixed(4);
  return `(${fmt(lat)}, ${fmt(lon)})`;
}

type TrendArrow = "↑" | "↓" | "→" | null;

function trendArrow(latest: number | null | undefined, prev: number | null | undefined): TrendArrow {
  if (typeof latest !== "number" || typeof prev !== "number") return null;
  if (latest > prev) return "↑";
  if (latest < prev) return "↓";
  return "→";
}

type LatestStat = {
  label: string;
  valueText: string;
  arrow: TrendArrow;
};

export default function Pod() {
  const { podId } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PodDataEntry[]>([]);
  const [podMeta, setPodMeta] = useState<{
    id: string;
    nickname: string;
    latitude: number | null;
    longitude: number | null;
    visibility: "public" | "private";
    lastUpdated: string | null;
  } | null>(null);
  const [viewer, setViewer] = useState<{
    isAuthenticated: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    canManagePod: boolean;
  } | null>(null);

  const [selectedSensorsOverall, setSelectedSensorsOverall] = useState<string[]>([]);
  const [selectedSensorsDaily, setSelectedSensorsDaily] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<string>("Last 7 Days");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [podOwners, setPodOwners] = useState<PodOwnerCandidate[]>([]);

  useEffect(() => {
    if (!podId) {
      setError("Missing pod id in URL.");
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await getPodData(podId, ac.signal);
        setPodMeta({
          id: res.id,
          nickname: res.nickname,
          latitude: res.latitude,
          longitude: res.longitude,
          visibility: res.visibility,
          lastUpdated: res.lastUpdated,
        });
        setViewer(res.viewer ?? null);
        setData(Array.isArray(res.data) ? res.data : []);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        const message = e instanceof Error ? e.message : "Failed to load pod data.";
        setError(message);
        setData([]);
        setPodMeta(null);
        setViewer(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [podId]);

  const lastUpdatedDate = useMemo(() => {
    const ts = podMeta?.lastUpdated;
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }, [podMeta?.lastUpdated]);

  const sensorOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const e of data) {
      const st = e?.data?.sensor_type;
      if (!st) continue;
      const key = String(st);
      if (seen.has(key)) continue;
      seen.add(key);
      const units = e?.data?.reading_units ? ` (${e.data.reading_units})` : "";
      out.push({ key, label: `${titleCaseSensor(key)}${units}` });
    }
    return out;
  }, [data]);

  useEffect(() => {
    setSelectedSensorsOverall([]);
    setSelectedSensorsDaily([]);
    setSelectedDay("");
  }, [podId]);

  useEffect(() => {
    if (selectedSensorsOverall.length > 0) return;
    if (sensorOptions.length > 0) setSelectedSensorsOverall([sensorOptions[0].key]);
  }, [sensorOptions, selectedSensorsOverall]);

  useEffect(() => {
    if (selectedSensorsDaily.length > 0) return;
    if (sensorOptions.length > 0) setSelectedSensorsDaily([sensorOptions[0].key]);
  }, [sensorOptions, selectedSensorsDaily]);

  const dayOptions = useMemo(() => {
    const seen = new Set<string>();
    const days: { key: string; label: string }[] = [];
    for (const e of data) {
      const ts = e?.timestamp;
      if (!ts) continue;
      const d = new Date(ts);
      if (isNaN(d.getTime())) continue;
      // Use YYYY-MM-DD as stable key (UTC) and display as M/D/YYYY.
      const key = d.toISOString().slice(0, 10);
      if (seen.has(key)) continue;
      seen.add(key);
      days.push({ key, label: formatDateMDY(d) });
    }
    return days;
  }, [data]);

  useEffect(() => {
    if (selectedDay) return;
    if (dayOptions.length > 0) setSelectedDay(dayOptions[0].key);
  }, [dayOptions, selectedDay]);

  useEffect(() => {
    if (!showShareModal) return;
    if (!podMeta?.id) return;

    const ac = new AbortController();
    (async () => {
      try {
        const res = await getPodOwners(podMeta.id, ac.signal);
        setPodOwners(res.owners ?? []);
      } catch {
        setPodOwners([]);
      }
    })();

    return () => ac.abort();
  }, [showShareModal, podMeta?.id]);

  // Latest cards are derived at render time from whatever sensor types exist (no hardcoding).

  const locationText = formatLocation(podMeta?.latitude, podMeta?.longitude);

  if (loading) return <div className="pod-loading">Loading…</div>;
  if (error) return <div className="pod-error">{error}</div>;

  return (
    <div className="pod-page">
      <section className="card card--compact pod-header">
        <div className="pod-header-left">
          <h1 className="pod-title">{podMeta?.nickname ?? `Pod ${podMeta?.id ?? podId ?? ""}`} Full Data</h1>
          <p className="pod-subtitle">Pod ID: {podMeta?.id ?? podId ?? "—"}</p>
          <p className="pod-subtitle">Location: {locationText}</p>
        </div>

        <div className="pod-header-right">
          <div className="pod-meta">
            <div>Last updated: {lastUpdatedDate ? formatDateMDY(lastUpdatedDate) : "—"}</div>
          </div>
          {viewer?.canManagePod && (
            <>
            <button className="pod-action" type="button" title="Upload/Export (placeholder)">
              <FiUpload size={28} />
            </button>
            <button
              className="pod-action"
              type="button"
              title="Share Pod"
              onClick={() => setShowShareModal(true)}
            >
              <FiShare2 size={28} />
            </button>
            </>
          )}
        </div>
      </section>

      {data.length === 0 ? (
        <h2 className="pod-daily-title">No data collected</h2>
      ) : (
        <>
          <section className="pod-stats-row">
            {(() => {
              // Derive "latest" cards from whatever sensor types exist.
              // Data is expected newest-first; we keep per-sensor order by iterating in that order.
              const byType = new Map<string, PodDataEntry[]>();
              for (const e of data) {
                const st = e?.data?.sensor_type;
                if (!st) continue;
                const key = String(st);
                if (!byType.has(key)) byType.set(key, []);
                byType.get(key)!.push(e);
              }

              const stats: LatestStat[] = [];
              for (const [sensorType, entries] of byType.entries()) {
                const latest = entries[0];
                const prev = entries[1];
                const latestVal = latest?.data?.reading_value;
                const prevVal = prev?.data?.reading_value;
                const units = latest?.data?.reading_units ? String(latest.data.reading_units) : "";
                const valueText = typeof latestVal === "number" ? `${latestVal}${units ? units : ""}` : "—";
                stats.push({
                  label: `Latest ${titleCaseSensor(sensorType)}`,
                  valueText,
                  arrow: trendArrow(latestVal, prevVal),
                });
              }

              return stats.map((s) => (
                <div key={s.label} className="card card--compact card--sm pod-stat">
                  <div className="pod-stat-label">{s.label}</div>
                  <div className="pod-stat-value">
                    {s.valueText}
                    {s.arrow ? ` (${s.arrow})` : ""}
                  </div>
                </div>
              ));
            })()}
          </section>

          <section className="card card--compact">
            <div className="section-header">
              <h2 className="pod-section-title">Sensor Trends</h2>
              <div className="pod-filters">
                <MultiSensorDropdown
                  options={sensorOptions}
                  selected={selectedSensorsOverall}
                  onChange={setSelectedSensorsOverall}
                  placeholder="Select sensors"
                />
                <select value={selectedRange} className="select-control sensor-trend-date-dropdown" onChange={(e) => setSelectedRange(e.target.value)}>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="All Time">All Time</option>
                </select>
              </div>
            </div>
            <div className="pod-chart">
              <SensorTrendChart
                data={data}
                sensorTypes={selectedSensorsOverall}
                dateRange={selectedRange as "Last 7 Days" | "Last 30 Days" | "All Time"}
              />
            </div>
          </section>

          <h2 className="pod-daily-title">Daily Data</h2>

          <section className="pod-day-tabs">
            {dayOptions.length === 0 ? (
              <div className="pod-subtitle">No daily data yet.</div>
            ) : (
              dayOptions.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className={`pod-day-tab ${selectedDay === d.key ? "pod-day-tab--active" : ""}`}
                  onClick={() => setSelectedDay(d.key)}
                >
                  {d.label}
                </button>
              ))
            )}
          </section>

          {selectedDay ? (
            <section className="card card--compact">
              <div className="section-header">
                <h2 className="pod-section-title">{`${formatDateMDY(new Date(selectedDay + "T00:00:00"))} Sensor Trends`}</h2>
                <div className="pod-filters">
                  <MultiSensorDropdown
                    options={sensorOptions}
                    selected={selectedSensorsDaily}
                    onChange={setSelectedSensorsDaily}
                    placeholder="Select sensors"
                  />
                </div>
              </div>
              <div className="pod-chart">
                <DailySensorChart
                  data={data}
                  sensorTypes={selectedSensorsDaily}
                  day={selectedDay}
                />
              </div>
            </section>
          ) : null}
        </>
      )}

      <SharePodModal
        show={showShareModal}
        podId={podMeta?.id ?? podId ?? ""}
        onClose={() => setShowShareModal(false)}
        currentOwnerIds={podOwners.map((o) => o.id)}
      />
    </div>
  );
}
