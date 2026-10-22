from fastapi import FastAPI
from routers.health import router as health_router

app = FastAPI(
    title="PARKSENSE API",
    description="Smart Parking Management System",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "message": "PARKSENSE API is running",
        "status": "success",
        "version": "0.1.0"
    }


app.include_router(health_router)