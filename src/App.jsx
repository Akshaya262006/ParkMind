
import { useEffect, useState } from "react";
import "./index.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("A1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSlots() {
    try {
      const response = await fetch(`${API}/slots`);
      if (!response.ok) throw new Error("Could not load slots.");

      const data = await response.json();
      setSlots(data);
      setError("");
    } catch {
      setError("Cannot connect to the backend. Check that FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSlots();
  }, []);

  const available = slots.filter(s => s.status === "Available").length;
  const occupied = slots.filter(s => s.status === "Occupied").length;
  const reserved = slots.filter(s => s.status === "Reserved").length;

  async function changeStatus(status) {
    if (!selectedSlot) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/slots/${selectedSlot}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) throw new Error("Slot update failed.");

      await loadSlots();
    } catch {
      setError("Could not update the slot. Check the backend and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">SMART PARKING PLATFORM</p>
          <h1>Park<span>Mind</span></h1>
          <p className="subtitle">
            Predictive Parking & Intelligent Slot Allocation
          </p>
        </div>
        <div className="connection">
          <span className="status-dot"></span>
          Backend Connected
        </div>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">PARKING OVERVIEW</p>
          <h2>Your parking, made smarter.</h2>
          <p>Live slot data loaded from the ParkMind backend.</p>
        </div>
        <div className="date-label">{slots.length} total slots</div>
      </section>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading parking slots...</p>
      ) : (
        <>
          <section className="stats">
            <StatCard label="Total Slots" value={slots.length} icon="P" />
            <StatCard label="Available" value={available} icon="✓" />
            <StatCard label="Occupied" value={occupied} icon="●" />
            <StatCard label="Reserved" value={reserved} icon="R" />
          </section>

          <section className="parking-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE SLOT MONITOR</p>
                <h2>Parking Zone A</h2>
              </div>
              <span className="zone-tag">ZONE A</span>
            </div>

            <div className="legend">
              <span><i className="available-dot"></i> Available</span>
              <span><i className="occupied-dot"></i> Occupied</span>
              <span><i className="reserved-dot"></i> Reserved</span>
            </div>

            <div className="slot-grid">
              {slots.map(slot => (
                <button
                  key={slot.id}
                  className={`slot ${slot.status.toLowerCase()} ${
                    selectedSlot === slot.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedSlot(slot.id)}
                >
                  <span className="car-icon">
                    {slot.status === "Occupied" ? "🚗" : "P"}
                  </span>
                  <strong>{slot.id}</strong>
                  <span className="slot-status">{slot.status}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="control-panel">
            <p className="eyebrow">BACKEND CONTROLS</p>
            <h2>Update a parking slot</h2>
            <p className="control-description">
              Changes are saved in the database.
            </p>

            <label className="field-label" htmlFor="slot-select">
              Select slot
            </label>
            <select
              id="slot-select"
              value={selectedSlot}
              onChange={event => setSelectedSlot(event.target.value)}
            >
              {slots.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.id} — {slot.status}
                </option>
              ))}
            </select>

            <div className="action-buttons">
              <button
                className="action available-action"
                disabled={saving}
                onClick={() => changeStatus("Available")}
              >
                Set Available
              </button>
              <button
                className="action occupied-action"
                disabled={saving}
                onClick={() => changeStatus("Occupied")}
              >
                Mark Occupied
              </button>
              <button
                className="action reserved-action"
                disabled={saving}
                onClick={() => changeStatus("Reserved")}
              >
                Reserve Slot
              </button>
            </div>

            {saving && <p>Saving update...</p>}
            <button className="reset-button" onClick={loadSlots}>
              Refresh from database
            </button>
          </section>
        </>
      )}

      <footer>
        <span>ParkMind © 2026</span>
        <span>FastAPI · SQLite</span>
      </footer>
    </main>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <span className="stat-caption">Parking spaces</span>
    </article>
  );
}

export default App;
