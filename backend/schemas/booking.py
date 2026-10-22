
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BookingCreate(BaseModel):
    slot_id: str = Field(min_length=1, max_length=20)
    customer_name: str = Field(min_length=1, max_length=100)
    start_time: datetime
    end_time: datetime

    @model_validator(mode="after")
    def validate_time_range(self):
        start = self.start_time
        end = self.end_time

        if start.tzinfo is None or end.tzinfo is None:
            raise ValueError(
                "start_time and end_time must include a timezone, "
                "for example +05:30"
            )

        if end <= start:
            raise ValueError("end_time must be after start_time")

        if end <= datetime.now(timezone.utc):
            raise ValueError("Booking end_time must be in the future")

        return self


class BookingResponse(BaseModel):
    id: int
    slot_id: str
    customer_name: str
    start_time: datetime
    end_time: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)
