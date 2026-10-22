
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Activity,
  AlertCircle,
  CarFront,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  ParkingCircle,
  RefreshCw,
  Radio,
  Wifi,
  WifiOff,
  BrainCircuit,
  ShieldCheck,
  Sparkles,
  MapPinned,
} from "lucide-react";

const API = "http://127.0.0.1:8000";

function StatCard({ label, value, icon: Icon, color, description }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon size={20} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-description">{description}</div>
    </article>
  );
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function formatTime(value) {
  if (!value) return "Not refreshed yet";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [parkingEvents, setParkingEvents] = useState([]);
  const [eventError, setEventError] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [hourlyActivity, setHourlyActivity] = useState([]);
  const [hourlyActivityError, setHourlyActivityError] = useState("");
  const [hourlyActivityLoading, setHourlyActivityLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    slot_id: "",
    customer_name: "",
    start_time: "",
    end_time: "",
  });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [busyBookingId, setBusyBookingId] = useState(null);
  const [summary, setSummary] = useState({
    total: 0,
    vacant: 0,
    reserved: 0,
    occupied: 0,
  });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

  // ML demo inputs are kept separate from live parking status.
  const [mlInput, setMlInput] = useState(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Convert JS Sunday=0 to Monday=0.
    return {
      hour: String(now.getHours()),
      day_of_week: String(day),
      zone_id: "1",
      current_occupancy: "65",
    };
  });
  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlPredictionError, setMlPredictionError] = useState("");
  const [mlPredictionLoading, setMlPredictionLoading] = useState(false);
  // Individual parking slot ML prediction
const [slotMlInput, setSlotMlInput] = useState(() => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;

  return {
    hour: String(now.getHours()),
    day_of_week: String(day),
    slot_id: "A1",
    current_occupied: "0",
  };
});

const [slotMlPrediction, setSlotMlPrediction] = useState(null);
const [slotMlError, setSlotMlError] = useState("");
const [slotMlLoading, setSlotMlLoading] = useState(false);

  // Explainable recommendation: prefer the requested zone, then balance utilization
  // and avoid repeatedly favoring slots with many recent state changes.
  const [preferredZone, setPreferredZone] = useState("any");

  const refreshData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const [slotsResponse, statusResponse] = await Promise.all([
        fetch(`${API}/api/parking/slots`),
        fetch(`${API}/api/parking/status`),
      ]);

      if (!slotsResponse.ok || !statusResponse.ok) {
        throw new Error("Backend returned an unsuccessful response.");
      }

      const [slotData, statusData] = await Promise.all([
        slotsResponse.json(),
        statusResponse.json(),
      ]);

      setSlots(slotData);
      setBookingForm((current) => {
        const currentSlotIsAvailable = slotData.some(
          (slot) => slot.slot_id === current.slot_id && slot.status === "VACANT"
        );
        if (currentSlotIsAvailable) return current;
        return {
          ...current,
          slot_id: slotData.find((slot) => slot.status === "VACANT")?.slot_id || "",
        };
      });
      setSummary(statusData);
      setConnected(true);
      setError("");
      setLastUpdated(new Date().toISOString());

      // Bookings are loaded separately so a bookings endpoint issue does not
      // make the existing parking dashboard appear disconnected.
      try {
        const bookingsResponse = await fetch(`${API}/api/bookings`);
        if (!bookingsResponse.ok) {
          throw new Error("Bookings API returned an unsuccessful response.");
        }
        const bookingData = await bookingsResponse.json();
        setBookings(bookingData);
        setBookingError("");
      } catch (bookingFetchError) {
        console.error("Could not load bookings:", bookingFetchError);
        setBookingError("Bookings could not be loaded. Check GET /api/bookings.");
      }
    } catch {
      setConnected(false);
      setError(
        "Cannot connect to PARKSENSE API. Check that FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);

    try {
      const response = await fetch(`${API}/api/parking/events?limit=20`);

      if (!response.ok) {
        throw new Error("Could not load parking event history.");
      }

      const data = await response.json();
      setParkingEvents(data);
      setEventError("");
    } catch (err) {
      setEventError(err.message || "Failed to load event history.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const refreshAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);

    try {
      const response = await fetch(`${API}/api/parking/analytics`);
      if (!response.ok) {
        throw new Error("Could not load parking analytics.");
      }

      const data = await response.json();
      setAnalytics(data);
      setAnalyticsError("");
    } catch (err) {
      setAnalyticsError(err.message || "Failed to load parking analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const refreshHourlyActivity = useCallback(async () => {
    setHourlyActivityLoading(true);

    try {
      const response = await fetch(`${API}/api/parking/analytics/hourly-activity`);
      if (!response.ok) {
        throw new Error("Could not load hourly activity analytics.");
      }

      const data = await response.json();
      const chartData = (data.hourly_activity || []).map((item) => ({
        ...item,
        hourLabel: new Date(item.hour).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setHourlyActivity(chartData);
      setHourlyActivityError("");
    } catch (err) {
      setHourlyActivityError(err.message || "Failed to load hourly activity.");
    } finally {
      setHourlyActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData(true);
    refreshEvents();
    refreshAnalytics();
    refreshHourlyActivity();

    const timer = window.setInterval(() => {
      refreshData(false);
      refreshEvents();
      refreshAnalytics();
      refreshHourlyActivity();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [refreshData, refreshEvents, refreshAnalytics, refreshHourlyActivity]);

  async function sendDemoEvent(slot) {
    const nextStatus =
      slot.status === "OCCUPIED" ? "VACANT" : "OCCUPIED";

    setBusySlot(slot.slot_id);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`${API}/api/parking/demo/sensor-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          slot_id: slot.slot_id,
          status: nextStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Could not update the slot.");
      }

      setNotice(
        `${result.slot_id} updated to ${result.status}. Demo event saved.`
      );

      await refreshData(false);
    } catch (err) {
      setError(err.message || "Demo event failed.");
    } finally {
      setBusySlot(null);
    }
  }

  function updateBookingField(field, value) {
    setBookingForm((current) => ({ ...current, [field]: value }));
  }

  async function createBooking(event) {
    event.preventDefault();
    setBookingError("");
    setError("");
    setNotice("");

    if (!bookingForm.slot_id) {
      setBookingError("No vacant parking slot is available to book.");
      return;
    }

    const startDate = new Date(bookingForm.start_time);
    const endDate = new Date(bookingForm.end_time);

    if (
      !bookingForm.customer_name.trim() ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      setBookingError("Enter a customer name and valid start/end times.");
      return;
    }

    if (endDate <= startDate) {
      setBookingError("End time must be later than start time.");
      return;
    }

    if (endDate <= new Date()) {
      setBookingError("The booking end time must be in the future.");
      return;
    }

    setBookingBusy(true);
    try {
      const response = await fetch(`${API}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          slot_id: bookingForm.slot_id,
          customer_name: bookingForm.customer_name.trim(),
          // ISO strings include a timezone (Z), as required by the backend.
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Could not create the booking.");
      }

      setNotice(`Booking #${result.id} confirmed for slot ${result.slot_id}.`);
      setBookingForm((current) => ({
        ...current,
        customer_name: "",
        start_time: "",
        end_time: "",
      }));
      await refreshData(false);
    } catch (err) {
      setBookingError(err.message || "Booking creation failed.");
    } finally {
      setBookingBusy(false);
    }
  }

  async function cancelBooking(booking) {
    if (booking.status !== "CONFIRMED") return;
    const confirmed = window.confirm(`Cancel booking #${booking.id} for slot ${booking.slot_id}?`);
    if (!confirmed) return;

    setBusyBookingId(booking.id);
    setBookingError("");
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/api/bookings/${booking.id}/cancel`, {
        method: "PATCH",
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Could not cancel the booking.");
      }

      setNotice(`Booking #${result.id} cancelled.`);
      await refreshData(false);
    } catch (err) {
      setBookingError(err.message || "Booking cancellation failed.");
    } finally {
      setBusyBookingId(null);
    }
  }

  async function predictNextHourOccupancy(event) {
    event.preventDefault();
    setMlPredictionError("");
    setMlPrediction(null);
    setMlPredictionLoading(true);

    const dayOfWeek = Number(mlInput.day_of_week);
    const occupancyPercent = Number(mlInput.current_occupancy);

    if (
      !Number.isInteger(Number(mlInput.hour)) ||
      Number(mlInput.hour) < 0 ||
      Number(mlInput.hour) > 23 ||
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !Number.isInteger(Number(mlInput.zone_id)) ||
      Number(mlInput.zone_id) < 1 ||
      Number(mlInput.zone_id) > 3 ||
      !Number.isFinite(occupancyPercent) ||
      occupancyPercent < 0 ||
      occupancyPercent > 100
    ) {
      setMlPredictionError("Enter a valid hour (0–23), weekday (0–6), zone (1–3), and occupancy (0–100%).");
      setMlPredictionLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/api/ml/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          hour: Number(mlInput.hour),
          day_of_week: dayOfWeek,
          is_weekend: dayOfWeek >= 5 ? 1 : 0,
          zone_id: Number(mlInput.zone_id),
          current_occupancy: occupancyPercent / 100,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "ML prediction request failed.");
      }
      setMlPrediction(result);
    } catch (err) {
      setMlPredictionError(
        err.message || "Could not reach the ML prediction endpoint. Check that FastAPI is running."
      );
    } finally {
      setMlPredictionLoading(false);
    }
  }
  async function predictIndividualSlot(event) {
    event.preventDefault();
    setSlotMlError("");
    setSlotMlPrediction(null);
    setSlotMlLoading(true);

    const hour = Number(slotMlInput.hour);
    const dayOfWeek = Number(slotMlInput.day_of_week);
    const currentOccupied = Number(slotMlInput.current_occupied);
    const validSlots = ["A1", "A2", "A3", "A4", "A5"];

    if (
      !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 ||
      !validSlots.includes(slotMlInput.slot_id) ||
      ![0, 1].includes(currentOccupied)
    ) {
      setSlotMlError("Enter a valid hour (0–23), weekday (0–6), slot (A1–A5), and current status.");
      setSlotMlLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/api/ml/predict-slot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          hour,
          day_of_week: dayOfWeek,
          is_weekend: dayOfWeek >= 5 ? 1 : 0,
          slot_id: slotMlInput.slot_id,
          current_occupied: currentOccupied,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.detail || "Slot prediction request failed.");
      }
      setSlotMlPrediction(result);
    } catch (err) {
      setSlotMlError(
        err.message || "Could not reach the slot prediction endpoint. Check that FastAPI is running."
      );
    } finally {
      setSlotMlLoading(false);
    }
  }

  const vacantSlots = slots.filter((slot) => slot.status === "VACANT");
  const zoneOptions = useMemo(
    () => [...new Set(slots.map((slot) => String(slot.zone_id)))].sort(),
    [slots]
  );

  const recommendations = useMemo(() => {
    const confirmedBookings = bookings.filter(
      (booking) => String(booking.status).toUpperCase() === "CONFIRMED"
    );
    const bookedSlotIds = new Set(confirmedBookings.map((booking) => String(booking.slot_id)));
    const recentEventsBySlot = parkingEvents.reduce((counts, event) => {
      const id = String(event.slot_id);
      counts[id] = (counts[id] || 0) + 1;
      return counts;
    }, {});

    return slots
      .filter((slot) => String(slot.status).toUpperCase() === "VACANT")
      .filter((slot) => !bookedSlotIds.has(String(slot.slot_id)))
      .map((slot) => {
        const zoneSlots = slots.filter(
          (candidate) => String(candidate.zone_id) === String(slot.zone_id)
        );
        const nonVacantInZone = zoneSlots.filter(
          (candidate) => String(candidate.status).toUpperCase() !== "VACANT"
        ).length;
        const zoneUtilization = zoneSlots.length ? nonVacantInZone / zoneSlots.length : 0;
        const preferredBonus = preferredZone !== "any" && String(slot.zone_id) === preferredZone ? 35 : 0;
        const balanceScore = (1 - zoneUtilization) * 50;
        const eventPenalty = Math.min(20, (recentEventsBySlot[String(slot.slot_id)] || 0) * 4);
        const score = preferredBonus + balanceScore - eventPenalty;
        const reasons = [];
        if (preferredBonus) reasons.push("matches your preferred zone");
        reasons.push(zoneUtilization < 0.5 ? "zone has lower current utilization" : "slot is currently vacant");
        if ((recentEventsBySlot[String(slot.slot_id)] || 0) === 0) reasons.push("no recent status changes in the loaded event history");
        return { ...slot, score, reasons, zoneUtilization };
      })
      .sort((a, b) => b.score - a.score || String(a.slot_id).localeCompare(String(b.slot_id)));
  }, [slots, bookings, parkingEvents, preferredZone]);

  const integrityIssues = useMemo(() => {
    const issues = [];
    const slotIds = new Set(slots.map((slot) => String(slot.slot_id)));
    const confirmedBySlot = bookings.reduce((groups, booking) => {
      if (String(booking.status).toUpperCase() === "CONFIRMED") {
        const id = String(booking.slot_id);
        groups[id] = [...(groups[id] || []), booking];
      }
      return groups;
    }, {});

    for (const slot of slots) {
      const id = String(slot.slot_id);
      const confirmed = confirmedBySlot[id] || [];
      const status = String(slot.status).toUpperCase();
      if (confirmed.length > 1) {
        issues.push({
          key: `multiple-${id}`,
          title: `${id}: multiple confirmed bookings`,
          detail: `${confirmed.length} confirmed booking records reference the same slot. Review time windows before changing records.`,
        });
      }
      if (confirmed.length > 0 && status !== "RESERVED") {
        issues.push({
          key: `booking-status-${id}`,
          title: `${id}: booking and slot status differ`,
          detail: `A confirmed booking exists while the slot is marked ${status}. Verify the booking time and slot state.`,
        });
      }
      if (status === "RESERVED" && confirmed.length === 0) {
        issues.push({
          key: `orphan-reservation-${id}`,
          title: `${id}: reserved without a confirmed booking`,
          detail: "The slot is marked RESERVED, but no confirmed booking was found in the loaded booking records.",
        });
      }
    }

    for (const booking of bookings) {
      if (!slotIds.has(String(booking.slot_id))) {
        issues.push({
          key: `missing-slot-${booking.id}`,
          title: `Booking #${booking.id}: slot not found`,
          detail: `Booking references ${booking.slot_id}, which is not present in the current slot list.`,
        });
      }
    }

    return issues;
  }, [slots, bookings]);

  const occupancyRate =
    summary.total > 0
      ? Math.round((summary.occupied / summary.total) * 100)
      : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-mark">
            <ParkingCircle size={28} />
          </span>
          <span>
            <strong>PARKSENSE</strong>
            <small>SMART PARKING</small>
          </span>
        </a>

        <div className="nav-caption">WORKSPACE</div>
        <a className="nav-link active" href="#overview">
          <LayoutDashboard size={18} />
          Overview
        </a>
        <a className="nav-link" href="#parking-layout">
          <CarFront size={18} />
          Parking layout
        </a>
        <a className="nav-link" href="#bookings">
          <CalendarDays size={18} />
          Bookings
        </a>
        <a className="nav-link" href="#smart-recommendation">
          <Sparkles size={18} />
          Smart recommendation
        </a>
        <a className="nav-link" href="#data-integrity">
          <ShieldCheck size={18} />
          Data integrity
        </a>
        <a className="nav-link" href="#activity">
          <Activity size={18} />
          System activity
        </a>
        <a className="nav-link" href="#analytics">
          <Activity size={18} />
          Analytics
        </a>
        <a className="nav-link" href="#hourly-activity">
          <Activity size={18} />
          Hourly activity
        </a>
        <a className="nav-link" href="#ml-prediction">
          <Activity size={18} />
          ML prediction
        </a>
        <a className="nav-link" href="#slot-ml-prediction">
          <BrainCircuit size={18} />
          Slot ML prediction
        </a>
        <a className="nav-link" href="#event-history">
          <Clock3 size={18} />
          Event history
        </a>

        <div className="sidebar-bottom">
          <div className="demo-note">
            <Radio size={18} />
            <div>
              <strong>Simulation mode</strong>
              <p>Events are simulated, not physical sensor readings.</p>
            </div>
          </div>
          <div className="sidebar-footer">
            <span className={`connection-dot ${connected ? "online" : ""}`} />
            {connected ? "API connected" : "API disconnected"}
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <div className="eyebrow">PARKING MANAGEMENT / OVERVIEW</div>
            <h1>Parking dashboard</h1>
            <p className="page-subtitle">
              Monitor availability and manage parking slots in real time.
            </p>
          </div>

          <div className="topbar-actions">
            <span className={`connection-pill ${connected ? "online" : ""}`}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              {connected ? "Connected" : "Offline"}
            </span>
            <button
              className="refresh-button"
              onClick={() => refreshData(true)}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="alert error-alert">
            <AlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="alert success-alert">
            <CheckCircle2 size={19} />
            <span>{notice}</span>
          </div>
        )}

        <section className="stats-grid" aria-label="Parking summary">
          <StatCard
            label="Total parking slots"
            value={summary.total}
            icon={ParkingCircle}
            color="blue"
            description="Registered in the database"
          />
          <StatCard
            label="Available"
            value={summary.vacant}
            icon={CheckCircle2}
            color="green"
            description="Ready for parking"
          />
          <StatCard
            label="Occupied"
            value={summary.occupied}
            icon={CarFront}
            color="red"
            description="Currently marked occupied"
          />
          <StatCard
            label="Reserved"
            value={summary.reserved}
            icon={Clock3}
            color="amber"
            description="Marked as reserved"
          />
        </section>

        <section className="overview-grid">
          <article className="panel occupancy-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">LIVE OVERVIEW</div>
                <h2>Occupancy</h2>
              </div>
              <span className="live-indicator">
                <span />
                LIVE
              </span>
            </div>

            <div className="occupancy-number">
              {occupancyRate}
              <span>%</span>
            </div>
            <p className="muted">Of registered slots marked occupied</p>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${occupancyRate}%` }}
              />
            </div>

            <div className="occupancy-legend">
              <span>
                <i className="legend-dot vacant-dot" />
                Vacant <strong>{summary.vacant}</strong>
              </span>
              <span>
                <i className="legend-dot occupied-dot" />
                Occupied <strong>{summary.occupied}</strong>
              </span>
              <span>
                <i className="legend-dot reserved-dot" />
                Reserved <strong>{summary.reserved}</strong>
              </span>
            </div>
          </article>

          <article className="panel connection-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">SYSTEM STATUS</div>
                <h2>Backend connection</h2>
              </div>
              {connected ? (
                <CheckCircle2 className="connection-check" size={24} />
              ) : (
                <AlertCircle className="connection-error" size={24} />
              )}
            </div>

            <div className="system-row">
              <span className="system-icon">
                <Activity size={19} />
              </span>
              <div className="system-copy">
                <strong>FastAPI service</strong>
                <span>{connected ? "Responding" : "Not reachable"}</span>
              </div>
              <span className={`mini-status ${connected ? "good" : "bad"}`}>
                {connected ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <div className="system-row">
              <span className="system-icon">
                <ParkingCircle size={19} />
              </span>
              <div className="system-copy">
                <strong>Parking data</strong>
                <span>Read through parking API</span>
              </div>
              <span className={`mini-status ${connected ? "good" : "bad"}`}>
                {connected ? "READY" : "WAITING"}
              </span>
            </div>

            <div className="last-updated">
              <Clock3 size={15} />
              Last successful refresh: {formatTime(lastUpdated)}
            </div>
          </article>
        </section>

        <section className="panel parking-panel" id="parking-layout">
          <div className="panel-heading parking-heading">
            <div>
              <div className="eyebrow">YOUR PARKING AREA</div>
              <h2>Parking slot layout</h2>
              <p className="muted">
                Slot states are loaded from the PARKSENSE backend.
              </p>
            </div>
            <span className="slot-count">{slots.length} slots</span>
          </div>

          {loading && slots.length === 0 ? (
            <div className="empty-state">
              <LoaderCircle className="spin" size={28} />
              <p>Loading parking slots...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="empty-state">
              <ParkingCircle size={30} />
              <p>No parking slots were returned by the API.</p>
            </div>
          ) : (
            <>
              <div className="map-legend" aria-label="Parking map legend">
                <span><i className="legend-dot vacant-dot" /> Vacant</span>
                <span><i className="legend-dot occupied-dot" /> Occupied</span>
                <span><i className="legend-dot reserved-dot" /> Reserved</span>
                <span className="map-hint">Select a slot to view its details</span>
              </div>

              <div className="parking-map-scroll">
                <div className="parking-map">
                  <div className="map-road-label">PARKING AREA · REFERENCE LAYOUT</div>
                  <svg
                    className="parking-map-svg"
                    viewBox={`0 0 ${Math.max(760, (Math.max(...slots.map(s => Number(s.x_m || 0) + Number(s.length_m || 5))) + 4) * 30)} ${Math.max(300, (Math.max(...slots.map(s => Number(s.y_m || 0) + Number(s.length_m || 5))) + 3) * 30)}`}
                    role="img"
                    aria-label="Interactive parking layout based on slot coordinates"
                  >
                    <defs>
                      <pattern id="parking-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e6ebf0" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect
                      x="0" y="0"
                      width="100%" height="100%"
                      rx="12"
                      fill="#f8fafc"
                    />
                    <rect
                      x="0" y="0"
                      width="100%" height="100%"
                      rx="12"
                      fill="url(#parking-grid)"
                    />
                    <text x="20" y="24" className="map-axis-label">TOP VIEW · DIMENSIONS IN METRES</text>
                    {slots.map((slot) => {
                      const currentClass = statusClass(slot.status);
                      const x = (Number(slot.x_m) || 0) * 30;
                      const y = (Number(slot.y_m) || 0) * 30;
                      const width = Math.max(42, (Number(slot.length_m) || 5) * 30);
                      const height = Math.max(34, (Number(slot.width_m) || 2.5) * 30);
                      const cx = x + width / 2;
                      const cy = y + height / 2;
                      const isSelected = selectedSlotId === slot.slot_id;

                      return (
                        <g
                          key={slot.slot_id}
                          className={`map-slot ${currentClass} ${isSelected ? "selected" : ""}`}
                          role="button"
                          tabIndex={0}
                          aria-label={`${slot.slot_id}, ${slot.status}`}
                          onClick={() => setSelectedSlotId(slot.slot_id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedSlotId(slot.slot_id);
                            }
                          }}
                        >
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            rx="8"
                            transform={`rotate(${Number(slot.orientation) || 0}, ${cx}, ${cy})`}
                          />
                          <text x={cx} y={cy - 2} textAnchor="middle" className="map-slot-label">{slot.slot_id}</text>
                          <text x={cx} y={cy + 15} textAnchor="middle" className="map-slot-status">{slot.status}</text>
                          <title>{`${slot.slot_id} · ${slot.status} · ${slot.length_m}m × ${slot.width_m}m · orientation ${slot.orientation}°`}</title>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {selectedSlotId && slots.some((slot) => slot.slot_id === selectedSlotId) && (
                <div className="selected-slot-panel">
                  {slots.filter((slot) => slot.slot_id === selectedSlotId).map((slot) => {
                    const currentClass = statusClass(slot.status);
                    const busy = busySlot === slot.slot_id;
                    return (
                      <div className="selected-slot-content" key={slot.slot_id}>
                        <div className="selected-slot-copy">
                          <span className={`status-badge ${currentClass}`}><span />{slot.status}</span>
                          <h3>Selected slot: {slot.slot_id}</h3>
                          <p>Zone {slot.zone_id} · {slot.length_m} m × {slot.width_m} m · Coordinates ({slot.x_m}, {slot.y_m}) · Orientation {slot.orientation}°</p>
                        </div>
                        <button
                          className={`slot-action selected-slot-action ${currentClass}`}
                          onClick={() => sendDemoEvent(slot)}
                          disabled={!connected || busy}
                        >
                          {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}
                          {busy ? "Updating..." : slot.status === "OCCUPIED" ? "Simulate vehicle departure" : slot.status === "RESERVED" ? "Slot reserved" : "Simulate vehicle arrival"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="slot-grid">
                {slots.map((slot) => {
                  const currentClass = statusClass(slot.status);
                  const busy = busySlot === slot.slot_id;

                  return (
                    <article
                      className={`slot-card ${currentClass} ${selectedSlotId === slot.slot_id ? "selected" : ""}`}
                      key={slot.slot_id}
                      onClick={() => setSelectedSlotId(slot.slot_id)}
                    >
                      <div className="slot-card-top">
                        <span className="slot-symbol"><CarFront size={26} /></span>
                        <span className={`status-badge ${currentClass}`}><span />{slot.status}</span>
                      </div>
                      <div className="slot-name">{slot.slot_id}</div>
                      <div className="slot-zone">Zone ID: {slot.zone_id}</div>
                      <div className="slot-details">
                        <span><small>Length</small>{slot.length_m} m</span>
                        <span><small>Width</small>{slot.width_m} m</span>
                        <span><small>Orientation</small>{slot.orientation}°</span>
                      </div>
                      <button
                        className={`slot-action ${currentClass}`}
                        onClick={(event) => { event.stopPropagation(); sendDemoEvent(slot); }}
                        disabled={!connected || busy || slot.status === "RESERVED"}
                      >
                        {busy ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={15} />}
                        {busy ? "Updating..." : slot.status === "OCCUPIED" ? "Simulate vehicle departure" : slot.status === "RESERVED" ? "Reserved — no demo toggle" : "Simulate vehicle arrival"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          <div className="simulation-disclaimer">
            <Radio size={17} />
            <div>
              <strong>Simulation controls</strong>
              <p>
                Buttons send simulated events to the backend and save the
                resulting status in PostgreSQL. They do not read physical
                ESP32 sensors.
              </p>
            </div>
          </div>
        </section>

        <section className="panel activity-panel" id="smart-recommendation">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STAGE 11 · EXPLAINABLE DECISION SUPPORT</div>
              <h2>Smart slot recommendation</h2>
              <p className="muted">
                Ranks eligible vacant slots using declared zone preference, zone utilization, and recent status-change frequency.
              </p>
            </div>
            <BrainCircuit size={24} />
          </div>

          <div className="recommendation-controls">
            <label className="booking-field recommendation-zone-field">
              <span>Preferred zone (optional)</span>
              <select value={preferredZone} onChange={(event) => setPreferredZone(event.target.value)}>
                <option value="any">Any zone</option>
                {zoneOptions.map((zone) => <option key={zone} value={zone}>Zone {zone}</option>)}
              </select>
            </label>
            <div className="recommendation-context">
              <strong>{recommendations.length} eligible slot{recommendations.length === 1 ? "" : "s"}</strong>
              <span>Only VACANT slots without a currently confirmed booking are considered.</span>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="empty-state recommendation-empty">
              <MapPinned size={28} />
              <p>No eligible vacant slots are available for recommendation right now.</p>
            </div>
          ) : (
            <div className="recommendation-grid">
              {recommendations.slice(0, 3).map((slot, index) => (
                <article className={`recommendation-card ${index === 0 ? "top-recommendation" : ""}`} key={slot.slot_id}>
                  <div className="recommendation-card-top">
                    <span className="recommendation-rank">#{index + 1}</span>
                    <span className="status-badge vacant"><span />VACANT</span>
                  </div>
                  <div className="recommendation-slot-name">{slot.slot_id}</div>
                  <div className="recommendation-zone">Zone {slot.zone_id}</div>
                  <div className="recommendation-score-row">
                    <span>Match score</span>
                    <strong>{Math.max(0, Math.min(100, Math.round(slot.score)))} / 100</strong>
                  </div>
                  <div className="recommendation-score-track">
                    <span style={{ width: `${Math.max(0, Math.min(100, Math.round(slot.score)))}%` }} />
                  </div>
                  <p className="recommendation-reason">{slot.reasons.join(" · ")}</p>
                  <button
                    type="button"
                    className="secondary-button recommendation-select"
                    onClick={() => {
                      setSelectedSlotId(slot.slot_id);
                      document.getElementById("parking-layout")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    View slot details
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="booking-note">
            <Sparkles size={16} />
            <p>
              The recommendation is a transparent rule-based ranking, not an AI-generated decision. It balances declared preference and zone utilization, and lightly penalizes slots with many recent changes. Event history is limited to the latest 20 records currently loaded; no distance or live sensor signal is assumed.
            </p>
          </div>
        </section>

        <section className="panel activity-panel" id="data-integrity">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">DATA TRIANGULATION · VALIDATION</div>
              <h2>Slot and booking consistency</h2>
              <p className="muted">
                Compares current slot states with confirmed booking records without silently changing data.
              </p>
            </div>
            <ShieldCheck size={24} />
          </div>

          <div className="integrity-summary-row">
            <div className={`integrity-summary ${integrityIssues.length ? "has-issues" : "all-clear"}`}>
              {integrityIssues.length ? <AlertCircle size={23} /> : <CheckCircle2 size={23} />}
              <div>
                <strong>{integrityIssues.length ? `${integrityIssues.length} item${integrityIssues.length === 1 ? "" : "s"} to review` : "No conflicts detected in the loaded records"}</strong>
                <span>{integrityIssues.length ? "These are review warnings, not automatic corrections." : "Slot statuses and loaded booking records currently pass the implemented checks."}</span>
              </div>
            </div>
            <button type="button" className="secondary-button" onClick={() => { refreshData(false); refreshEvents(); }}>
              <RefreshCw size={14} /> Recheck records
            </button>
          </div>

          {integrityIssues.length > 0 ? (
            <div className="integrity-list">
              {integrityIssues.map((issue) => (
                <article className="integrity-item" key={issue.key}>
                  <AlertCircle size={18} />
                  <div>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="integrity-clear-note">
              <CheckCircle2 size={18} />
              <span>No booking/slot inconsistencies were found in the records currently loaded by this dashboard.</span>
            </div>
          )}
          <div className="booking-note">
            <Radio size={16} />
            <p>
              This first integrity layer uses slot and booking data. It does not automatically repair conflicts, and it is not a guarantee that the entire database is free of issues. Review flagged records before making corrections.
            </p>
          </div>
        </section>

        <section className="panel bookings-panel" id="bookings">
          <div className="panel-heading bookings-heading">
            <div>
              <div className="eyebrow">RESERVATIONS</div>
              <h2>Parking bookings</h2>
              <p className="muted">
                Create and manage bookings using the PARKSENSE backend.
              </p>
            </div>
            <span className="slot-count">{bookings.length} bookings</span>
          </div>

          <form className="booking-form" onSubmit={createBooking}>
            <div className="booking-form-heading">
              <h3>Create a booking</h3>
              <span>Uses saved PostgreSQL booking records</span>
            </div>
            <div className="booking-fields">
              <label className="booking-field">
                <span>Parking slot</span>
                <select
                  value={bookingForm.slot_id}
                  onChange={(event) => updateBookingField("slot_id", event.target.value)}
                  required
                  disabled={vacantSlots.length === 0 || bookingBusy}
                >
                  {vacantSlots.length === 0 ? (
                    <option value="">No vacant slots available</option>
                  ) : (
                    vacantSlots.map((slot) => (
                      <option key={slot.slot_id} value={slot.slot_id}>
                        {slot.slot_id} · Zone {slot.zone_id}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="booking-field">
                <span>Customer name</span>
                <input
                  type="text"
                  value={bookingForm.customer_name}
                  onChange={(event) => updateBookingField("customer_name", event.target.value)}
                  placeholder="Enter customer name"
                  maxLength={100}
                  required
                  disabled={bookingBusy}
                />
              </label>
              <label className="booking-field">
                <span>Start time</span>
                <input
                  type="datetime-local"
                  value={bookingForm.start_time}
                  onChange={(event) => updateBookingField("start_time", event.target.value)}
                  required
                  disabled={bookingBusy}
                />
              </label>
              <label className="booking-field">
                <span>End time</span>
                <input
                  type="datetime-local"
                  value={bookingForm.end_time}
                  onChange={(event) => updateBookingField("end_time", event.target.value)}
                  required
                  disabled={bookingBusy}
                />
              </label>
            </div>
            {vacantSlots.length === 0 && (
              <p className="booking-inline-help">
                All slots are currently non-vacant. Cancel a booking or mark a slot vacant before creating another booking.
              </p>
            )}
            {bookingError && (
              <div className="alert error-alert booking-alert" role="alert">
                <AlertCircle size={18} />
                <span>{bookingError}</span>
              </div>
            )}
            <div className="booking-form-actions">
              <span className="booking-inline-help">
                Demo project: bookings use the current backend rules and available slot states.
              </span>
              <button
                className="refresh-button booking-submit"
                type="submit"
                disabled={bookingBusy || !connected || vacantSlots.length === 0}
              >
                {bookingBusy ? <LoaderCircle size={16} className="spin" /> : <CheckCircle2 size={16} />}
                {bookingBusy ? "Creating..." : "Create booking"}
              </button>
            </div>
          </form>

          <div className="bookings-list-heading">
            <div>
              <h3>Booking records</h3>
              <p className="muted">Fetched from GET /api/bookings</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => refreshData(false)}
              disabled={loading}
            >
              <RefreshCw size={14} /> Refresh bookings
            </button>
          </div>

          {bookingError && bookings.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={26} />
              <p>{bookingError}</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={28} />
              <p>No bookings have been created yet.</p>
            </div>
          ) : (
            <div className="bookings-table-wrap">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Slot</th>
                    <th>Customer</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="booking-id">#{booking.id}</td>
                      <td><span className="booking-slot-chip">{booking.slot_id}</span></td>
                      <td>{booking.customer_name}</td>
                      <td>{formatDateTime(booking.start_time)}</td>
                      <td>{formatDateTime(booking.end_time)}</td>
                      <td>
                        <span className={`booking-status ${statusClass(booking.status)}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        {booking.status === "CONFIRMED" ? (
                          <button
                            className="cancel-booking-button"
                            type="button"
                            onClick={() => cancelBooking(booking)}
                            disabled={busyBookingId === booking.id}
                          >
                            {busyBookingId === booking.id ? "Cancelling..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="booking-note">
            <Radio size={16} />
            <p>
              This version supports the current backend booking workflow. It marks a booked slot as RESERVED until cancellation; it is not yet a full system for multiple time windows on the same slot.
            </p>
          </div>
        </section>

        <section className="panel activity-panel" id="activity">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">OPERATIONS</div>
              <h2>System activity</h2>
            </div>
          </div>

          <div className="activity-row">
            <span className={`activity-icon ${connected ? "good" : "bad"}`}>
              {connected ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
            </span>
            <div className="activity-copy">
              <strong>
                {connected ? "Backend data retrieved" : "Backend unavailable"}
              </strong>
              <p>
                {connected
                  ? `${slots.length} slot records received. Summary is refreshed every 5 seconds.`
                  : "Start the FastAPI server and refresh this dashboard."}
              </p>
            </div>
            <span className="activity-time">
              {formatTime(lastUpdated)}
            </span>
          </div>

          <div className="activity-row">
            <span className="activity-icon demo">
              <Radio size={18} />
            </span>
            <div className="activity-copy">
              <strong>Demo mode enabled</strong>
              <p>
                Slot changes are simulated for demonstration purposes.
              </p>
            </div>
            <span className="activity-time">DEMO</span>
          </div>
        </section>

        <section className="panel activity-panel" id="analytics">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STAGE 7 · ANALYTICS</div>
              <h2>Occupancy analytics</h2>
              <p className="muted">
                Current slot counts and saved event totals from the backend.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={refreshAnalytics}
              disabled={analyticsLoading}
            >
              <RefreshCw
                size={14}
                className={analyticsLoading ? "spin" : ""}
              />
              {analyticsLoading ? "Loading..." : "Refresh analytics"}
            </button>
          </div>

          {analyticsError ? (
            <div className="alert error-alert" role="alert">
              <AlertCircle size={18} />
              <span>{analyticsError}</span>
            </div>
          ) : !analytics ? (
            <div className="empty-state">
              <Activity size={28} />
              <p>{analyticsLoading ? "Loading analytics..." : "No analytics data available."}</p>
            </div>
          ) : (
            <>
              <div className="stats-grid" aria-label="Occupancy analytics summary">
                <StatCard
                  label="Total slots"
                  value={analytics.current_occupancy.total_slots}
                  icon={ParkingCircle}
                  color="blue"
                  description="Registered in the database"
                />
                <StatCard
                  label="Vacant"
                  value={analytics.current_occupancy.vacant}
                  icon={CheckCircle2}
                  color="green"
                  description="Currently marked vacant"
                />
                <StatCard
                  label="Occupied"
                  value={analytics.current_occupancy.occupied}
                  icon={CarFront}
                  color="red"
                  description="Currently marked occupied"
                />
                <StatCard
                  label="Reserved"
                  value={analytics.current_occupancy.reserved}
                  icon={Clock3}
                  color="amber"
                  description="Currently marked reserved"
                />
              </div>

              <div className="overview-grid" style={{ marginTop: 20 }}>
                <article className="panel occupancy-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">CURRENT STATUS</div>
                      <h2>Occupancy percentage</h2>
                    </div>
                  </div>
                  <div className="occupancy-number">
                    {analytics.current_occupancy.occupancy_percentage}
                    <span>%</span>
                  </div>
                  <p className="muted">Occupied slots divided by total slots</p>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, analytics.current_occupancy.occupancy_percentage))}%`,
                      }}
                    />
                  </div>
                </article>

                <article className="panel connection-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="eyebrow">RECORDED ACTIVITY</div>
                      <h2>Event summary</h2>
                    </div>
                    <Activity size={22} />
                  </div>
                  <div className="occupancy-number">
                    {analytics.event_summary.total_events}
                  </div>
                  <p className="muted">Total saved status-change events</p>
                  <div className="system-row">
                    <span className="system-icon"><ParkingCircle size={19} /></span>
                    <div className="system-copy">
                      <strong>Events by slot</strong>
                      <span>
                        {Object.keys(analytics.event_summary.events_by_slot || {}).length === 0
                          ? "No events recorded"
                          : Object.entries(analytics.event_summary.events_by_slot)
                              .map(([slotId, count]) => `${slotId}: ${count}`)
                              .join(" · ")}
                      </span>
                    </div>
                  </div>
                </article>
              </div>

              <div className="booking-note">
                <Radio size={16} />
                <p>
                  Data mode: {analytics.data_mode}. These are calculations from current database status and recorded events, not AI predictions or real-world sensor measurements.
                </p>
              </div>
            </>
          )}
        </section>


        <section className="panel activity-panel" id="hourly-activity">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STAGE 9 · ACTIVITY VISUALIZATION</div>
              <h2>Hourly parking activity</h2>
              <p className="muted">
                Number of recorded status-change events grouped by hour.
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={refreshHourlyActivity}
              disabled={hourlyActivityLoading}
            >
              <RefreshCw
                size={14}
                className={hourlyActivityLoading ? "spin" : ""}
              />
              {hourlyActivityLoading ? "Loading..." : "Refresh chart"}
            </button>
          </div>

          {hourlyActivityError ? (
            <div className="alert error-alert" role="alert">
              <AlertCircle size={18} />
              <span>{hourlyActivityError}</span>
            </div>
          ) : hourlyActivity.length === 0 ? (
            <div className="empty-state">
              <Activity size={28} />
              <p>
                {hourlyActivityLoading
                  ? "Loading hourly activity..."
                  : "No recorded events available to chart yet."}
              </p>
            </div>
          ) : (
            <div style={{ width: "100%", height: 300, marginTop: 12 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourlyActivity}
                  margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label) => `Hour: ${label}`}
                    formatter={(value) => [value, "Recorded events"]}
                  />
                  <Bar
                    dataKey="event_count"
                    name="Recorded events"
                    fill="#14b8a6"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="booking-note">
            <Radio size={16} />
            <p>
              SIMULATED DEMO DATA — this chart visualizes recorded status-change events, not verified real-world vehicle arrivals or ML predictions.
            </p>
          </div>
        </section>

        <section className="panel activity-panel" id="event-history">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">PARKING RECORDS</div>
              <h2>Event history</h2>
              <p className="muted">
                Recent parking status changes recorded by the backend.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={refreshEvents}
              disabled={eventsLoading}
            >
              <RefreshCw
                size={14}
                className={eventsLoading ? "spin" : ""}
              />
              {eventsLoading ? "Loading..." : "Refresh history"}
            </button>
          </div>

          {eventError ? (
            <div className="alert error-alert" role="alert">
              <AlertCircle size={18} />
              <span>{eventError}</span>
            </div>
          ) : parkingEvents.length === 0 ? (
            <div className="empty-state">
              <Activity size={28} />
              <p>
                {eventsLoading
                  ? "Loading event history..."
                  : "No parking events found."}
              </p>
            </div>
          ) : (
            <div className="bookings-table-wrap">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Slot</th>
                    <th>Previous status</th>
                    <th>New status</th>
                    <th>Source</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {parkingEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="booking-id">#{event.id}</td>
                      <td>
                        <span className="booking-slot-chip">
                          {event.slot_id}
                        </span>
                      </td>
                      <td>{event.previous_status || "—"}</td>
                      <td>{event.new_status}</td>
                      <td>{event.source}</td>
                      <td>{formatDateTime(event.occurred_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="booking-note">
            <Radio size={16} />
            <p>
              Demo events are simulated software events, not physical sensor
              readings. This table shows the latest 20 saved events.
            </p>
          </div>
        </section>

        <section className="panel activity-panel" id="ml-prediction">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STAGE 10 · MACHINE LEARNING</div>
              <h2>Next-hour occupancy estimate</h2>
              <p className="muted">
                Run the trained Random Forest model using the inputs below.
              </p>
            </div>
          </div>

          <form className="booking-form" onSubmit={predictNextHourOccupancy}>
            <div className="booking-form-heading">
              <h3>Prediction inputs</h3>
              <span>Occupancy is entered as a percentage</span>
            </div>
            <div className="booking-fields">
              <label className="booking-field">
                <span>Hour (0–23)</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  value={mlInput.hour}
                  onChange={(event) => setMlInput((current) => ({ ...current, hour: event.target.value }))}
                  required
                  disabled={mlPredictionLoading}
                />
              </label>
              <label className="booking-field">
                <span>Day of week (Mon=0, Sun=6)</span>
                <input
                  type="number"
                  min="0"
                  max="6"
                  step="1"
                  value={mlInput.day_of_week}
                  onChange={(event) => setMlInput((current) => ({ ...current, day_of_week: event.target.value }))}
                  required
                  disabled={mlPredictionLoading}
                />
              </label>
              <label className="booking-field">
                <span>Zone ID (1–3)</span>
                <input
                  type="number"
                  min="1"
                  max="3"
                  step="1"
                  value={mlInput.zone_id}
                  onChange={(event) => setMlInput((current) => ({ ...current, zone_id: event.target.value }))}
                  required
                  disabled={mlPredictionLoading}
                />
              </label>
              <label className="booking-field">
                <span>Current occupancy (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={mlInput.current_occupancy}
                  onChange={(event) => setMlInput((current) => ({ ...current, current_occupancy: event.target.value }))}
                  required
                  disabled={mlPredictionLoading}
                />
              </label>
            </div>

            <div className="booking-form-actions">
              <span className="booking-inline-help">
                Demo model only; values are supplied manually and are not read from physical sensors.
              </span>
              <button
                className="refresh-button booking-submit"
                type="submit"
                disabled={mlPredictionLoading}
              >
                {mlPredictionLoading ? <LoaderCircle size={16} className="spin" /> : <Activity size={16} />}
                {mlPredictionLoading ? "Predicting..." : "Predict next hour"}
              </button>
            </div>
          </form>

          {mlPredictionError && (
            <div className="alert error-alert" role="alert" style={{ marginTop: 16 }}>
              <AlertCircle size={18} />
              <span>{mlPredictionError}</span>
            </div>
          )}

          {mlPrediction && (
            <div className="overview-grid" style={{ marginTop: 20 }}>
              <article className="panel occupancy-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">MODEL OUTPUT</div>
                    <h2>Predicted occupancy</h2>
                  </div>
                  <Activity size={22} />
                </div>
                <div className="occupancy-number">
                  {Number(mlPrediction.predicted_occupancy_percent).toFixed(2)}
                  <span>%</span>
                </div>
                <p className="muted">Estimated occupancy for the next hour</p>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(mlPrediction.predicted_occupancy_percent) || 0))}%`,
                    }}
                  />
                </div>
                <div className="system-row">
                  <div className="system-copy">
                    <strong>{mlPrediction.model}</strong>
                    <span>Trained regression model</span>
                  </div>
                </div>
              </article>
            </div>
          )}

          <div className="booking-note">
            <Radio size={16} />
            <p>
              SYNTHETIC DEMO MODEL — this endpoint uses a model trained on generated synthetic data. Its predictions have not been validated against real parking observations and must not be presented as live sensor-based forecasts.
            </p>
          </div>
        </section>


        <section className="panel activity-panel" id="slot-ml-prediction">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STAGE 12 · INDIVIDUAL SLOT MODEL</div>
              <h2>Individual slot prediction</h2>
              <p className="muted">
                Estimate whether a selected parking slot may be occupied in the next hour.
              </p>
            </div>
            <BrainCircuit size={24} />
          </div>

          <form className="booking-form" onSubmit={predictIndividualSlot}>
            <div className="booking-form-heading">
              <h3>Slot prediction inputs</h3>
              <span>Uses the experimental slot classifier</span>
            </div>

            <div className="booking-fields">
              <label className="booking-field">
                <span>Hour (0–23)</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  value={slotMlInput.hour}
                  onChange={(event) => setSlotMlInput((current) => ({ ...current, hour: event.target.value }))}
                  required
                  disabled={slotMlLoading}
                />
              </label>

              <label className="booking-field">
                <span>Day of week (Mon=0, Sun=6)</span>
                <input
                  type="number"
                  min="0"
                  max="6"
                  step="1"
                  value={slotMlInput.day_of_week}
                  onChange={(event) => setSlotMlInput((current) => ({ ...current, day_of_week: event.target.value }))}
                  required
                  disabled={slotMlLoading}
                />
              </label>

              <label className="booking-field">
                <span>Parking slot</span>
                <select
                  value={slotMlInput.slot_id}
                  onChange={(event) => setSlotMlInput((current) => ({ ...current, slot_id: event.target.value }))}
                  required
                  disabled={slotMlLoading}
                >
                  {["A1", "A2", "A3", "A4", "A5"].map((slotId) => (
                    <option key={slotId} value={slotId}>{slotId}</option>
                  ))}
                </select>
              </label>

              <label className="booking-field">
                <span>Current status</span>
                <select
                  value={slotMlInput.current_occupied}
                  onChange={(event) => setSlotMlInput((current) => ({ ...current, current_occupied: event.target.value }))}
                  required
                  disabled={slotMlLoading}
                >
                  <option value="0">VACANT</option>
                  <option value="1">OCCUPIED</option>
                </select>
              </label>
            </div>

            <div className="booking-form-actions">
              <span className="booking-inline-help">
                Experimental model only; inputs are manually supplied and are not read from physical sensors.
              </span>
              <button
                className="refresh-button booking-submit"
                type="submit"
                disabled={slotMlLoading}
              >
                {slotMlLoading ? <LoaderCircle size={16} className="spin" /> : <Activity size={16} />}
                {slotMlLoading ? "Predicting..." : "Predict slot status"}
              </button>
            </div>
          </form>

          {slotMlError && (
            <div className="alert error-alert" role="alert" style={{ marginTop: 16 }}>
              <AlertCircle size={18} />
              <span>{slotMlError}</span>
            </div>
          )}

          {slotMlPrediction && (
            <div className="overview-grid" style={{ marginTop: 20 }}>
              <article className="panel occupancy-panel">
                <div className="panel-heading">
                  <div>
                    <div className="eyebrow">MODEL OUTPUT · {slotMlPrediction.slot_id}</div>
                    <h2>Predicted next-hour status</h2>
                  </div>
                  <BrainCircuit size={22} />
                </div>
                <div className="occupancy-number" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
                  {slotMlPrediction.predicted_next_hour_status}
                </div>
                <p className="muted">
                  Current status: {slotMlPrediction.current_status}
                </p>
                <div className="system-row">
                  <div className="system-copy">
                    <strong>{Number(slotMlPrediction.occupied_probability_percent).toFixed(2)}% occupied probability</strong>
                    <span>{slotMlPrediction.model}</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(slotMlPrediction.occupied_probability_percent) || 0))}%`,
                    }}
                  />
                </div>
              </article>
            </div>
          )}

          <div className="booking-note">
            <Radio size={16} />
            <p>
              SYNTHETIC SIMULATION — this experimental model was trained on generated data and has not been validated against real parking observations. The prediction is not live availability or a sensor reading.
            </p>
          </div>
        </section>

        <footer className="page-footer">
          <span>PARKSENSE · Smart Parking Management</span>
          <span>Review demo · Simulation mode</span>
        </footer>
      </main>
    </div>
  );
}
