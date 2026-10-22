
from pathlib import Path

import joblib
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).parent
DATASET_PATH = BASE_DIR / "synthetic_parking_data.csv"
MODEL_PATH = BASE_DIR / "parking_model.joblib"

FEATURES = [
    "hour",
    "day_of_week",
    "is_weekend",
    "zone_id",
    "current_occupancy",
]
TARGET = "next_hour_occupancy"


def main():
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    df = pd.read_csv(DATASET_PATH)

    X = df[FEATURES]
    y = df[TARGET]

    # Keep the split chronological to reduce temporal leakage.
    split_index = int(len(df) * 0.8)
    X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
    y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

    # Simple baseline: predict the average training occupancy.
    baseline = DummyRegressor(strategy="mean")
    baseline.fit(X_train, y_train)
    baseline_predictions = baseline.predict(X_test)

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    predictions = predictions.clip(0.0, 1.0)

    baseline_mae = mean_absolute_error(
        y_test, baseline_predictions
    )
    model_mae = mean_absolute_error(y_test, predictions)

    joblib.dump(
        {"model": model, "features": FEATURES},
        MODEL_PATH,
    )

    print("ParkSense ML training completed")
    print(f"Dataset rows: {len(df)}")
    print(f"Training rows: {len(X_train)}")
    print(f"Testing rows: {len(X_test)}")
    print(f"Baseline MAE: {baseline_mae:.4f}")
    print(f"Random Forest MAE: {model_mae:.4f}")
    print(f"Saved model: {MODEL_PATH}")
    print("DATA TYPE: SYNTHETIC DEMONSTRATION DATA")


if __name__ == "__main__":
    main()
