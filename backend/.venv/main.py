
from contextlib import asynccontextmanager
from pathlib import Path
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal

DB_PATH = Path(__file__).with_name("parkmind.db")


def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with connect_db() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS slots (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL
                CHECK(status IN ('Available', 'Occupied', 'Reserved'))
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS occupancy_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_id TEXT NOT NULL,
                status TEXT NOT NULL,
                recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (slot_id) REFERENCES slots(id)
            )
        """)
        connection.execute("""
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slot_id TEXT NOT NULL,
                ir_detected INTEGER NOT NULL,
                distance_cm REAL,
                occupancy INTEGER NOT NULL,
                recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (slot_id) REFERENCES slots(id)
            )
        """)

        for number in range(1, 19):
            connection.execute(
                "INSERT OR IGNORE INTO slots (id, status) VALUES (?, ?)",
                (f"A{number}", "Available"),
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="ParkMind API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SlotUpdate(BaseModel):
    status: Literal["Available", "Occupied", "Reserved"]
class SensorReading(BaseModel):
    slot_id: str
    ir_detected: bool
    distance_cm: float | None = None
    occupancy: bool

@app.get("/")
def home():
    return {"message": "ParkMind API is running!"}


@app.get("/slots")
def get_slots():
    with connect_db() as connection:
        rows = connection.execute(
            "SELECT id, status FROM slots ORDER BY id"
        ).fetchall()

    return [dict(row) for row in rows]


@app.patch("/slots/{slot_id}")
def update_slot(slot_id: str, update: SlotUpdate):
    with connect_db() as connection:
        existing = connection.execute(
            "SELECT id FROM slots WHERE id = ?", (slot_id,)
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404, detail="Parking slot not found"
            )

        
        connection.execute(
            "UPDATE slots SET status = ? WHERE id = ?",
            (update.status, slot_id),
        )

        connection.execute(
            """
            INSERT INTO occupancy_history (slot_id, status)
            VALUES (?, ?)
            """,
            (slot_id, update.status),
        )


        row = connection.execute(
            "SELECT id, status FROM slots WHERE id = ?", (slot_id,)
        ).fetchone()

    return dict(row)

@app.get("/history")
def get_history():
    with connect_db() as connection:
        rows = connection.execute("""
            SELECT id, slot_id, status, recorded_at
            FROM occupancy_history
            ORDER BY id DESC
            LIMIT 100
        """).fetchall()

    return [dict(row) for row in rows]
@app.post("/sensor-readings")
def receive_sensor_reading(reading: SensorReading):

    # Reject negative distance values
    if reading.distance_cm is not None and reading.distance_cm < 0:
        raise HTTPException(
            status_code=422,
            detail="Distance cannot be negative",
        )

    # Convert occupancy into the slot status
    status = "Occupied" if reading.occupancy else "Available"

    with connect_db() as connection:

        # Check whether the parking slot exists
        existing = connection.execute(
            "SELECT id FROM slots WHERE id = ?",
            (reading.slot_id,),
        ).fetchone()

        if existing is None:
            raise HTTPException(
                status_code=404,
                detail="Parking slot not found",
            )

        # Save the sensor reading
        connection.execute(
            """
            INSERT INTO sensor_readings
            (slot_id, ir_detected, distance_cm, occupancy)
            VALUES (?, ?, ?, ?)
            """,
            (
                reading.slot_id,
                int(reading.ir_detected),
                reading.distance_cm,
                int(reading.occupancy),
            ),
        )

        # Update the current parking status
        connection.execute(
            "UPDATE slots SET status = ? WHERE id = ?",
            (status, reading.slot_id),
        )

        # Record the status change in occupancy history
        connection.execute(
            """
            INSERT INTO occupancy_history (slot_id, status)
            VALUES (?, ?)
            """,
            (reading.slot_id, status),
        )

    return {
        "message": "Sensor reading received successfully",
        "slot_id": reading.slot_id,
        "status": status,
    }
@app.get("/sensor-readings")
def get_sensor_readings():

    with connect_db() as connection:
        rows = connection.execute("""
            SELECT id, slot_id, ir_detected, distance_cm,
                   occupancy, recorded_at
            FROM sensor_readings
            ORDER BY id DESC
            LIMIT 100
        """).fetchall()

    return [dict(row) for row in rows]