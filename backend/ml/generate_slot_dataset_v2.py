
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).parent
OUTPUT_PATH = BASE_DIR / "synthetic_slot_data_v2.csv"

SLOT_IDS = ["A1", "A2", "A3", "A4", "A5"]


def transition_probabilities(hour, day_of_week, slot_index):
    """
    Illustrative synthetic transition rules.
    Returns:
        arrival_probability: vacant -> occupied
        departure_probability: occupied -> vacant
    """
    weekend = day_of_week >= 5

    # Stronger arrivals during simulated morning/evening peaks.
    if 7 <= hour <= 9:
        arrival_probability = 0.58
    elif 17 <= hour <= 19:
        arrival_probability = 0.65
    elif 10 <= hour <= 16:
        arrival_probability = 0.14
    else:
        arrival_probability = 0.06

    # Stronger departures during simulated late-night hours.
    if 21 <= hour or hour <= 5:
        departure_probability = 0.58
    elif 10 <= hour <= 16:
        departure_probability = 0.12
    else:
        departure_probability = 0.07

    # Weekend demand differs in this illustrative simulation.
    if weekend:
        arrival_probability *= 0.85
        departure_probability *= 0.90

    # Small, explicit differences between simulated slots.
    slot_adjustment = (slot_index - 2) * 0.025
    arrival_probability += slot_adjustment
    departure_probability -= slot_adjustment

    return (
        float(np.clip(arrival_probability, 0.01, 0.95)),
        float(np.clip(departure_probability, 0.01, 0.95)),
    )


def generate_dataset(days=180, seed=42):
    rng = np.random.default_rng(seed)
    start_date = datetime(2026, 1, 1)
    records = []

    # Keep each slot's state continuous through time.
    for slot_index, slot_id in enumerate(SLOT_IDS):
        occupied = int(rng.random() < 0.30)

        for day in range(days):
            current_date = start_date + timedelta(days=day)
            day_of_week = current_date.weekday()
            is_weekend = int(day_of_week >= 5)

            for hour in range(24):
                timestamp = current_date.replace(hour=hour)
                current_occupied = occupied

                arrival_p, departure_p = transition_probabilities(
                    hour, day_of_week, slot_index
                )

                # Simulate the transition to the next hourly state.
                if current_occupied == 0:
                    next_occupied = int(rng.random() < arrival_p)
                else:
                    next_occupied = int(
                        not (rng.random() < departure_p)
                    )

                records.append({
                    "timestamp": timestamp.isoformat(),
                    "slot_id": slot_id,
                    "hour": hour,
                    "day_of_week": day_of_week,
                    "is_weekend": is_weekend,
                    "current_occupied": current_occupied,
                    "next_hour_occupied": next_occupied,
                })

                occupied = next_occupied

    df = pd.DataFrame(records)
    df = df.sort_values(
        ["timestamp", "slot_id"]
    ).reset_index(drop=True)

    return df


if __name__ == "__main__":
    df = generate_dataset()
    df.to_csv(OUTPUT_PATH, index=False)

    print("V2 synthetic slot dataset created.")
    print(f"Rows: {len(df)}")
    print(f"Slots: {df['slot_id'].nunique()}")
    print(f"Saved to: {OUTPUT_PATH}")

    print("\nTarget distribution:")
    print(
        df["next_hour_occupied"]
        .map({0: "VACANT", 1: "OCCUPIED"})
        .value_counts(normalize=True)
        .round(4)
    )

    print("\nSample rows:")
    print(df.head())

    print("\nDATA TYPE: SYNTHETIC SIMULATION")
    print("Transition probabilities are illustrative assumptions.")
