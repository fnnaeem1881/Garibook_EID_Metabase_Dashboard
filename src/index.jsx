import { useState, useEffect, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// METABASE SQL QUERIES  (Database ID: 2 — Garibook MySQL)
// ─────────────────────────────────────────────────────────────────────────────
const QUERIES = {
  campaignStats: `
    SELECT 
      COUNT(*) as total_trips,
      SUM(CASE WHEN trip_status = 'Completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN trip_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      COUNT(DISTINCT driver_id) as active_drivers,
      COUNT(DISTINCT customer_id) as unique_customers
    FROM campaign_trips
    WHERE created_at >= '2026-03-01'`,

  driverPerformance: `
    SELECT 
      b.driver_id,
      b.driver_name,
      b.driver_car_type as car_type,
      COUNT(DISTINCT b.id) as mar_bids,
      COUNT(DISTINCT CASE WHEN b.status = 1 THEN b.booking_id END) as mar_confirmed
    FROM bids b
    WHERE b.created_at >= '2026-03-01'
      AND b.created_at < '2026-04-01'
      AND b.driver_id IS NOT NULL
    GROUP BY b.driver_id, b.driver_name, b.driver_car_type
    ORDER BY mar_bids DESC
    LIMIT 50`,

  top615Drivers: `
    SELECT 
      b.driver_id,
      b.driver_name,
      b.driver_car_type as car_type,
      COUNT(DISTINCT b.id) as hist_bids,
      COUNT(DISTINCT CASE WHEN b.status = 1 THEN b.booking_id END) as hist_confirmed
    FROM bids b
    WHERE b.created_at >= '2026-01-01'
      AND b.created_at < '2026-03-01'
      AND b.driver_id IS NOT NULL
    GROUP BY b.driver_id, b.driver_name, b.driver_car_type
    ORDER BY hist_bids DESC
    LIMIT 100`,

  eidCompletedByDriver: `
    SELECT 
      ct.driver_id,
      ct.driver_name,
      ct.driver_phone_no,
      COUNT(*) as eid_trips
    FROM campaign_trips ct
    WHERE ct.trip_status = 'Completed'
      AND ct.created_at >= '2026-03-01'
      AND ct.created_at < '2026-04-01'
      AND ct.driver_id IS NOT NULL
    GROUP BY ct.driver_id, ct.driver_name, ct.driver_phone_no
    ORDER BY eid_trips DESC`,

  carTypeDistribution: `
    SELECT driver_car_type as car_type, COUNT(*) as bid_count
    FROM bids
    WHERE created_at >= '2026-03-01'
    GROUP BY driver_car_type
    ORDER BY bid_count DESC`,

  dailyTrend: `
    SELECT 
      DATE(created_at) as trip_date,
      COUNT(*) as total,
      SUM(CASE WHEN trip_status='Completed' THEN 1 ELSE 0 END) as completed
    FROM campaign_trips
    WHERE created_at >= '2026-03-01'
    GROUP BY DATE(created_at)
    ORDER BY trip_date ASC`,
};

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA (pre-fetched from Metabase — shown until live connection is made)
// ─────────────────────────────────────────────────────────────────────────────
const SEED = {
  campaignStats: { total_trips: 2, completed: 0, cancelled: 2, active_drivers: 0, unique_customers: 2 },
  driverPerformance: [
    { driver_id: 875847, driver_name: "MD AKAS ISLAM", car_type: "HiAce", mar_bids: 13, mar_confirmed: 1 },
    { driver_id: 874813, driver_name: "MD. NAYON MMIA", car_type: "Sedan", mar_bids: 4, mar_confirmed: 4 },
    { driver_id: 872888, driver_name: "Nur Muhammad", car_type: "Sedan Premium", mar_bids: 3, mar_confirmed: 3 },
    { driver_id: 20019, driver_name: "MD. SHARIFUL ISLAM", car_type: "Sedan", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 879417, driver_name: "মোহাম্মদ তারেক", car_type: "Noah", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 877695, driver_name: "Delowar Hossain", car_type: "Sedan Premium", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 875117, driver_name: "MOHAMMAD SAKIBUL", car_type: "Sedan Premium", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 1953, driver_name: "md.abdul khalek", car_type: "Sedan", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 9530, driver_name: "Md. Razib", car_type: "HiAce", mar_bids: 2, mar_confirmed: 2 },
    { driver_id: 9018, driver_name: "Mohammad Elias", car_type: "Sedan", mar_bids: 1, mar_confirmed: 1 },
  ],
  top615: [
    { driver_id: 20555, driver_name: "MD Nazmul Hasan", car_type: "Sedan Premium", hist_bids: 51, hist_confirmed: 51, eid_trips: 0 },
    { driver_id: 1835, driver_name: "Md. Hanif khan", car_type: "Sedan Premium", hist_bids: 50, hist_confirmed: 50, eid_trips: 0 },
    { driver_id: 877749, driver_name: "NAZIMUDDIN KHAN", car_type: "Sedan Premium", hist_bids: 48, hist_confirmed: 48, eid_trips: 0 },
    { driver_id: 3967, driver_name: "FUAD KHAN", car_type: "Sedan Premium", hist_bids: 41, hist_confirmed: 41, eid_trips: 0 },
    { driver_id: 10951, driver_name: "Md. Helal Miah", car_type: "Noah", hist_bids: 38, hist_confirmed: 37, eid_trips: 0 },
    { driver_id: 870919, driver_name: "S.M Shariful Islam", car_type: "Noah", hist_bids: 36, hist_confirmed: 36, eid_trips: 0 },
    { driver_id: 871072, driver_name: "AHAMMAD HOSSIAN", car_type: "Noah", hist_bids: 36, hist_confirmed: 36, eid_trips: 0 },
    { driver_id: 872267, driver_name: "Shek Shohel Perves", car_type: "Noah", hist_bids: 35, hist_confirmed: 35, eid_trips: 0 },
    { driver_id: 871586, driver_name: "Md. Arifur Rahman", car_type: "Sedan Premium", hist_bids: 34, hist_confirmed: 34, eid_trips: 0 },
    { driver_id: 873424, driver_name: "Rofiqul islam", car_type: "Sedan", hist_bids: 31, hist_confirmed: 31, eid_trips: 0 },
    { driver_id: 873609, driver_name: "SUMON MIAH", car_type: "Noah", hist_bids: 30, hist_confirmed: 30, eid_trips: 0 },
    { driver_id: 871545, driver_name: "Amirul Islam", car_type: "Sedan Premium", hist_bids: 30, hist_confirmed: 30, eid_trips: 0 },
  ],
  carTypes: [
    { car_type: "Sedan Premium", bid_count: 37 },
    { car_type: "Sedan", bid_count: 29 },
    { car_type: "HiAce", bid_count: 18 },
    { car_type: "Noah", bid_count: 4 },
    { car_type: "Sedan Economy", bid_count: 2 },
  ],
  dailyTrend: [
    { trip_date: "2026-03-01", total: 2, completed: 0 },
    { trip_date: "2026-03-02", total: 0, completed: 0 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// METABASE CLIENT
// ─────────────────────────────────────────────────────────────────────────────
async function mbSession(url, user, pass) {
  const r = await fetch(`${url}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
  const d = await r.json();
  return d.id;
}

async function mbQuery(url, token, sql) {
  const r = await fetch(`${url}/api/dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Metabase-Session": token },
    body: JSON.stringify({ database: 2, type: "native", native: { query: sql } }),
  });
  if (!r.ok) throw new Error(`Query failed: ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  const cols = d.data.cols.map((c) => c.name);
  return d.data.rows.map((row) => {
    const obj = {};
    cols.forEach((c, i) => (obj[c] = row[i]));
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_TARGET = 4500;
const DRIVER_TARGET = 615;
const TRIP_PER_DRIVER = 5;

function getStatus(eidTrips) {
  if (eidTrips >= 5) return { label: "✅ MET", color: "#22c55e" };
  if (eidTrips >= 3) return { label: "🟡 ON TRACK", color: "#eab308" };
  if (eidTrips >= 1) return { label: "🟠 NEEDS PUSH", color: "#f97316" };
  return { label: "🔴 URGENT", color: "#ef4444" };
}

function ProgressBar({ value, max, color = "#06b6d4", height = 8, showLabel = true }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`, height: "100%", background: color,
            borderRadius: 999, transition: "width 0.8s cubic-bezier(.4,0,.2,1)",
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{value.toLocaleString()} / {max.toLocaleString()}</span>
          <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, sub, accent = "#06b6d4", icon }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.7))",
      border: `1px solid ${accent}33`, borderRadius: 12, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 4,
      boxShadow: `0 0 20px ${accent}11`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "monospace", lineHeight: 1 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

const COLORS = ["#06b6d4", "#f97316", "#a855f7", "#22c55e", "#eab308", "#ef4444"];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function GaribookEIDDashboard() {
  const [tab, setTab] = useState("overview");
  const [config, setConfig] = useState({ url: "", user: "", pass: "", token: "" });
  const [showConfig, setShowConfig] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const autoRef = useRef(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [data, setData] = useState({
    stats: SEED.campaignStats,
    drivers: SEED.top615,
    marDrivers: SEED.driverPerformance,
    carTypes: SEED.carTypes,
    trend: SEED.dailyTrend,
    source: "seed",
  });

  // ── Connect & Fetch ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async (cfg = config) => {
    setLoading(true);
    setError(null);
    try {
      let token = cfg.token;
      if (!token) {
        token = await mbSession(cfg.url, cfg.user, cfg.pass);
        setConfig((p) => ({ ...p, token }));
      }

      const [statsRows, marDriverRows, top615Rows, eidRows, carRows, trendRows] = await Promise.all([
        mbQuery(cfg.url, token, QUERIES.campaignStats),
        mbQuery(cfg.url, token, QUERIES.driverPerformance),
        mbQuery(cfg.url, token, QUERIES.top615Drivers),
        mbQuery(cfg.url, token, QUERIES.eidCompletedByDriver),
        mbQuery(cfg.url, token, QUERIES.carTypeDistribution),
        mbQuery(cfg.url, token, QUERIES.dailyTrend),
      ]);

      // Merge EID trips into top615
      const eidMap = {};
      eidRows.forEach((r) => (eidMap[r.driver_id] = r.eid_trips));
      const merged = top615Rows.map((d) => ({ ...d, eid_trips: eidMap[d.driver_id] || 0 }));

      setData({
        stats: statsRows[0] || {},
        drivers: merged,
        marDrivers: marDriverRows,
        carTypes: carRows,
        trend: trendRows,
        source: "live",
      });
      setConnected(true);
      setLastRefresh(new Date());
      setShowConfig(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // ── Auto-refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    if (autoRefresh && connected) {
      autoRef.current = setInterval(() => fetchAll(), refreshInterval * 1000);
    }
    return () => clearInterval(autoRef.current);
  }, [autoRefresh, refreshInterval, connected, fetchAll]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────
  const s = data.stats;
  const totalCompleted = Number(s.completed || 0);
  const totalTrips = Number(s.total_trips || 0);
  const driversMet = data.drivers.filter((d) => d.eid_trips >= 5).length;
  const driversOnTrack = data.drivers.filter((d) => d.eid_trips >= 3 && d.eid_trips < 5).length;
  const driversNeedsPush = data.drivers.filter((d) => d.eid_trips >= 1 && d.eid_trips < 3).length;
  const driversUrgent = data.drivers.filter((d) => d.eid_trips === 0).length;
  const top615Trips = data.drivers.reduce((a, d) => a + (d.eid_trips || 0), 0);

  // Filter drivers
  const filteredDrivers = data.drivers.filter((d) => {
    const matchSearch = !search || d.driver_name?.toLowerCase().includes(search.toLowerCase()) || String(d.driver_id).includes(search);
    const st = getStatus(d.eid_trips || 0).label;
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "MET" && st.includes("MET")) ||
      (statusFilter === "TRACK" && st.includes("TRACK")) ||
      (statusFilter === "PUSH" && st.includes("PUSH")) ||
      (statusFilter === "URGENT" && st.includes("URGENT"));
    return matchSearch && matchStatus;
  });

  // Pie data
  const pieData = [
    { name: "✅ Met", value: driversMet, color: "#22c55e" },
    { name: "🟡 On Track", value: driversOnTrack, color: "#eab308" },
    { name: "🟠 Needs Push", value: driversNeedsPush, color: "#f97316" },
    { name: "🔴 Urgent", value: driversUrgent, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────
  const BG = "#050c1a";
  const CARD = "rgba(10,20,40,0.85)";
  const BORDER = "rgba(6,182,212,0.15)";
  const PRIMARY = "#06b6d4";
  const ORANGE = "#f97316";

  const tabStyle = (t) => ({
    padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
    letterSpacing: 0.5, border: "none", transition: "all 0.2s",
    background: tab === t ? PRIMARY : "rgba(255,255,255,0.05)",
    color: tab === t ? "#fff" : "#64748b",
    boxShadow: tab === t ? `0 0 12px ${PRIMARY}66` : "none",
  });

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'DM Mono', 'Courier New', monospace", color: "#e2e8f0", padding: "0 0 60px" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(90deg,#050c1a,#0a1628)",
        borderBottom: `1px solid ${BORDER}`, padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg,#06b6d4,#0369a1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 16px #06b6d499",
          }}>🚗</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, color: "#e2e8f0" }}>GARIBOOK</div>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 3 }}>EID 2026 · LIVE OPS DASHBOARD</div>
          </div>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontSize: 10, color: connected ? "#22c55e" : "#ef4444", letterSpacing: 1 }}>
              {connected ? "METABASE LIVE" : "SEED DATA"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: "#475569", letterSpacing: 1 }}>
              UPDATED {lastRefresh.toLocaleTimeString()}
            </span>
          )}

          {/* Auto-refresh toggle */}
          {connected && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#64748b" }}>AUTO</span>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#94a3b8", borderRadius: 4, padding: "2px 4px", fontSize: 10 }}
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
                <option value={600}>10m</option>
              </select>
              <button
                onClick={() => setAutoRefresh((p) => !p)}
                style={{
                  padding: "4px 10px", borderRadius: 6,  fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: autoRefresh ? "#22c55e22" : "rgba(255,255,255,0.05)",
                  color: autoRefresh ? "#22c55e" : "#64748b",
                  border: `1px solid ${autoRefresh ? "#22c55e44" : BORDER}`,
                }}
              >{autoRefresh ? "⟳ ON" : "⟳ OFF"}</button>
            </div>
          )}

          <button
            onClick={() => connected ? fetchAll() : setShowConfig(true)}
            disabled={loading}
            style={{
              padding: "7px 16px", borderRadius: 8, border: `1px solid ${PRIMARY}44`,
              background: loading ? "rgba(6,182,212,0.1)" : "rgba(6,182,212,0.15)",
              color: PRIMARY, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1,
            }}
          >{loading ? "⟳ LOADING..." : connected ? "⟳ RELOAD" : "CONNECT METABASE"}</button>

          <button
            onClick={() => setShowConfig(true)}
            style={{
              padding: "7px 12px", borderRadius: 8, border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: 12, cursor: "pointer",
            }}>⚙</button>
        </div>
      </div>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div style={{ background: "#7f1d1d33", border: "1px solid #ef444444", padding: "12px 24px", color: "#fca5a5", fontSize: 13 }}>
          ⚠ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 16, color: "#fca5a5", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ── CONFIG MODAL ── */}
      {showConfig && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#0a1628", border: `1px solid ${PRIMARY}44`, borderRadius: 16,
            padding: 32, width: 440, boxShadow: `0 0 60px ${PRIMARY}22`,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, marginBottom: 20, color: PRIMARY }}>
              METABASE CONNECTION
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "url", label: "Metabase URL", placeholder: "http://localhost:3000", type: "text" },
                { key: "user", label: "Username / Email", placeholder: "admin@garibook.com", type: "text" },
                { key: "pass", label: "Password", placeholder: "••••••••", type: "password" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
                  <input
                    type={type}
                    value={config[key]}
                    onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.value, token: "" }))}
                    placeholder={placeholder}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 8,
                      background: "#050c1a", border: `1px solid ${BORDER}`,
                      color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}

              <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1, marginBottom: 5 }}>
                  — OR use existing Session Token —
                </div>
                <input
                  type="text"
                  value={config.token}
                  onChange={(e) => setConfig((p) => ({ ...p, token: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8,
                    background: "#050c1a", border: `1px solid ${BORDER}`,
                    color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => fetchAll()}
                disabled={loading || (!config.url || (!config.token && (!config.user || !config.pass)))}
                style={{
                  flex: 1, padding: "11px", borderRadius: 8, border: "none",
                  background: `linear-gradient(135deg,${PRIMARY},#0369a1)`,
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 1,
                }}
              >{loading ? "CONNECTING..." : "CONNECT & FETCH"}</button>
              <button
                onClick={() => setShowConfig(false)}
                style={{
                  padding: "11px 20px", borderRadius: 8, border: `1px solid ${BORDER}`,
                  background: "transparent", color: "#64748b", fontSize: 13, cursor: "pointer",
                }}
              >CANCEL</button>
            </div>

            <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(6,182,212,0.05)", borderRadius: 8, border: `1px solid ${PRIMARY}22` }}>
              <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.7 }}>
                <div style={{ color: PRIMARY, marginBottom: 4, fontWeight: 700 }}>📋 DATABASE CONFIG</div>
                Database: <span style={{ color: "#e2e8f0" }}>Garibook (ID: 2)</span> · MySQL 8.0<br />
                All queries scoped to <span style={{ color: ORANGE }}>March 2026 EID campaign</span><br />
                Token cached in session · Auto-renews on expiry
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 8 }}>
        {["overview", "drivers", "analytics"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
            {t === "overview" ? "📊 Overview" : t === "drivers" ? "🚗 Driver Cohort" : "📈 Analytics"}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, padding: "4px 10px", borderRadius: 20,
            background: data.source === "live" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
            color: data.source === "live" ? "#22c55e" : "#f59e0b",
            border: `1px solid ${data.source === "live" ? "#22c55e44" : "#f59e0b44"}`,
          }}>
            {data.source === "live" ? "● LIVE DATA" : "◉ SEED DATA"}
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ══════════════════════════════ OVERVIEW TAB ════════════════════════════ */}
        {tab === "overview" && (
          <>
            {/* Master Progress */}
            <div style={{
              background: "linear-gradient(135deg,rgba(6,182,212,0.08),rgba(3,105,161,0.05))",
              border: `1px solid ${PRIMARY}33`, borderRadius: 14, padding: "20px 24px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 2 }}>MARCH 2026 · MASTER TARGET</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: PRIMARY, marginTop: 4 }}>
                    {totalCompleted.toLocaleString()} <span style={{ fontSize: 14, color: "#64748b" }}>/ {STATUS_TARGET.toLocaleString()} TRIPS</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#64748b" }}>GAP REMAINING</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: ORANGE }}>
                    {(STATUS_TARGET - totalCompleted).toLocaleString()}
                  </div>
                </div>
              </div>
              <ProgressBar value={totalCompleted} max={STATUS_TARGET} color={PRIMARY} height={12} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 20 }}>
                {[
                  { label: "Week 1 Target", val: 700, color: "#a855f7" },
                  { label: "Week 2 Target", val: 1600, color: PRIMARY },
                  { label: "Week 3 Target", val: 2800, color: ORANGE },
                  { label: "Week 4 / FULL", val: 4500, color: "#22c55e" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
                    <ProgressBar value={Math.min(totalCompleted, val)} max={val} color={color} height={6} />
                  </div>
                ))}
              </div>
            </div>

            {/* KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              <KPICard label="Top 615 Trips Done" value={top615Trips} sub={`Target: ${(DRIVER_TARGET * TRIP_PER_DRIVER).toLocaleString()}`} accent={PRIMARY} icon="🚗" />
              <KPICard label="Drivers @ Target (≥5)" value={driversMet} sub={`of ${data.drivers.length} tracked`} accent="#22c55e" icon="✅" />
              <KPICard label="Urgent (0 trips)" value={driversUrgent} sub="Needs immediate outreach" accent="#ef4444" icon="🔴" />
              <KPICard label="Total Trips (March)" value={totalCompleted} sub={`${totalTrips} total created`} accent={PRIMARY} icon="📋" />
              <KPICard label="On Track (3-4)" value={driversOnTrack} sub="Close to 5-trip target" accent="#eab308" icon="🟡" />
              <KPICard label="Active Customers" value={Number(s.unique_customers || 0)} sub="Unique bookers, March" accent="#a855f7" icon="👥" />
            </div>

            {/* Charts Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Driver Status Pie */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>DRIVER STATUS DISTRIBUTION</div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={70} strokeWidth={0}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#e2e8f0", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
                    No driver data yet
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {pieData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                      <span style={{ color: "#94a3b8" }}>{d.name}: <span style={{ color: d.color, fontWeight: 700 }}>{d.value}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Car Type Bids */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>MARCH BIDS BY CAR TYPE</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.carTypes} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="car_type" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="bid_count" radius={[4, 4, 0, 0]}>
                      {data.carTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Trend */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>DAILY TRIP TREND — MARCH 2026</div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={data.trend} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="trip_date" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v?.slice(5)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#e2e8f0", fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke={PRIMARY} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8" }}>
                  <div style={{ width: 20, height: 2, background: PRIMARY }} /> Total Created
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8" }}>
                  <div style={{ width: 20, height: 2, background: "#22c55e" }} /> Completed
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════ DRIVERS TAB ═════════════════════════════ */}
        {tab === "drivers" && (
          <>
            {/* Controls */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search driver name / ID..."
                style={{
                  flex: 1, minWidth: 200, padding: "9px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`,
                  color: "#e2e8f0", fontSize: 13, outline: "none",
                }}
              />
              {["ALL", "MET", "TRACK", "PUSH", "URGENT"].map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)} style={{
                  padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  background: statusFilter === f ? PRIMARY : "rgba(255,255,255,0.04)",
                  color: statusFilter === f ? "#fff" : "#64748b",
                }}>{f}</button>
              ))}
              <div style={{ color: "#475569", fontSize: 12, display: "flex", alignItems: "center" }}>
                {filteredDrivers.length} drivers
              </div>
            </div>

            {/* Driver Table */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(6,182,212,0.05)" }}>
                      {["#", "Driver", "Car Type", "Jan-Feb Bids", "Confirmed", "EID Trips", "Target", "Gap", "Status"].map((h) => (
                        <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "#64748b", letterSpacing: 1.5, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.slice(0, 100).map((d, i) => {
                      const st = getStatus(d.eid_trips || 0);
                      const gap = Math.max(0, 5 - (d.eid_trips || 0));
                      return (
                        <tr key={d.driver_id} style={{
                          borderBottom: `1px solid rgba(255,255,255,0.03)`,
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        }}>
                          <td style={{ padding: "10px 14px", color: "#475569" }}>{i + 1}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{d.driver_name}</div>
                            <div style={{ color: "#475569", fontSize: 10 }}>ID: {d.driver_id}</div>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{d.car_type}</td>
                          <td style={{ padding: "10px 14px", color: PRIMARY, fontWeight: 700 }}>{d.hist_bids}</td>
                          <td style={{ padding: "10px 14px", color: "#64748b" }}>{d.hist_confirmed}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16, fontWeight: 800, color: st.color }}>{d.eid_trips || 0}</span>
                              <div style={{ width: 50 }}>
                                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 999, height: 4 }}>
                                  <div style={{ width: `${Math.min(100, ((d.eid_trips || 0) / 5) * 100)}%`, height: "100%", background: st.color, borderRadius: 999 }} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px", color: "#64748b" }}>5</td>
                          <td style={{ padding: "10px 14px", color: gap > 0 ? ORANGE : "#22c55e", fontWeight: 700 }}>{gap}</td>
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{
                              padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: `${st.color}22`, color: st.color, border: `1px solid ${st.color}44`,
                              whiteSpace: "nowrap",
                            }}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredDrivers.length > 100 && (
                <div style={{ padding: "12px 20px", color: "#475569", fontSize: 11, borderTop: `1px solid ${BORDER}` }}>
                  Showing 100 of {filteredDrivers.length} — connect Metabase & use filters to narrow
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════ ANALYTICS TAB ═══════════════════════════ */}
        {tab === "analytics" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Trip distribution histogram */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>DRIVER TRIP DISTRIBUTION</div>
                {(() => {
                  const bins = [0, 1, 2, 3, 4, 5].map((n) => ({
                    label: n === 5 ? "5+" : String(n),
                    count: data.drivers.filter((d) => n === 5 ? (d.eid_trips || 0) >= 5 : (d.eid_trips || 0) === n).length,
                    color: n === 0 ? "#ef4444" : n < 3 ? "#f97316" : n < 5 ? "#eab308" : "#22c55e",
                  }));
                  return (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={bins} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: "EID Trips", fill: "#475569", fontSize: 10, position: "insideBottom", offset: -4 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#e2e8f0", fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {bins.map((b, i) => <Cell key={i} fill={b.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Incentive Analysis */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>INCENTIVE ANALYSIS (৳)</div>
                {[
                  { label: "Bid Incentive (৳3/bid)", val: data.drivers.reduce((a, d) => a + (d.hist_bids || 0) * 3, 0), color: PRIMARY },
                  { label: "Trip Bonus (৳400/trip)", val: data.drivers.reduce((a, d) => a + (d.eid_trips || 0) * 400, 0), color: ORANGE },
                  { label: "Projected (all 615 × 5)", val: DRIVER_TARGET * TRIP_PER_DRIVER * 400, color: "#22c55e" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "monospace" }}>৳{val.toLocaleString()}</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 999, height: 6 }}>
                      <div style={{ width: `${Math.min(100, (val / (DRIVER_TARGET * TRIP_PER_DRIVER * 400)) * 100)}%`, height: "100%", background: color, borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* March Bids by Active Driver */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 1.5, marginBottom: 16 }}>TOP ACTIVE DRIVERS — MARCH BIDS</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.marDrivers.slice(0, 15)} layout="vertical" margin={{ top: 0, right: 20, left: 110, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="driver_name" tick={{ fill: "#94a3b8", fontSize: 9 }} width={110} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0a1628", border: `1px solid ${BORDER}`, color: "#e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="mar_bids" fill={PRIMARY} radius={[0, 4, 4, 0]} name="March Bids" />
                  <Bar dataKey="mar_confirmed" fill={ORANGE} radius={[0, 4, 4, 0]} name="Confirmed" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: PRIMARY }} /> March Bids
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#94a3b8" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: ORANGE }} /> Confirmed
                </div>
              </div>
            </div>

            {/* Reload info card */}
            <div style={{
              background: "rgba(6,182,212,0.04)", border: `1px solid ${PRIMARY}22`,
              borderRadius: 12, padding: "16px 20px",
            }}>
              <div style={{ fontSize: 11, color: PRIMARY, letterSpacing: 1.5, marginBottom: 10, fontWeight: 700 }}>⚙ REALTIME RELOAD CONFIGURATION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Data Source", val: data.source === "live" ? "Metabase Live API" : "Seed Data (pre-fetched)", color: data.source === "live" ? "#22c55e" : ORANGE },
                  { label: "Auto-Refresh", val: autoRefresh ? `Every ${refreshInterval}s` : "Manual only", color: autoRefresh ? "#22c55e" : "#64748b" },
                  { label: "Last Reload", val: lastRefresh ? lastRefresh.toLocaleTimeString() : "Never", color: "#94a3b8" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 4, letterSpacing: 1 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
                Sessions auto-authenticate via <span style={{ color: PRIMARY }}>POST /api/session</span> and query via <span style={{ color: PRIMARY }}>POST /api/dataset</span> against <span style={{ color: ORANGE }}>Garibook DB (ID: 2)</span>.
                Token is cached per session and refreshed automatically on expiry.
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #050c1a; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
