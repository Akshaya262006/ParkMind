
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth_dependencies import get_current_user, require_roles
from database.connection import get_db
from models.parking_event import ParkingEvent
from models.parking_slot import ParkingSlot
from schemas.parking import (
    DemoSensorEvent,
    ParkingSlotResponse,
    ParkingSlotStatusUpdate,
    ParkingZoneResponse,
)
from services.parking_service import (
    get_parking_status,
    get_slot_by_id,
    get_slots,
    get_zones,
    update_slot_status,
)

# All parking endpoints require an authenticated user.
# Individual write endpoints additionally require ADMIN.
router = APIRouter(
    prefix="/parking",
    tags=["Parking"],
    dependencies=[Depends(get_current_user)],
)


@router.get(
    "/zones",
    response_model=list[ParkingZoneResponse],
)
def zones(db: Session = Depends(get_db)):
    return get_zones(db)


@router.get(
    "/slots",
    response_model=list[ParkingSlotResponse],
)
def slots(db: Session = Depends(get_db)):
    return get_slots(db)


@router.get(
    "/slots/{slot_id}",
    response_model=ParkingSlotResponse,
)
def slot(
    slot_id: str,
    db: Session = Depends(get_db),
):
    result = get_slot_by_id(db, slot_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Parking slot not found",
        )

    return result


@router.get("/status")
def status(db: Session = Depends(get_db)):
    return get_parking_status(db)


# ADMIN ONLY: manually change a parking slot's status.
@router.patch(
    "/slots/{slot_id}/status",
    response_model=ParkingSlotResponse,
    dependencies=[Depends(require_roles("ADMIN"))],
)
def update_status(
    slot_id: str,
    payload: ParkingSlotStatusUpdate,
    db: Session = Depends(get_db),
):
    result = update_slot_status(
        db=db,
        slot_id=slot_id,
        status=payload.status,
        source="MANUAL",
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Parking slot not found",
        )

    return result


# ADMIN ONLY: simulate a parking sensor event.
@router.post(
    "/demo/sensor-event",
    dependencies=[Depends(require_roles("ADMIN"))],
)
def simulate_sensor_event(
    payload: DemoSensorEvent,
    db: Session = Depends(get_db),
):
    result = update_slot_status(
        db=db,
        slot_id=payload.slot_id,
        status=payload.status,
        source="SIMULATED",
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Parking slot not found",
        )

    return {
        "mode": "SIMULATED",
        "message": "Simulated sensor event processed",
        "slot_id": result.slot_id,
        "status": result.status,
    }


@router.get("/events")
def get_parking_events(
    limit: int = 20,
    db: Session = Depends(get_db),
):
    events = (
        db.query(ParkingEvent)
        .order_by(ParkingEvent.id.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )

    return [
        {
            "id": event.id,
            "slot_id": event.slot_id,
            "previous_status": event.previous_status,
            "new_status": event.new_status,
            "source": event.source,
            "occurred_at": event.occurred_at,
        }
        for event in events
    ]


@router.get("/analytics")
def get_parking_analytics(
    db: Session = Depends(get_db),
):
    slots = db.query(ParkingSlot).all()
    events = db.query(ParkingEvent).all()

    total = len(slots)
    vacant = sum(1 for item in slots if item.status == "VACANT")
    occupied = sum(1 for item in slots if item.status == "OCCUPIED")
    reserved = sum(1 for item in slots if item.status == "RESERVED")

    occupancy_percentage = (
        round((occupied / total) * 100, 2)
        if total > 0
        else 0
    )

    events_by_slot = {}

    for event in events:
        events_by_slot[event.slot_id] = (
            events_by_slot.get(event.slot_id, 0) + 1
        )

    return {
        "data_mode": "SIMULATED_DEMO",
        "current_occupancy": {
            "total_slots": total,
            "vacant": vacant,
            "occupied": occupied,
            "reserved": reserved,
            "occupancy_percentage": occupancy_percentage,
        },
        "event_summary": {
            "total_events": len(events),
            "events_by_slot": events_by_slot,
        },
    }


@router.get("/analytics/hourly-activity")
def get_hourly_activity(
    db: Session = Depends(get_db),
):
    events = (
        db.query(ParkingEvent)
        .order_by(ParkingEvent.occurred_at.asc())
        .all()
    )

    hourly_counts = {}

    for event in events:
        if event.occurred_at is None:
            continue

        hour = event.occurred_at.replace(
            minute=0,
            second=0,
            microsecond=0,
        ).isoformat()

        hourly_counts[hour] = hourly_counts.get(hour, 0) + 1

    return {
        "data_mode": "SIMULATED_DEMO",
        "total_events": sum(hourly_counts.values()),
        "hourly_activity": [
            {
                "hour": hour,
                "event_count": count,
            }
            for hour, count in sorted(hourly_counts.items())
        ],
    }
