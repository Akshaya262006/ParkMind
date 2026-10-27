from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.rate_limiter import limiter
from database.base import Base
from database.connection import engine

# Register SQLAlchemy models before create_all()
from models.user import User
from models.parking_zone import ParkingZone
from models.parking_slot import ParkingSlot
from models.booking import Booking
from models.parking_event import ParkingEvent

from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.parking import router as parking_router
from routers.bookings import router as bookings_router
from routers.ml_prediction import router as ml_router

import os
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="PARKSENSE API",
    description="Smart Parking Management System Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://parksense-frontend-react-dashboard.vercel.app",
    "https://parksense-frontend-react-d-git-94695e-kvspsathwik2007s-projects.vercel.app",
]

extra_origins = os.getenv("FRONTEND_ORIGINS", "")
allowed_origins.extend(
    origin.strip().rstrip("/")
    for origin in extra_origins.split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def root():
    return {
        "app": "PARKSENSE",
        "message": "PARKSENSE API is running",
        "status": "healthy",
    }


app.include_router(health_router)
app.include_router(auth_router, prefix="/api")
app.include_router(parking_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(ml_router, prefix="/api")
