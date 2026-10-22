
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "synthetic_slot_data_v2.csv"

df = pd.read_csv(DATA_PATH)
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values("timestamp").reset_index(drop=True)

df = pd.get_dummies(df, columns=["slot_id"], dtype=int)

slot_features = sorted(
    c for c in df.columns if c.startswith("slot_id_")
)

df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
df["day_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
df["day_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)

features = [
    "hour", "day_of_week", "is_weekend", "current_occupied",
] + slot_features + [
    "hour_sin", "hour_cos", "day_sin", "day_cos",
]

X = df[features]
y = df["next_hour_occupied"].astype(int)

split = int(len(df) * 0.8)
X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_leaf=5,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)
pred = model.predict(X_test)

test = df.iloc[split:]
transition_mask = (
    test["current_occupied"].to_numpy()
    != y_test.to_numpy()
)

transition_accuracy = accuracy_score(
    y_test.to_numpy()[transition_mask],
    pred[transition_mask],
)

false_vacant = (
    (y_test.to_numpy() == 1) & (pred == 0)
).sum()

print("\nSLOT MODEL V4 — FAIR EVALUATION")
print("=" * 45)
print(f"Train rows: {len(X_train)}")
print(f"Test rows: {len(X_test)}")
print(f"Accuracy: {accuracy_score(y_test, pred):.4f}")
print(f"F1-score: {f1_score(y_test, pred):.4f}")
print(f"Transition accuracy: {transition_accuracy:.4f}")
print(f"False-vacant errors: {false_vacant}")
print("\nSynthetic test data only; real-world performance is unverified.")
