
from pathlib import Path
from math import sin, cos, pi

import joblib
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth_dependencies import get_current_user


# Both ML endpoints require a valid authenticated user.
# Drivers and admins may use predictions.
router = APIRouter(
    prefix="/ml",
    tags=["Machine Learning"],
    dependencies=[Depends(get_current_user)],
)

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "ml" / "parking_model.joblib"
SLOT_MODEL_PATH = BASE_DIR / "ml" / "slot_model_v4.joblib"


class PredictionRequest(BaseModel):
    hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: int = Field(ge=0, le=1)
    zone_id: int = Field(ge=1, le=3)
    current_occupancy: float = Field(ge=0.0, le=1.0)


class SlotPredictionRequest(BaseModel):
    hour: int = Field(ge=0, le=23)
    day_of_week: int = Field(ge=0, le=6)
    is_weekend: int = Field(ge=0, le=1)
    slot_id: str = Field(pattern=r"^A[1-5]$")
    current_occupied: int = Field(ge=0, le=1)


def load_model(path: Path):
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Model file not found: {path.name}",
        )

    try:
        return joblib.load(path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Model loading failed: {type(exc).__name__}",
        ) from exc


@router.post("/predict")
def predict_occupancy(request: PredictionRequest):
    saved = load_model(MODEL_PATH)

    try:
        model = saved["model"]
        features = saved["features"]

        input_data = pd.DataFrame(
            [{
                "hour": request.hour,
                "day_of_week": request.day_of_week,
                "is_weekend": request.is_weekend,
                "zone_id": request.zone_id,
                "current_occupancy": request.current_occupancy,
            }],
            columns=features,
        )

        prediction = float(model.predict(input_data)[0])
        prediction = max(0.0, min(1.0, prediction))

        return {
            "predicted_next_hour_occupancy": round(prediction, 4),
            "predicted_occupancy_percent": round(
                prediction * 100, 2
            ),
            "model": "RandomForestRegressor",
            "data_mode": "SYNTHETIC_DEMO",
            "disclaimer": (
                "Demonstration prediction from synthetic training data; "
                "not validated for real-world parking."
            ),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {type(exc).__name__}",
        ) from exc


@router.post("/predict-slot")
def predict_slot(request: SlotPredictionRequest):
    saved = load_model(SLOT_MODEL_PATH)

    try:
        model = saved["model"]
        features = saved["features"]

        row = {
            "hour": request.hour,
            "day_of_week": request.day_of_week,
            "is_weekend": request.is_weekend,
            "current_occupied": request.current_occupied,
            "hour_sin": sin(2 * pi * request.hour / 24),
            "hour_cos": cos(2 * pi * request.hour / 24),
            "day_sin": sin(2 * pi * request.day_of_week / 7),
            "day_cos": cos(2 * pi * request.day_of_week / 7),
        }

        for slot in ["A1", "A2", "A3", "A4", "A5"]:
            row[f"slot_id_{slot}"] = int(
                request.slot_id == slot
            )

        input_data = pd.DataFrame([row], columns=features)

        prediction = int(model.predict(input_data)[0])
        probabilities = model.predict_proba(input_data)[0]
        classes = list(model.classes_)

        occupied_index = classes.index(1)
        occupied_probability = float(
            probabilities[occupied_index]
        )

        return {
            "slot_id": request.slot_id,
            "current_status": (
                "OCCUPIED" if request.current_occupied else "VACANT"
            ),
            "predicted_next_hour_status": (
                "OCCUPIED" if prediction == 1 else "VACANT"
            ),
            "occupied_probability_percent": round(
                occupied_probability * 100, 2
            ),
            "model": "RandomForestClassifier",
            "data_mode": "SYNTHETIC_SIMULATION",
            "disclaimer": (
                "Experimental prediction trained on synthetic data; "
                "not validated against real-world parking observations."
            ),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Slot prediction failed: {type(exc).__name__}",
        ) from exc
