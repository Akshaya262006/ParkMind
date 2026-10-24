
import { useEffect, useState } from "react";
import api from "../services/api";

export default function LiveParking() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSlots() {
    try {
      const response = await api.get("/api/parking/slots");
      const data = response.data;
      setSlots(Array.isArray(data) ? data : data.slots ?? []);
      setError("");
    } catch (err) {
      setError(
        err.response
          ? `Backend error: ${err.response.status}`
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSlots();
    const timer = setInterval(loadSlots, 5000);
    return () => clearInterval(timer);
  }, []);

  async function simulate(slotId, status) {
    try {
      await api.post("/api/parking/demo/sensor-event", {
        slot_id: slotId,
        status,
      });
      await loadSlots();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not update slot. Check authentication."
      );
    }
  }

  if (loading) return <p>Loading parking slots...</p>;

  return (
    <main style={{ padding: 24 }}>
      <h1>ParkSense — Live Parking</h1>
      <p>Slots refresh every 5 seconds.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={loadSlots}>Refresh</button>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 20,
        }}
      >
        {slots.map((slot) => {
          const occupied = slot.status?.toUpperCase() === "OCCUPIED";

          return (
            <article
              key={slot.id ?? slot.slot_id}
              style={{
                padding: 20,
                border: "1px solid #ccc",
                borderRadius: 12,
              }}
            >
              <h2>{slot.slot_id ?? slot.id}</h2>
              <p>
                Status: <strong>{slot.status}</strong>
              </p>
              <button
                onClick={() =>
                  simulate(
                    slot.slot_id ?? slot.id,
                    occupied ? "VACANT" : "OCCUPIED"
                  )
                }
              >
                Mark {occupied ? "Vacant" : "Occupied"}
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}
