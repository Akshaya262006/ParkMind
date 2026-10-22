from sqlalchemy.orm import Session

from models.parking_slot import ParkingSlot
from models.parking_zone import ParkingZone


def get_zones(db: Session):
    return db.query(ParkingZone).all()


def get_slots(db: Session):
    return db.query(ParkingSlot).all()


def get_slot_by_id(db: Session, slot_id: str):
    return (
        db.query(ParkingSlot)
        .filter(ParkingSlot.slot_id == slot_id)
        .first()
    )


def get_parking_status(db: Session):
    slots = db.query(ParkingSlot).all()

    return {
        "total": len(slots),
        "vacant": sum(1 for slot in slots if slot.status == "VACANT"),
        "reserved": sum(1 for slot in slots if slot.status == "RESERVED"),
        "occupied": sum(1 for slot in slots if slot.status == "OCCUPIED"),
    }