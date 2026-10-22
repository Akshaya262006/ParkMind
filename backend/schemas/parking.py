
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ParkingZoneResponse(BaseModel):
    id: int
    zone_id: str
    name: str
    width_m: float
    length_m: float
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ParkingSlotResponse(BaseModel):
    id: int
    slot_id: str
    zone_id: int
    x_m: float
    y_m: float
    length_m: float
    width_m: float
    orientation: float
    status: str

    model_config = ConfigDict(from_attributes=True)


class ParkingSlotStatusUpdate(BaseModel):
    status: Literal["VACANT", "RESERVED", "OCCUPIED"]
class DemoSensorEvent(BaseModel):
    slot_id: str
    status: Literal["VACANT", "OCCUPIED"]
