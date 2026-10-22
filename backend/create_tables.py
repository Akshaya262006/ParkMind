from database.base import Base
from database.connection import engine

from models.parking_zone import ParkingZone
from models.parking_slot import ParkingSlot


Base.metadata.create_all(bind=engine)

print("PARKSENSE tables created successfully.")