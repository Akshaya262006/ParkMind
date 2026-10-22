from database.base import Base
from database.connection import engine

from models.parking_zone import ParkingZone
from models.parking_slot import ParkingSlot
from models.booking import Booking
from models.parking_event import ParkingEvent

Base.metadata.create_all(bind=engine)

print("PARKSENSE tables created successfully.")