
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


def generate_dataset(days=180):
    rng = np.random.default_rng(42)
    start_date = datetime(2026, 1, 1)
    records = []

    for day in range(days):
        current_date = start_date + timedelta(days=day)

        for hour in range(24):
            for zone_id in range(1, 4):
                is_weekend = int(current_date.weekday() >= 5)

                morning_peak = np.exp(-((hour - 9) / 3) ** 2)
                evening_peak = np.exp(-((hour - 18) / 4) ** 2)

                expected = (
                    0.20
                    + 0.35 * morning_peak
                    + 0.30 * evening_peak
                    + 0.08 * is_weekend
                    + 0.04 * zone_id
                )

                current_occupancy = np.clip(
                    expected + rng.normal(0, 0.06),
                    0.0,
                    1.0,
                )

                next_hour_occupancy = np.clip(
                    current_occupancy + rng.normal(0, 0.04),
                    0.0,
                    1.0,
                )

                records.append({
                    "timestamp": current_date.replace(
                        hour=hour
                    ).isoformat(),
                    "hour": hour,
                    "day_of_week": current_date.weekday(),
                    "is_weekend": is_weekend,
                    "zone_id": zone_id,
                    "current_occupancy": current_occupancy,
                    "next_hour_occupancy": next_hour_occupancy,
                })

    return pd.DataFrame(records)


if __name__ == "__main__":
    dataset = generate_dataset()

    output_path = (
        Path(__file__).parent / "synthetic_parking_data.csv"
    )
    dataset.to_csv(output_path, index=False)

    print("Synthetic dataset created successfully!")
    print(f"Rows: {len(dataset)}")
    print(f"Columns: {list(dataset.columns)}")
    print(f"Saved to: {output_path}")
    print("\nFirst five rows:")
    print(dataset.head())
    print("\nNOTE: This is synthetic demonstration data.")
