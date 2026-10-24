
from sqlalchemy.orm import Session

from models.parking_slot import ParkingSlot
from models.parking_zone import ParkingZone
from models.parking_event import ParkingEvent

def get_zones(db: Session):
    return db.query(ParkingZone).all()


def get_slots(db: Session):
    return db.query(ParkingSlot).order_by(ParkingSlot.id).all()


def get_slot_by_id(db: Session, slot_id: str):
    return (
        db.query(ParkingSlot)
        .filter(ParkingSlot.slot_id == slot_id)
        .first()
    )


def get_parking_status(db: Session):
    slots = get_slots(db)

    return {
        "total": len(slots),
        "vacant": sum(
            1 for slot in slots if slot.status == "VACANT"
        ),
        "reserved": sum(
            1 for slot in slots if slot.status == "RESERVED"
        ),
        "occupied": sum(
            1 for slot in slots if slot.status == "OCCUPIED"
        ),
    }


def update_slot_status(
    db: Session,
    slot_id: str,
    status: str,
    source: str = "MANUAL",
):
    slot = (
        db.query(ParkingSlot)
        .filter(ParkingSlot.slot_id == slot_id)
        .first()
    )

    if slot is None:
        return None

    previous_status = slot.status

    # Don't record an event if the status hasn't changed.
    if previous_status == status:
        return slot

    try:
        slot.status = status

        event = ParkingEvent(
            slot_id=slot.slot_id,
            previous_status=previous_status,
            new_status=status,
            source=source,
        )

        db.add(event)

        # Save the status update and event together.
        db.commit()
        db.refresh(slot)

        return slot

    except Exception:
        db.rollback()
        raise