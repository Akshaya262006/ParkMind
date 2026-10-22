
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.health import router as health_router
from routers.parking import router as parking_router
from routers.bookings import router as bookings_router
from routers.ml_prediction import router as ml_router

app = FastAPI(
    title="PARKSENSE API",
    description="Smart Parking Management System",
    version="0.2.0",
)

# Allow the local React/Vite dashboard to call the API.
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


@app.get("/")
def root():
    return {
        "message": "PARKSENSE API is running",
        "status": "success",
        "version": "0.2.0",
    }


app.include_router(health_router)
app.include_router(parking_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(ml_router, prefix="/api")