
from sqlalchemy.orm import Session

from models.booking import Booking
from models.parking_slot import ParkingSlot


ACTIVE_STATUSES = ("CONFIRMED",)


def create_booking(
    db: Session,
    payload,
    user_id: int,
    customer_name: str,
):
    # Lock the slot row to reduce concurrent reservation conflicts.
    slot = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.slot_id == payload.slot_id)
        .with_for_update()
        .first()
    )

    if slot is None:
        raise ValueError("Parking slot not found")

    if slot.status != "VACANT":
        raise ValueError(
            f"Slot {slot.slot_id} is {slot.status}, not VACANT"
        )

    conflict = (
        db.query(Booking)
        .filter(
            Booking.slot_id == payload.slot_id,
            Booking.status.in_(ACTIVE_STATUSES),
            Booking.start_time < payload.end_time,
            Booking.end_time > payload.start_time,
        )
        .first()
    )

    if conflict:
        raise ValueError("This slot has an overlapping active booking")

    booking = Booking(
        user_id=user_id,
        slot_id=payload.slot_id,
        customer_name=customer_name.strip(),
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="CONFIRMED",
    )

    try:
        db.add(booking)
        slot.status = "RESERVED"
        db.commit()
        db.refresh(booking)
        return booking
    except Exception:
        db.rollback()
        raise


def get_bookings(
    db: Session,
    user_id: int,
    is_admin: bool = False,
):
    query = db.query(Booking)

    # Drivers only see bookings linked to their own account.
    # Admins can see every booking, including older unowned records.
    if not is_admin:
        query = query.filter(Booking.user_id == user_id)

    return query.order_by(Booking.id.desc()).all()


def cancel_booking(
    db: Session,
    booking_id: int,
    user_id: int,
    is_admin: bool = False,
):
    query = db.query(Booking).filter(Booking.id == booking_id)

    # Return the same 404 for a missing booking and another user's booking.
    if not is_admin:
        query = query.filter(Booking.user_id == user_id)

    booking = query.with_for_update().first()

    if booking is None:
        raise ValueError("Booking not found")

    if booking.status != "CONFIRMED":
        raise ValueError("Only confirmed bookings can be cancelled")

    slot = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.slot_id == booking.slot_id)
        .with_for_update()
        .first()
    )

    booking.status = "CANCELLED"

    if slot is not None and slot.status == "RESERVED":
        slot.status = "VACANT"

    try:
        db.commit()
        db.refresh(booking)
        return booking
    except Exception:
        db.rollback()
        raise
