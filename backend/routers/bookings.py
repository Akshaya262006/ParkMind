
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth_dependencies import get_current_user, require_roles
from database.connection import get_db
from models.user import User
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


def is_admin_user(user: User) -> bool:
    return user.role.upper() == "ADMIN"


@router.post("", response_model=BookingResponse, status_code=201)
def book_slot(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("DRIVER")),
):
    try:
        return create_booking(
            db,
            payload,
            user_id=current_user.id,
            customer_name=current_user.full_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("", response_model=list[BookingResponse])
def list_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_bookings(
        db,
        user_id=current_user.id,
        is_admin=is_admin_user(current_user),
    )


@router.patch("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_slot_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return cancel_booking(
            db,
            booking_id,
            user_id=current_user.id,
            is_admin=is_admin_user(current_user),
        )
    except ValueError as exc:
        message = str(exc)
        code = 404 if message == "Booking not found" else 409
        raise HTTPException(status_code=code, detail=message) from exc
