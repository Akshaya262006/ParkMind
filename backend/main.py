from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.rate_limiter import limiter

from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.parking import router as parking_router
from routers.bookings import router as bookings_router
from routers.ml_prediction import router as ml_router


app = FastAPI(
    title="PARKSENSE API",
    description="Smart Parking Management System Backend",
    version="1.0.0",
)


# --------------------------------------------------
# RATE LIMITING
# --------------------------------------------------

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "app": "PARKSENSE",
        "message": "PARKSENSE API is running",
        "status": "healthy",
    }


# --------------------------------------------------
# ROUTER REGISTRATION
# --------------------------------------------------

# Health endpoint
app.include_router(health_router)

# Authentication: register, login, profile
app.include_router(
    auth_router,
    prefix="/api",
)

# Parking: availability, status, events, analytics
app.include_router(
    parking_router,
    prefix="/api",
)

# Bookings: create, list, cancel
app.include_router(
    bookings_router,
    prefix="/api",
)

# ML: occupancy and individual-slot predictions
app.include_router(
    ml_router,
    prefix="/api",
)