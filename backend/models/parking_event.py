from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class ParkingEvent(Base):
    __tablename__ = "parking_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    slot_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("parking_slots.slot_id"),
        nullable=False,
        index=True
    )

    previous_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    new_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    source: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )