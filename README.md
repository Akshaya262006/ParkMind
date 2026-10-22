# ParkSense 🚗🅿️

> Smart Parking Management System with real-time slot monitoring, IoT sensor integration, AI occupancy prediction, and seamless booking.

---

## 📌 Project Architecture

```
parksense/
├── admin/               # Admin web dashboard (React)
├── backend/             # FastAPI REST backend & PostgreSQL ORM models
├── database/            # SQL schemas, migrations, and seed scripts
├── docs/                # Architecture diagrams, API specs, and setup guides
├── hardware/            # ESP32 microcontroller code, sensor configs & wiring
├── ml/                  # Machine learning models, features & training pipelines
├── mobile/              # Flutter mobile client for users
├── ParkSense-Frontend/  # Web client & interactive demo interface
├── index.html           # Standalone web app preview
├── .gitignore           # Git ignore configurations
└── README.md            # Project documentation
```

---

## 🚀 Features

- **Real-Time Slot Monitoring**: Live slot vacancy, occupancy, and reservation tracking via IoT sensors.
- **Microcontroller Integration**: ESP32 with ultrasonic and IR sensors for telemetry.
- **FastAPI Backend**: High-performance RESTful API powering reservations, slot allocation, and metrics.
- **Machine Learning**: Predictive analytics for parking demand and peak occupancy trends.
- **Cross-Platform Mobile App**: Flutter mobile app for instant driver navigation and slot booking.
- **Admin & Web Client**: Interactive UI for parking management, sensor diagnostics, and heatmaps.

---

## 🛠️ Getting Started

### 1. Backend (FastAPI + PostgreSQL)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Unix/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env  # Configure your DATABASE_URL
uvicorn main:app --reload
```

### 2. Frontend & Interactive Demo
Open `index.html` directly in any modern browser, or serve it using:
```bash
npx serve .
```

---

## 📄 License
This project is licensed under the MIT License.
