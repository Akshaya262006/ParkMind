from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from schemas.parking import (
    ParkingSlotResponse,
    ParkingZoneResponse
)
from services.parking_service import (
    get_parking_status,
    get_slot_by_id,
    get_slots,
    get_zones
)

router = APIRouter(
    prefix="/parking",
    tags=["Parking"]
)


@router.get(
    "/zones",
    response_model=list[ParkingZoneResponse]
)
def zones(db: Session = Depends(get_db)):
    return get_zones(db)


@router.get(
    "/slots",
    response_model=list[ParkingSlotResponse]
)
def slots(db: Session = Depends(get_db)):
    return get_slots(db)


@router.get(
    "/slots/{slot_id}",
    response_model=ParkingSlotResponse
)
def slot(
    slot_id: str,
    db: Session = Depends(get_db)
):
    result = get_slot_by_id(db, slot_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Parking slot not found"
        )

    return result


@router.get("/status")
def status(db: Session = Depends(get_db)):
    return get_parking_status(db)