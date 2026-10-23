from sqlalchemy import inspect, text

from database.connection import engine


columns = {
    column["name"]
    for column in inspect(engine).get_columns("bookings")
}

with engine.begin() as connection:
    if "user_id" not in columns:
        connection.execute(
            text(
                "ALTER TABLE bookings "
                "ADD COLUMN user_id INTEGER REFERENCES users(id)"
            )
        )
        print("Added nullable user_id column to bookings.")
    else:
        print("user_id column already exists.")

    connection.execute(
        text(
            "CREATE INDEX IF NOT EXISTS "
            "ix_bookings_user_id ON bookings (user_id)"
        )
    )

print("Booking ownership migration completed.")