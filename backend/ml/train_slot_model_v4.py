
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "synthetic_slot_data_v2.csv"
MODEL_PATH = BASE_DIR / "slot_model_v4.joblib"

df = pd.read_csv(DATA_PATH)
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values("timestamp").reset_index(drop=True)

# Encode slot identity
df = pd.get_dummies(df, columns=["slot_id"], dtype=int)

slot_features = sorted(
    col for col in df.columns if col.startswith("slot_id_")
)

# Cyclic hour features
df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

# Cyclic weekday features: Monday=0 ... Sunday=6
df["day_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
df["day_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

features = [
    "hour",
    "day_of_week",
    "is_weekend",
    "current_occupied",
] + slot_features + [
    "hour_sin",
    "hour_cos",
    "day_sin",
    "day_cos",
]

X = df[features]
y = df["next_hour_occupied"].astype(int)

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_leaf=5,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)

# Train candidate on all synthetic data for later integration tests
model.fit(X, y)

artifact = {
    "model": model,
    "features": features,
    "model_version": "slot_v4_cyclic_hour_weekday",
    "data_mode": "SYNTHETIC_SIMULATION",
    "training_rows": len(df),
    "slot_ids": ["A1", "A2", "A3", "A4", "A5"],
    "prediction_labels": {0: "VACANT", 1: "OCCUPIED"},
}

joblib.dump(artifact, MODEL_PATH)

# Reload verification
loaded = joblib.load(MODEL_PATH)
assert loaded["features"] == features
assert loaded["training_rows"] == len(df)

print("V4 model saved:", MODEL_PATH)
print("Training rows:", loaded["training_rows"])
print("Feature count:", len(features))
print("Features:", features)
print("Reload check: PASSED")
print("Data mode:", loaded["data_mode"])
print("Note: This is a candidate model, not a real-world validated model.")
