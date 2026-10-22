from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database.base import Base


class ParkingSlot(Base):
    __tablename__ = "parking_slots"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    slot_id: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False
    )

    zone_id: Mapped[int] = mapped_column(
        ForeignKey("parking_zones.id"),
        nullable=False
    )

    x_m: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    y_m: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    length_m: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    width_m: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    orientation: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="VACANT",
        nullable=False
    )