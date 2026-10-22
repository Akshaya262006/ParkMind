
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from schemas.booking import BookingCreate, BookingResponse
from services.booking_service import (
    cancel_booking,
    create_booking,
    get_bookings,
)

router = APIRouter(
    prefix="/bookings",
    tags=["Bookings"],
)


@router.post("", response_model=BookingResponse, status_code=201)
def book_slot(
    payload: BookingCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_booking(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("", response_model=list[BookingResponse])
def list_bookings(db: Session = Depends(get_db)):
    return get_bookings(db)


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_slot_booking(
    booking_id: int,
    db: Session = Depends(get_db),
):
    try:
        return cancel_booking(db, booking_id)
    except ValueError as exc:
        message = str(exc)
        code = 404 if message == "Booking not found" else 409
        raise HTTPException(status_code=code, detail=message) from exc
